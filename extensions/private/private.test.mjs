import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolvePiCli } from "./cli-path.mjs";
import { installLocalModelGuard } from "./guards.mjs";
import { isLocalModel, MODEL, privateArgs, shellQuote } from "./policy.mjs";

function cliFixture(layout = "dist/bundle/cli.js", name = "@earendil-works/pi-coding-agent") {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "private-cli-test-")));
  const pkg = join(root, "package");
  const cli = join(pkg, layout);
  mkdirSync(dirname(cli), { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name, type: "module", bin: { pi: layout } }));
  writeFileSync(cli, "// Test fixture only\n");
  const link = join(root, "pi");
  symlinkSync(cli, link);
  return { root, pkg, cli, link };
}

test("CLI discovery handles bundled/unbundled installs and npm bin symlinks", () => {
  for (const layout of ["dist/cli.js", "dist/bundle/cli.js", "dist/future/layout/cli.js"]) {
    const f = cliFixture(layout);
    assert.equal(resolvePiCli(f.link), f.cli);
    assert.equal(resolvePiCli(f.cli), f.cli);
  }
});

test("CLI discovery refuses unrelated packages, undeclared entry points and relative paths", () => {
  assert.throws(() => resolvePiCli(cliFixture("dist/cli.js", "unrelated").link), /declared executable/);
  const f = cliFixture();
  const other = join(dirname(f.cli), "other.js");
  writeFileSync(other, "// not the declared bin\n");
  assert.throws(() => resolvePiCli(other), /declared executable/);
  assert.throws(() => resolvePiCli("bin/pi"), /absolute/);
});

test("actual launcher preserves working directory, normal agent profile and environment", () => {
  const f = cliFixture();
  const agentDir = join(f.root, "agent");
  mkdirSync(agentDir);
  writeFileSync(f.cli, `console.log('LAUNCH_PROBE=' + JSON.stringify({args:process.argv.slice(2),env:process.env,cwd:process.cwd()}));`);
  const launcher = fileURLToPath(new URL("./launch.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [launcher, f.link, f.root, agentDir], {
    env: { HOME: f.root, OPENAI_API_KEY: "synthetic-canary", PATH: "/synthetic/bin:/usr/bin" },
    encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  const line = result.stdout.split("\n").find(line => line.startsWith("LAUNCH_PROBE="));
  assert.ok(line, "launcher never reached the declared bundled CLI");
  const probe = JSON.parse(line.slice("LAUNCH_PROBE=".length));
  assert.equal(probe.cwd, f.root);
  assert.equal(probe.env.PI_CODING_AGENT_DIR, agentDir);
  assert.equal(probe.env.OPENAI_API_KEY, "synthetic-canary");
  assert.equal(probe.env.PATH, "/synthetic/bin:/usr/bin");
  assert.ok(probe.args.includes(MODEL));
  assert.ok(!probe.args.some(arg => arg.startsWith("--no-") || arg === "--offline"));
});

test("normal tools, extensions, context, and session saving are not overridden", () => {
  const args = privateArgs("/pi/cli.js", "/private/runtime.ts", "/private/SYSTEM.md");
  assert.deepEqual(args, ["/pi/cli.js", "--provider", "mlx-core", "--model", MODEL,
    "--extension", "/private/runtime.ts", "--name", "Private · local model", "--append-system-prompt", "/private/SYSTEM.md"]);
});

test("shell quoting preserves paths without expanding shell syntax", () => {
  const value = "/test/a'b $(printf unsafe); /a b";
  const result = spawnSync("/bin/sh", ["-c", `printf %s ${shellQuote(value)}`], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, value);
});

test("only conversation-model selection is guarded; shell/tools/persistence remain normal", () => {
  const handlers = new Map();
  installLocalModelGuard({ on: (name, fn) => handlers.set(name, fn) }, () => { throw new Error("REFUSED"); });
  const model = { provider: "mlx-core", id: MODEL };
  const ctx = { model, ui: { setStatus() {} } };
  for (const name of ["session_start", "before_agent_start", "before_provider_request"]) {
    handlers.get(name)({}, ctx);
    assert.throws(() => handlers.get(name)({}, { ...ctx, model: { provider: "openai" } }), /REFUSED/);
  }
  assert.throws(() => handlers.get("model_select")({ model: { provider: "openai" } }), /REFUSED/);
  assert.equal(handlers.has("tool_call"), false);
  assert.equal(handlers.has("user_bash"), false);
  assert.ok(isLocalModel(model));
  assert.ok(isLocalModel({ provider: "mlx-core", id: "another-installed-local-model" }));
  assert.equal(isLocalModel(undefined), false);
});

test("slash command refuses prompt arguments without echoing or forwarding them", async () => {
  const { default: command } = await import("./index.ts");
  let handler;
  command({ registerCommand: (name, definition) => { assert.equal(name, "private"); handler = definition.handler; } });
  const notices = [];
  await handler("synthetic-private-input", { ui: { notify: message => notices.push(message) } });
  assert.equal(notices.length, 1);
  assert.match(notices[0], /without arguments/);
  assert.ok(!notices[0].includes("synthetic-private-input"));
});
