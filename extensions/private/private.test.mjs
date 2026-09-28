import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { installPrivateGuards } from "./guards.mjs";
import { isPrivateModel, MODEL, MODEL_REF, privateArgs, privateEnv, shellQuote } from "./policy.mjs";

const model = { provider: "mlx-core", id: MODEL, api: "openai-completions", baseUrl: "http://127.0.0.1:1/v1" };

test("only the pinned local model and provider endpoint pass", () => {
  assert.ok(isPrivateModel(model));
  for (const bad of [undefined, {}, { ...model, provider: "openai" }, { ...model, id: "other" }, { ...model, baseUrl: "https://example.com/v1" }, { ...model, api: "other" }]) {
    assert.equal(isPrivateModel(bad), false);
  }
});

test("environment is an allowlist and cannot inherit credentials or parent routing", () => {
  const env = privateEnv("/home/user", "/profile", {
    OPENAI_API_KEY: "synthetic-test-value", ANTHROPIC_API_KEY: "synthetic-test-value",
    NODE_OPTIONS: "--import=evil.js", HTTPS_PROXY: "http://example.com", PI_INTERCOM_SESSION_ID: "parent",
    PI_CODING_AGENT_DIR: "/parent", PI_MLX_CORE_DIR: "/other", TERM: "xterm", TERM_PROGRAM: "ghostty",
  });
  assert.deepEqual(Object.keys(env).sort(), ["COLORTERM", "HOME", "LANG", "PATH", "PI_CODING_AGENT_DIR", "PI_OFFLINE", "PI_PRIVATE_PROFILE", "TERM", "TERM_PROGRAM"].sort());
  assert.equal(env.PI_CODING_AGENT_DIR, "/profile");
  assert.equal(env.PI_OFFLINE, "1");
});

test("launch cannot inherit context, tools, sessions, or discovered integrations", () => {
  const args = privateArgs("/pi/cli.js", "/private/runtime.ts", "/private/SYSTEM.md");
  for (const flag of ["--no-context-files", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-tools", "--no-session", "--no-approve", "--offline"]) assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf("--models") + 1], MODEL_REF);
  assert.equal(args.filter(x => x === "--extension").length, 1);
  assert.ok(!args.includes("--resume") && !args.includes("--continue"));
});

test("shell quoting preserves paths without expanding shell syntax", () => {
  const value = "/test/a'b $(printf unsafe); /a b";
  const result = spawnSync("/bin/sh", ["-c", `printf %s ${shellQuote(value)}`], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, value);
});

function harness() {
  const handlers = new Map();
  let tools = [];
  const pi = { on: (name, fn) => handlers.set(name, fn), setActiveTools: next => { tools = next; }, getActiveTools: () => tools };
  installPrivateGuards(pi, () => { throw new Error("REFUSED"); });
  const ctx = { model, sessionManager: { getSessionFile: () => undefined }, ui: { setStatus() {} } };
  return { handlers, pi, ctx };
}

test("guards refuse cloud selection, cloud requests, persistence, and tool activation", () => {
  const { handlers: h, pi, ctx } = harness();
  h.get("session_start")({}, ctx);
  h.get("before_agent_start")({}, ctx);
  h.get("before_provider_request")({}, ctx);
  assert.throws(() => h.get("model_select")({ model: { ...model, provider: "openai" } }), /REFUSED/);
  assert.throws(() => h.get("before_provider_request")({}, { ...ctx, model: { ...model, provider: "openai" } }), /REFUSED/);
  assert.throws(() => h.get("session_start")({}, { ...ctx, sessionManager: { getSessionFile: () => "/saved.jsonl" } }), /REFUSED/);
  const saved = { ...ctx, sessionManager: { getSessionFile: () => "/saved.jsonl" } };
  for (const event of ["session_switch", "session_fork", "before_provider_request", "before_agent_start"]) {
    assert.throws(() => h.get(event)({}, saved), /REFUSED/);
  }
  pi.setActiveTools(["read"]);
  assert.throws(() => h.get("before_agent_start")({}, ctx), /REFUSED/);
});

test("tools and user shell escapes are denied", () => {
  const { handlers: h } = harness();
  assert.equal(h.get("tool_call")().block, true);
  assert.equal(h.get("user_bash")().result.exitCode, 1);
});

test("runtime exits rather than throwing when not launched with the private profile", () => {
  const url = new URL("./runtime.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import runtime from ${JSON.stringify(url)}; await runtime({});`], { env: {}, encoding: "utf8" });
  assert.equal(result.status, 78, result.stderr);
  assert.match(result.stderr, /No fallback/);
});

test("slash command refuses arguments without echoing or forwarding them", async () => {
  const { default: command } = await import("./index.ts");
  let handler;
  command({ registerCommand: (name, definition) => { assert.equal(name, "private"); handler = definition.handler; } });
  const notices = [];
  await handler("synthetic-private-input", { ui: { notify: message => notices.push(message) } });
  assert.equal(notices.length, 1);
  assert.match(notices[0], /without arguments/);
  assert.ok(!notices[0].includes("synthetic-private-input"));
});
