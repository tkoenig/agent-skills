import assert from "node:assert/strict";
import test from "node:test";
import register from "./index.ts";

const local = { provider: "mlx-core", id: "mlx-community/Qwen3.8-27B-4bit" };
function harness({ available = true, cancelled = false, select = true, history = [] } = {}) {
  const events = [], notices = [];
  let handler;
  register({
    registerCommand: (name, definition) => { assert.equal(name, "private"); handler = definition.handler; },
    setModel: async model => { events.push(["model", model]); return select; },
    setSessionName: name => events.push(["name", name]),
  });
  const ctx = {
    ui: { notify: message => notices.push(message) },
    modelRegistry: { find: (provider, id) => { assert.equal(provider, local.provider); assert.equal(id, local.id); return available ? local : undefined; } },
    sessionManager: { getBranch: () => history },
    waitForIdle: async () => { events.push(["idle"]); },
    newSession: async options => {
      events.push(["new"]);
      if (!cancelled) await options.withSession({
        sendUserMessage: async (command, options) => {
          assert.equal(command, "/private --finish");
          assert.equal(options.expandPromptTemplates, true, "must dispatch a command, not send an LLM prompt");
          events.push(["dispatch"]);
          await handler("--finish", ctx);
        },
      });
      return { cancelled };
    },
  };
  return { run: args => handler(args, ctx), events, notices };
}

test("new session first, then select/name on the replacement runtime", async () => {
  const h = harness(); await h.run("");
  assert.deepEqual(h.events, [["idle"], ["new"], ["dispatch"], ["model", local], ["name", "Private"]]);
});

test("missing local model leaves the current session alone", async () => {
  const h = harness({ available: false }); await h.run("");
  assert.deepEqual(h.events, []); assert.match(h.notices[0], /unavailable/);
});

test("cancelled replacement never changes the original model or name", async () => {
  const h = harness({ cancelled: true }); await h.run("");
  assert.deepEqual(h.events, [["idle"], ["new"]]);
});

test("model selection failure is reported without naming or sending a prompt", async () => {
  const h = harness({ select: false }); await h.run("--finish");
  assert.deepEqual(h.events, [["model", local]]); assert.match(h.notices[0], /Could not select/);
});

test("internal finish cannot reuse a conversation, but permits system metadata", async () => {
  const h = harness({ history: [{ type: "message", message: { role: "user" } }] });
  await h.run("--finish"); assert.deepEqual(h.events, []);
  const empty = harness({ history: [{ type: "message", message: { role: "system" } }] });
  await empty.run("--finish"); assert.equal(empty.events[0][0], "model");
});

test("arbitrary prompt arguments are not forwarded", async () => {
  const h = harness(); await h.run("synthetic-private-input");
  assert.deepEqual(h.events, []); assert.ok(!h.notices[0].includes("synthetic-private-input"));
});
