import { test } from "node:test";
import assert from "node:assert/strict";
import { fork, spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { createLifecycle, readJson, trash } from "../lifecycle.ts";
import { discoverModels } from "../catalog.ts";
import { readLogTail } from "../log-viewer.ts";
const watchdog = fileURLToPath(new URL("../mlx-watchdog.sh", import.meta.url));
const exec = promisify(execFile);
const fixture = `#!/usr/bin/env node
const http = require('node:http');
const args = process.argv; const port = Number(args[args.indexOf('--port')+1]);
const server = http.createServer((req,res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({data:[{id:'org/test'}]})); });
server.listen(port, '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
`;
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function until(check: () => Promise<boolean> | boolean, timeout = 15000) {
  const start = Date.now();
  while (!await check()) {
    if (Date.now() - start > timeout) throw new Error("Test condition timed out");
    await new Promise(r => setTimeout(r, 100));
  }
}
async function settleIsolated(root: string, pid?: number) {
  // Only terminate PIDs obtained from the fresh test root's own ensure() call.
  // Leave state intact until the fake server and watchdog have both exited.
  if (pid && alive(pid)) process.kill(pid, "SIGTERM");
  if (pid) await until(() => !alive(pid));
  const watchdogState = await readJson<{ pid: number }>(join(root, "state", "watchdog.json"));
  if (watchdogState?.pid) await until(() => !alive(watchdogState.pid));
  // watchdog.json is removed just before shell exit; also wait for the actual
  // test-root invocation to disappear rather than trusting that record alone.
  await until(async () => !(await exec("ps", ["axww", "-o", "args="])).stdout
    .split("\n").some(args => args.includes(`${watchdog} ${join(root, "state")}`)));
  await trash(root);
}
async function send(child: ChildProcess, command: string): Promise<any> {
  const result = once(child, "message"); child.send!(command);
  const [message] = await result;
  if (message.error) throw new Error(message.error);
  return message;
}

test("two real clients share server, graceful exit preserves other client, crash cleaned by watchdog", { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-test-"));
  const binary = join(root, "mlx-serve");
  await writeFile(binary, fixture, { mode: 0o755 });
  const options = { root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 5000 };
  const children: ChildProcess[] = [];
  let serverPid: number | undefined;
  try {
    for (let i = 0; i < 2; i++) {
      const child = fork(fileURLToPath(new URL("./client.ts", import.meta.url)), [], {
        env: { ...process.env, MLX_TEST_OPTIONS: JSON.stringify(options) }, stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      children.push(child); await once(child, "message");
    }
    const [a, b] = await Promise.all(children.map(c => send(c, "ensure")));
    assert.equal(a.state.pid, b.state.pid); serverPid = a.state.pid;
    assert.equal((await readdir(join(options.root, "clients"))).length, 2);
    assert.ok(a.state.args.includes("127.0.0.1"));
    assert.ok(!a.state.args.some((arg: string) => arg.startsWith("--lan")));
    const otherExit = once(children[0], "exit"); await send(children[0], "quit"); await otherExit;
    assert.ok(alive(serverPid!));
    assert.equal((await send(children[1], "ensure")).state.pid, serverPid);
    const crashed = once(children[1], "exit"); children[1].send!("crash"); await crashed;
    await until(() => !alive(serverPid!));
    await until(async () => !(await readdir(options.root)).includes("watchdog.json"));
  } finally {
    for (const child of children) if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
    await settleIsolated(root, serverPid);
  }
});

test("foreign server is not adopted or killed; stale state/lock recovery and cancellation", { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-foreign-"));
  const binary = join(root, "mlx-serve");
  await writeFile(binary, fixture, { mode: 0o755 });
  const foreign = spawn(binary, ["--host", "127.0.0.1", "--port", "0"], { stdio: "ignore" });
  await once(foreign, "spawn");
  const options = { root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 5000 };
  await mkdir(join(options.root, "lifecycle.lock"), { recursive: true });
  await writeFile(join(options.root, "lifecycle.lock", "owner.json"), JSON.stringify({ pid: 2147483647, processStart: "dead" }));
  await writeFile(join(options.root, "server.json"), JSON.stringify({ managedBy: "pi-mlx-core-provider", pid: foreign.pid, processStart: "wrong identity", port: 1234, apiBaseUrl: "http://127.0.0.1:1234/v1" }));
  const manager = createLifecycle(options);
  let serverPid: number | undefined;
  try {
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(manager.ensure(aborted.signal));
    const state = await manager.ensure(); serverPid = state.pid;
    assert.notEqual(state.pid, foreign.pid); assert.ok(alive(foreign.pid!));
    const configMismatch = createLifecycle({ ...options, contextTokens: 8192 });
    await assert.rejects(configMismatch.ensure(), /configuration differs/);
    await configMismatch.dispose("reload");
    await manager.release();
    await until(() => !alive(state.pid));
    assert.ok(alive(foreign.pid!));
    await manager.dispose("quit");
  } finally {
    await manager.dispose("quit");
    const exited = once(foreign, "exit"); foreign.kill(); await exited;
    await settleIsolated(root, serverPid);
  }
});

test("reload handoff keeps the same server and quit releases the replacement lease", { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-reload-"));
  const binary = join(root, "mlx-serve");
  await writeFile(binary, fixture, { mode: 0o755 });
  const options = { root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 5000 };
  const old = createLifecycle(options);
  const fresh = createLifecycle(options);
  let pid: number | undefined;
  try {
    pid = (await old.ensure()).pid;
    await old.dispose("reload");
    assert.ok(alive(pid));
    assert.equal((await fresh.ensure()).pid, pid);
    await assert.rejects(old.ensure(), /disposed/);
    await fresh.dispose("quit");
    await until(() => !alive(pid!));
  } finally {
    await old.dispose("quit"); await fresh.dispose("quit");
    await settleIsolated(root, pid);
  }
});

test("last lease release and new client race never leaves a dead endpoint", { timeout: 20000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-race-"));
  const binary = join(root, "mlx-serve");
  await writeFile(binary, fixture, { mode: 0o755 });
  const options = { root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 5000 };
  const first = createLifecycle(options);
  const next = fork(fileURLToPath(new URL("./client.ts", import.meta.url)), [], {
    env: { ...process.env, MLX_TEST_OPTIONS: JSON.stringify(options) }, stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  let pid: number | undefined;
  try {
    await once(next, "message");
    pid = (await first.ensure()).pid;
    const [, response] = await Promise.all([first.release(), send(next, "ensure")]);
    assert.equal((await send(next, "ensure")).state.pid, response.state.pid);
    assert.ok((await createLifecycle(options).status()).healthy);
    const exited = once(next, "exit"); await send(next, "quit"); await exited;
    await until(() => !alive(response.state.pid));
  } finally {
    if (next.exitCode === null) { const exited = once(next, "exit"); next.kill(); await exited; }
    await first.dispose("quit");
    await settleIsolated(root, pid);
  }
});

test("spawn failure and readiness timeout report errors without adopting stale state", { timeout: 20000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-failure-"));
  const binary = join(root, "mlx-serve");
  const options = { root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 1000 };
  const manager = createLifecycle(options);
  let pid: number | undefined;
  try {
    await assert.rejects(manager.ensure(), /ENOENT/);
    await writeFile(binary, fixture.replace("server.listen(port, '127.0.0.1');", "setInterval(() => {}, 1000);"), { mode: 0o755 });
    await assert.rejects(manager.ensure(), /Timed out waiting/);
    const status = await manager.status();
    pid = status.state?.pid;
    assert.equal(status.healthy, false);
    assert.equal(await readFile(join(options.root, "server.json"), "utf8").then(JSON.parse).then(s => s.pid), pid);
  } finally {
    await manager.dispose("quit");
    await settleIsolated(root, pid);
  }
});

test("status checks identity and HTTP readiness, without starting a server", { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-status-"));
  const binary = join(root, "mlx-serve");
  await writeFile(binary, fixture, { mode: 0o755 });
  const options = { root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 5000 };
  const manager = createLifecycle(options);
  let pid: number | undefined;
  try {
    assert.deepEqual(await manager.status(), { state: undefined, healthy: false });
    const state = await manager.ensure(); pid = state.pid;
    assert.equal((await manager.status()).healthy, true);
    await writeFile(join(options.root, "server.json"), JSON.stringify({ ...state, processStart: "wrong" }));
    assert.equal((await manager.status()).healthy, false);
  } finally {
    await manager.dispose("quit");
    await settleIsolated(root, pid);
  }
});

test("one caller cancellation does not cancel another caller's readiness wait", { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-abort-"));
  const binary = join(root, "mlx-serve");
  await writeFile(binary, fixture.replace("server.listen(port, '127.0.0.1');", "setTimeout(() => server.listen(port, '127.0.0.1'), 1200);"), { mode: 0o755 });
  const manager = createLifecycle({ root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 5000 });
  const controller = new AbortController();
  const firstMessages: string[] = [];
  const nextMessages: string[] = [];
  let pid: number | undefined;
  try {
    const cancelled = manager.ensure(controller.signal, message => firstMessages.push(message));
    const retained = manager.ensure(undefined, message => nextMessages.push(message));
    controller.abort();
    await assert.rejects(cancelled);
    const firstAtAbort = firstMessages.length;
    pid = (await retained).pid;
    assert.equal(firstMessages.length, firstAtAbort, "cancelled request must not receive late readiness");
    assert.ok(nextMessages.some(message => message.includes("starting")), "remaining caller receives readiness progress");
    assert.equal((await manager.status()).healthy, true);
  } finally {
    await manager.dispose("quit");
    await settleIsolated(root, pid);
  }
});

test("shutdown cancels a pending readiness wait", { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-shutdown-"));
  const binary = join(root, "mlx-serve");
  await writeFile(binary, fixture.replace("server.listen(port, '127.0.0.1');", "setInterval(() => {}, 1000);"), { mode: 0o755 });
  const options = { root: join(root, "state"), binary, modelDir: join(root, "models"), watchdog, contextTokens: 32768, readyTimeoutMs: 10000 };
  const manager = createLifecycle(options);
  let pid: number | undefined;
  try {
    const pending = manager.ensure();
    const rejected = assert.rejects(pending, /cancelled/);
    await until(async () => !!(await manager.status()).state);
    pid = (await manager.status()).state?.pid;
    await manager.dispose("quit");
    await rejected;
  } finally {
    await manager.dispose("quit");
    await settleIsolated(root, pid);
  }
});

test("log tail is bounded and missing logs stay local", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-log-"));
  try {
    const path = join(root, "log");
    assert.match((await readLogTail(path))[0], /No log yet/);
    await writeFile(path, "not retained\n".repeat(30000) + "last synthetic line\n");
    const lines = await readLogTail(path);
    assert.ok(lines.length <= 2000);
    assert.ok(lines.some(line => line.includes("last synthetic line")));
    assert.ok(lines.length < 30000);
  } finally { await trash(root); }
});

test("catalog ignores incomplete weights, remote ids, and non-chat models", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-catalog-"));
  try {
    for (const [name, type, complete] of [["good", "qwen3_5", true], ["partial", "qwen3_5", false], ["bad@peer", "qwen3_5", true], ["embedding", "bert", true], ["llama", "llama", true], ["media", "AudioVideo", true], ["no-template", "mistral", true]] as const) {
      const dir = join(root, "org", name); await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "config.json"), JSON.stringify({ model_type: type, text_config: { max_position_embeddings: 262144 } }));
      if (name !== "no-template") await writeFile(join(dir, "chat_template.jinja"), "enable_thinking");
      if (complete) await writeFile(join(dir, "model.safetensors"), "fixture");
    }
    const found = await discoverModels(root, 32768);
    assert.deepEqual(found.map(m => m.id), ["org/good", "org/llama"]);
    assert.equal(found[1].reasoning, false);
    assert.equal(found[0].contextWindow, 32768); assert.equal(found[0].reasoning, true);
  } finally { await trash(root); }
});
