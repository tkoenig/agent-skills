// Test normal configuration with synthetic input only. Never queries Contacts.
// node extensions/private/smoke.mjs /absolute/path/to/installed/pi
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePiCli } from "./cli-path.mjs";

const cli = resolvePiCli(process.argv[2]);
const root = dirname(fileURLToPath(import.meta.url));
const workspace = realpathSync(mkdtempSync(join(tmpdir(), "pi-local-shell-smoke-")));
const sessions = join(workspace, "sessions");
mkdirSync(sessions);
const agentDir = resolve(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"));
const result = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(root, "launch.mjs"), cli, workspace, agentDir], {
    env: { ...process.env, PI_CODING_AGENT_SESSION_DIR: sessions }, stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Launcher smoke timed out")); }, 240000);
  child.stdout.on("data", data => { stdout += data; });
  child.stderr.on("data", data => { stderr += data; });
  child.once("error", error => { clearTimeout(timer); reject(error); });
  child.once("exit", code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  child.stdin.end("Use the bash tool to run exactly: printf PRIVATE_SHELL_SMOKE_OK\nThen reply with the command output. Do not use any other tools or read any files. This is a synthetic launcher test.\n");
});
assert.equal(result.code, 0, `Launcher failed (exit ${result.code}); inspect the synthetic test locally.`);
assert.match(result.stdout, /PRIVATE_SHELL_SMOKE_OK/);
assert.ok(!result.stderr.includes("Offline mode enabled, skipping download"), "unexpected offline helper warning");
const files = readdirSync(sessions, { recursive: true }).filter(name => String(name).endsWith(".jsonl"));
assert.equal(files.length, 1, "expected one persisted synthetic Pi session");
const entries = readFileSync(join(sessions, files[0]), "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
const messages = entries.filter(entry => entry.type === "message").map(entry => entry.message);
const replies = messages.filter(message => message.role === "assistant");
assert.ok(replies.length > 0 && replies.every(message => message.provider === "mlx-core"), "non-local or missing model reply");
const calls = replies.flatMap(message => message.content).filter(part => part.type === "toolCall");
assert.ok(calls.some(call => call.name === "bash" && call.arguments.command.includes("printf PRIVATE_SHELL_SMOKE_OK")), "missing synthetic shell call");
assert.ok(calls.every(call => call.name === "bash"), "unexpected tool invocation; inspect the synthetic test locally");
assert.ok(messages.some(message => message.role === "toolResult" && message.toolName === "bash" && !message.isError && message.content.some(part => part.type === "text" && part.text.includes("PRIVATE_SHELL_SMOKE_OK"))), "missing successful shell result");
console.log("PASS: actual launcher, local model, normal Bash access, saved session, no offline-helper warning");
console.log(`Synthetic test session retained at ${sessions}`);
