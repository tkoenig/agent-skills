// Adapted from mitsuhiko/pi-ds4, db8806cd52757fbaf957fe56b54700a1094a30b8.
// Copyright (c) 2026 Armin Ronacher. MIT; see LICENSE and UPSTREAM.md.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, stat, readdir, appendFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

const exec = promisify(execFile);
const MANAGED_BY = "pi-mlx-core-provider";
const HEARTBEAT_MS = 10_000;
const LEASE_TTL_MS = 45_000;
const LOCK_TIMEOUT_MS = 30_000;
const LOCK_STALE_MS = 60_000;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface ServerState {
  managedBy: string;
  pid: number;
  processStart: string;
  port: number;
  apiBaseUrl: string;
  binary: string;
  args: string[];
  stopping?: boolean;
}
interface Lease {
  managedBy: string;
  usesMlx: boolean;
  pid: number;
  processStart: string;
}
export interface LifecycleOptions {
  root: string;
  binary: string;
  modelDir: string;
  watchdog: string;
  contextTokens: number;
  readyTimeoutMs: number;
}

export async function readJson<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error: any) { if (error.code === "ENOENT") return; throw error; }
}

// Local policy: recoverable deletion, including runtime metadata and locks.
export async function trash(path: string): Promise<void> {
  try { await stat(path); } catch (e: any) { if (e.code === "ENOENT") return; throw e; }
  await exec("/usr/bin/trash", [path]);
}

export function createLifecycle(options: LifecycleOptions) {
  const root = resolve(options.root);
  const clientDir = join(root, "clients");
  const stateFile = join(root, "server.json");
  const lockDir = join(root, "lifecycle.lock");
  const leaseFile = join(clientDir, `${process.pid}.json`);
  const logFile = join(root, "log");
  let writeSeq = 0;
  let ownProcessStart: string | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let startupPromise: Promise<ServerState> | undefined;
  const startupStatuses = new Set<(message: string) => void>();
  const notifyStartup = (message: string) => { if (!disposed) for (const status of startupStatuses) status(message); };
  let disposed = false;

  async function writeJsonAtomic(file: string, value: unknown) {
    const tmp = `${file}.${process.pid}.${Date.now()}.${++writeSeq}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    await rename(tmp, file);
  }
  async function processArgs(pid: number): Promise<string> {
    return (await exec("ps", ["-p", String(pid), "-o", "args="], { timeout: 2000 }).catch(() => ({ stdout: "" }))).stdout.trim();
  }
  async function processStart(pid: number): Promise<string> {
    return (await exec("ps", ["-p", String(pid), "-o", "lstart="], { timeout: 2000 }).catch(() => ({ stdout: "" }))).stdout.trim();
  }
  function isPidAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch { return false; }
  }
  async function getOwnProcessStart(): Promise<string> {
    ownProcessStart ??= await processStart(process.pid);
    if (!ownProcessStart) throw new Error("Cannot determine Pi process identity");
    return ownProcessStart;
  }
  async function isLeaseForLiveProcess(lease: Lease | undefined): Promise<boolean> {
    if (!lease || lease.managedBy !== MANAGED_BY || lease.usesMlx !== true) return false;
    if (!isPidAlive(lease.pid) || !lease.processStart) return false;
    return (await processStart(lease.pid)) === lease.processStart;
  }
  async function isManaged(state: ServerState | undefined): Promise<boolean> {
    if (!state || state.managedBy !== MANAGED_BY || !isPidAlive(state.pid)) return false;
    if (!state.processStart || state.processStart !== await processStart(state.pid)) return false;
    if (!Number.isInteger(state.port) || state.port < 1 || state.port > 65535) return false;
    if (state.apiBaseUrl !== `http://127.0.0.1:${state.port}/v1`) return false;
    const args = await processArgs(state.pid);
    // Unlike the ds4 port fallback, never adopt an app-owned or foreign server.
    return /(^|[/\s])mlx-serve(\s|$)/.test(args)
      && args.includes(`--port ${state.port}`) && args.includes("--host 127.0.0.1");
  }
  async function isLockDirStale(): Promise<boolean> {
    const owner = await readJson<{ pid: number; processStart: string }>(join(lockDir, "owner.json"));
    if (owner?.pid) {
      if (!isPidAlive(owner.pid)) return true;
      const current = await processStart(owner.pid);
      // Do not age out a lock held by a known live process.
      if (current && owner.processStart) return current !== owner.processStart;
    }
    try { return Date.now() - (await stat(lockDir)).mtimeMs > LOCK_STALE_MS; }
    catch { return true; }
  }
  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const started = Date.now();
    while (true) {
      if (disposed) throw new Error("MLX lifecycle disposed");
      try {
        await mkdir(lockDir, { mode: 0o700 });
        await writeJsonAtomic(join(lockDir, "owner.json"), {
          managedBy: MANAGED_BY, pid: process.pid,
          processStart: await getOwnProcessStart(), createdAt: Date.now(),
        });
        break;
      } catch (error: any) {
        if (error.code !== "EEXIST") throw error;
        if (await isLockDirStale()) { await trash(lockDir); continue; }
        if (Date.now() - started > LOCK_TIMEOUT_MS) throw new Error(`Timed out waiting for MLX lifecycle lock: ${lockDir}`);
        await sleep(100 + Math.floor(Math.random() * 150));
      }
    }
    try { return await fn(); }
    finally { await trash(lockDir); }
  }
  async function touchLease(): Promise<void> {
    if (disposed) return;
    const now = Date.now();
    await writeJsonAtomic(leaseFile, {
      managedBy: MANAGED_BY, usesMlx: true, pid: process.pid,
      processStart: await getOwnProcessStart(), cwd: process.cwd(),
      updatedAt: now, updatedAtIso: new Date(now).toISOString(),
    });
  }
  async function pruneLeases(): Promise<void> {
    for (const entry of await readdir(clientDir)) {
      if (!/^\d+\.json$/.test(entry)) continue;
      const file = join(clientDir, entry);
      const lease = await readJson<Lease>(file);
      const info = await stat(file).catch(() => undefined);
      if (!info || Date.now() - info.mtimeMs > LEASE_TTL_MS || !await isLeaseForLiveProcess(lease)) await trash(file);
    }
  }
  async function ensureWatchdog(): Promise<void> {
    const watchdogFile = join(root, "watchdog.json");
    const existing = await readJson<{ pid: number; processStart: string }>(watchdogFile);
    if (existing && isPidAlive(existing.pid) && existing.processStart === await processStart(existing.pid)
      && (await processArgs(existing.pid)).includes(`${options.watchdog} ${root}`)) return;
    const fd = openSync(logFile, "a", 0o600);
    try {
      const child = spawn("/bin/sh", [options.watchdog, root], {
        detached: true, stdio: ["ignore", fd, fd],
        env: { ...process.env, MLX_LEASE_TTL_S: "45", MLX_WATCHDOG_POLL_S: "2", MLX_SHUTDOWN_GRACE_S: "60" },
      });
      await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
      child.unref();
      await writeJsonAtomic(watchdogFile, { pid: child.pid, processStart: await processStart(child.pid!) });
    } finally { closeSync(fd); }
  }
  async function activateLease(): Promise<void> {
    await mkdir(clientDir, { recursive: true, mode: 0o700 });
    await touchLease();
    await pruneLeases();
    await ensureWatchdog();
    if (!heartbeat) {
      heartbeat = setInterval(() => { void withLock(touchLease).catch(() => {}); }, HEARTBEAT_MS);
      heartbeat.unref();
    }
  }
  async function allocateRandomPort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.unref();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        server.close(error => error ? reject(error) : resolve(port));
      });
    });
  }
  function argsForPort(port: number): string[] {
    return ["--serve", "--model-dir", options.modelDir, "--host", "127.0.0.1", "--port", String(port),
      "--ctx-size", String(options.contextTokens), "--max-resident-models", "1", "--no-vision",
      "--no-warmup-eager", "--log-level", "error", "--log-file", join(root, "server.log")];
  }
  async function startServerLocked(): Promise<ServerState> {
    const port = await allocateRandomPort();
    const args = argsForPort(port);
    await appendFile(logFile, `[${new Date().toISOString()}] start mlx-serve on 127.0.0.1:${port}\n`, { mode: 0o600 });
    const fd = openSync(logFile, "a", 0o600);
    let pid: number;
    try {
      const child = spawn(options.binary, args, {
        detached: true, stdio: ["ignore", fd, fd],
        env: { ...process.env, HF_HUB_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1" },
      });
      await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
      pid = child.pid!;
      child.unref();
    } finally { closeSync(fd); }
    const identity = await processStart(pid);
    if (!identity) throw new Error(`mlx-serve exited at startup; see ${logFile}`);
    const state: ServerState = {
      managedBy: MANAGED_BY, pid, processStart: identity, port,
      apiBaseUrl: `http://127.0.0.1:${port}/v1`, binary: options.binary, args,
    };
    await writeJsonAtomic(stateFile, state);
    return state;
  }
  async function health(state: ServerState): Promise<boolean> {
    if (state.stopping || !await isManaged(state)) return false;
    try {
      const response = await fetch(`${state.apiBaseUrl}/models`, { signal: AbortSignal.timeout(2000), redirect: "error" });
      return response.ok;
    } catch { return false; }
  }
  async function waitForServerReady(state: ServerState, onStatus?: (message: string) => void): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < options.readyTimeoutMs) {
      if (disposed) throw new Error("MLX startup cancelled");
      if (!await isManaged(state)) throw new Error(`mlx-serve exited before readiness; see ${logFile}`);
      if (await health(state)) return;
      onStatus?.(`mlx-serve starting (${Math.round((Date.now() - started) / 1000)}s)`);
      await sleep(500);
    }
    throw new Error(`Timed out waiting for mlx-serve; see ${logFile}`);
  }
  async function ensureInner(onStatus?: (message: string) => void): Promise<ServerState> {
    let state: ServerState | undefined;
    while (!state) {
      if (disposed) throw new Error("MLX startup cancelled");
      state = await withLock(async () => {
        await activateLease();
        if (disposed) throw new Error("MLX startup cancelled");
        const existing = await readJson<ServerState>(stateFile);
        if (await isManaged(existing)) {
          if (existing!.stopping) return undefined;
          if (existing!.binary !== options.binary || JSON.stringify(existing!.args) !== JSON.stringify(argsForPort(existing!.port))) {
            throw new Error("MLX server configuration differs from this Pi session. Close its other users before changing settings.");
          }
          return existing;
        }
        if (existing) await trash(stateFile);
        if (disposed) throw new Error("MLX startup cancelled");
        return startServerLocked();
      });
      if (!state) { onStatus?.("Waiting for previous mlx-serve shutdown"); await sleep(500); }
    }
    await waitForServerReady(state, onStatus);
    return state;
  }
  async function ensure(signal?: AbortSignal, onStatus?: (message: string) => void): Promise<ServerState> {
    signal?.throwIfAborted();
    if (disposed) throw new Error("MLX lifecycle disposed");
    if (onStatus) startupStatuses.add(onStatus);
    if (!startupPromise) {
      notifyStartup("Preparing mlx-serve");
      const pending = ensureInner(notifyStartup);
      const shared = pending.finally(() => { if (startupPromise === shared) startupPromise = undefined; });
      startupPromise = shared;
    }
    const pending = startupPromise;
    const cleanup = () => { if (onStatus) startupStatuses.delete(onStatus); };
    if (!signal) return pending.finally(cleanup);
    // Cancelling one caller must not abort startup needed by another caller.
    return new Promise((resolve, reject) => {
      let settled = false;
      const abort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(signal.reason ?? new Error("MLX request aborted"));
      };
      signal.addEventListener("abort", abort, { once: true });
      pending.then(value => { if (!settled) resolve(value); }, error => { if (!settled) reject(error); })
        .finally(() => { settled = true; cleanup(); signal.removeEventListener("abort", abort); });
      if (signal.aborted) abort();
    });
  }
  async function release(): Promise<void> {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    if (startupPromise) await startupPromise.catch(() => {});
    await withLock(async () => { await trash(leaseFile); });
    // The watchdog owns reference counting and shutdown, exactly as in pi-ds4.
  }
  async function dispose(reason: string): Promise<void> {
    if (disposed) return;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    disposed = true;
    startupStatuses.clear();
    if (startupPromise) await Promise.race([startupPromise.catch(() => {}), sleep(5_000)]);
    // /reload/session replacement retains a brief lease for the new instance.
    if (reason === "quit") await trash(leaseFile);
  }
  async function status(): Promise<{ state?: ServerState; healthy: boolean }> {
    const state = await readJson<ServerState>(stateFile);
    return { state, healthy: !!state && await health(state) };
  }
  return { ensure, release, dispose, status, logFile };
}
