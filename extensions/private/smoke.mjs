// Explicit integration test: synthetic text only; never reads personal records.
// node extensions/private/smoke.mjs /absolute/path/to/pi/dist/cli.js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL, privateArgs, privateEnv } from "./policy.mjs";

const cli = realpathSync(process.argv[2]);
const root = dirname(fileURLToPath(import.meta.url));
const profile = realpathSync(mkdtempSync(join(tmpdir(), "pi-private-smoke-")));
const args = privateArgs(cli, join(root, "runtime.ts"), join(root, "SYSTEM.md"));
writeFileSync(join(profile, "settings.json"), JSON.stringify({ packages: [], compaction: { enabled: false }, retry: { enabled: false } }));
function run(extra, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...args, ...extra], { cwd: profile, env: privateEnv(homedir(), profile), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Smoke test timed out")); }, timeout);
    child.stdout.on("data", data => { stdout += data; });
    child.stderr.on("data", data => { stderr += data; });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

// An unapproved provider points at a loopback trap, never a real cloud service.
let requests = 0;
const trap = createServer((_req, res) => { requests++; res.writeHead(503).end(); });
await new Promise(resolve => trap.listen(0, "127.0.0.1", resolve));
try {
  writeFileSync(join(profile, "models.json"), JSON.stringify({ providers: { "private-deny-test": {
    baseUrl: `http://127.0.0.1:${trap.address().port}/v1`, api: "openai-completions", apiKey: "synthetic-canary",
    models: [{ id: "deny-test", name: "Synthetic rejection test", contextWindow: 8192, maxTokens: 128 }],
  } } }));
  const denied = await run(["--provider", "private-deny-test", "--model", "deny-test", "--models", "private-deny-test/deny-test", "--print", "Synthetic test"], 20000);
  assert.equal(denied.code, 78, denied.stderr);
  assert.equal(requests, 0, "unapproved provider received a request");
  console.log("PASS: unapproved provider rejected before any HTTP request");
} finally { trap.close(); }

const result = await run(["--mode", "json", "--print", "Reply with exactly PRIVATE_SMOKE_OK. No explanation."]);
assert.equal(result.code, 0, result.stderr);
const events = result.stdout.split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line));
const replies = events.filter(event => event.type === "message_end" && event.message?.role === "assistant").map(event => event.message);
assert.ok(replies.some(reply => reply.model === MODEL && reply.provider === "mlx-core"), "no local model reply");
assert.ok(replies.some(reply => reply.content.some(part => part.type === "text" && part.text.includes("PRIVATE_SMOKE_OK"))), "synthetic reply missing");
assert.ok(!replies.some(reply => reply.content.some(part => part.type === "toolCall")), "unexpected tool call");
assert.ok(!readdirSync(profile, { recursive: true }).some(name => String(name).endsWith(".jsonl")), "unexpected persisted transcript");
console.log("PASS: local Qwen synthetic reply, no tool calls, no Pi transcript");
console.log(`Synthetic-only test profile retained at ${profile}`);
