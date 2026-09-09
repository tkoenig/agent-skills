import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

// Test lifecycle behavior without pi, a terminal, real timers, or GitHub access.
const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8"))
  .replace(/^import .* from .*;$/gm, "")
  .replace("export default function", "function extension");

function harness() {
  const events = new Map();
  const commands = new Map();
  const timers = new Map();
  const requests = [];
  let stale = false;
  let statuses = 0;
  let notifications = 0;
  const check = () => assert.equal(stale, false, "accessed stale context");
  const ctx = {
    cwd: "/test", hasUI: false,
    isIdle() { check(); return true; },
    ui: {
      setStatus() { check(); statuses++; },
      notify() { check(); notifications++; },
    },
  };
  const pi = {
    on: (name, handler) => events.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command.handler),
    exec(_command, _args, options) {
      check();
      return new Promise((resolve, reject) => requests.push({ resolve, reject, signal: options.signal }));
    },
  };
  runInNewContext(`${source}\nextension(pi);`, {
    pi, AbortController,
    setTimeout(callback, delay) { const id = {}; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    timers, requests,
    get statuses() { return statuses; },
    get notifications() { return notifications; },
    start: () => events.get("session_start")({}, ctx),
    async stop(reason) { await events.get("session_shutdown")({ reason }, ctx); stale = true; },
    command: (args) => commands.get("current-pr")(args, ctx),
    fire() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
      return timer.callback;
    },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const noPr = { code: 1, stdout: "", stderr: "" };
const pr = { code: 0, stdout: JSON.stringify({ number: 1, url: "https://github.com/a/b/pull/1", state: "OPEN" }) };

for (const reason of ["reload", "new", "resume", "fork", "quit"]) {
  for (const outcome of ["reject", "success"]) {
    test(`${reason}: in-flight ${outcome} cannot revive polling`, async () => {
      const h = harness();
      await h.start();
      const lateCallback = h.fire();
      await h.stop(reason);
      assert.equal(h.requests[0].signal.aborted, true);
      if (outcome === "reject") h.requests[0].reject(new Error("aborted"));
      else h.requests[0].resolve(pr);
      await flush();
      lateCallback(); // Even an already-queued callback must be harmless.
      await flush();
      assert.equal(h.timers.size, 0);
      assert.equal(h.requests.length, 1);
      assert.equal(h.statuses, 0);
      await h.stop(reason); // Idempotent cleanup.
    });
  }
}

test("shutdown clears startup timer", async () => {
  const h = harness();
  await h.start();
  await h.stop("reload");
  assert.equal(h.timers.size, 0);
  assert.equal(h.requests.length, 0);
});

for (const args of ["", "https://github.com/a/b/pull/1"]) {
  test(`command ${JSON.stringify(args)} skips notification after shutdown`, async () => {
    const h = harness();
    await h.start();
    const command = h.command(args);
    await h.stop("reload");
    h.requests[0].resolve(pr);
    await command;
    assert.equal(h.notifications, 0);
    assert.equal(h.timers.size, 0);
  });
}

test("active instance polls normally, including after replacement", async () => {
  const old = harness();
  await old.start();
  await old.stop("new");
  const h = harness();
  await h.start();
  h.fire();
  h.requests[0].resolve(noPr);
  await flush();
  assert.equal(h.statuses, 1);
  assert.equal([...h.timers.values()][0].delay, 300_000);
  h.fire();
  h.requests[1].resolve(pr);
  await flush();
  assert.equal(h.requests.length, 3); // review threads
  h.requests[2].resolve({ code: 0, stdout: "{}" });
  await flush();
  assert.equal(h.statuses, 2);
  assert.equal([...h.timers.values()][0].delay, 30_000);
  await h.stop("quit");
});
