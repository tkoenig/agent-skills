import { test } from "node:test";
import assert from "node:assert/strict";
import { fork, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, writeFile, readFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { createLifecycle, trash } from "../lifecycle.ts";
import { discoverModels } from "../catalog.ts";
const watchdog = fileURLToPath(new URL("../mlx-watchdog.sh", import.meta.url));
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
    for (const child of children) if (child.exitCode === null) child.kill();
    if (serverPid && alive(serverPid)) process.kill(serverPid, "SIGTERM");
    await trash(root);
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
    if (serverPid && alive(serverPid)) process.kill(serverPid, "SIGTERM");
    const exited = once(foreign, "exit"); foreign.kill(); await exited;
    await trash(root);
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
    if (pid && alive(pid)) process.kill(pid, "SIGTERM");
    await trash(root);
  }
});

test("catalog ignores incomplete weights, remote ids, and non-chat models", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-mlx-catalog-"));
  try {
    for (const [name, type, complete] of [["good", "qwen3_5", true], ["partial", "qwen3_5", false], ["bad@peer", "qwen3_5", true], ["embedding", "bert", true]] as const) {
      const dir = join(root, "org", name); await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "config.json"), JSON.stringify({ model_type: type, text_config: { max_position_embeddings: 262144 } }));
      await writeFile(join(dir, "chat_template.jinja"), "enable_thinking");
      if (complete) await writeFile(join(dir, "model.safetensors"), "fixture");
    }
    const found = await discoverModels(root, 32768);
    assert.deepEqual(found.map(m => m.id), ["org/good"]);
    assert.equal(found[0].contextWindow, 32768); assert.equal(found[0].reasoning, true);
  } finally { await trash(root); }
});
