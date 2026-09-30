// Exercise the real command without making any model requests.
// node extensions/private/smoke.mjs "$(mise which pi)"
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const profile = realpathSync(mkdtempSync(join(tmpdir(), "pi-private-shortcut-")));
writeFileSync(join(profile, "settings.json"), JSON.stringify({
  extensions: [join(root, "../mlx-core/index.ts"), join(root, "index.ts")],
}));
const child = spawn(process.execPath, [realpathSync(process.argv[2]), "--mode", "rpc", "--no-context-files", "--provider", "openai", "--model", "gpt-4o"], {
  cwd: profile, env: { ...process.env, PI_CODING_AGENT_DIR: profile, PI_OFFLINE: "1" }, stdio: ["pipe", "pipe", "pipe"],
});
let buffer = "", stderr = "", seq = 0, modelStarted = false;
const pending = new Map();
child.stderr.on("data", data => { stderr += data; });
child.stdout.on("data", data => {
  buffer += data;
  let end;
  while ((end = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "agent_start") modelStarted = true;
    const request = pending.get(event.id);
    if (event.type === "response" && request) {
      pending.delete(event.id);
      if (event.success) request.resolve(event.data);
      else request.reject(new Error(event.error));
    }
  }
});
child.on("error", error => { for (const request of pending.values()) request.reject(error); });
child.on("exit", () => { for (const request of pending.values()) request.reject(new Error(`Pi exited: ${stderr}`)); });
const timeout = setTimeout(() => { child.kill("SIGTERM"); }, 30000);
function call(type, data = {}) {
  return new Promise((resolve, reject) => {
    const id = String(++seq); pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ id, type, ...data }) + "\n");
  });
}
try {
  const before = await call("get_state");
  await call("bash", { command: "printf SHORTCUT_PARENT_CANARY" });
  const original = await call("get_messages");
  assert.ok(original.messages.some(message => message.role !== "system"));
  await call("prompt", { message: "/private" });
  const after = await call("get_state");
  assert.notEqual(after.sessionId, before.sessionId);
  assert.equal(after.sessionName, "Private");
  assert.equal(after.model.provider, "mlx-core");
  assert.equal(after.model.id, "mlx-community/Qwen3.8-27B-4bit");
  const messages = await call("get_messages");
  assert.equal(messages.messages.filter(message => message.role !== "system").length, 0);
  assert.equal(modelStarted, false);
  console.log("PASS: real /private creates a fresh named local session in place, with zero messages/model requests");
} finally {
  clearTimeout(timeout);
  child.stdin.end();
}
