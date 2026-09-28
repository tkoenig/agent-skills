import { test } from "node:test";
import assert from "node:assert/strict";
import { lazyStream, type AssistantMessage, type AssistantMessageEvent, type Model } from "@earendil-works/pi-ai";
import { requestWorkingStatus } from "../working-status.ts";

const model = { id: "synthetic", provider: "mlx-core", api: "openai-completions" } as Model<any>;
const result = { role: "assistant", content: [], stopReason: "stop" } as unknown as AssistantMessage;
const event = (type: AssistantMessageEvent["type"]) => ({ type } as AssistantMessageEvent);

function fakeStream(events: AssistantMessageEvent[]) {
  return {
    async *[Symbol.asyncIterator]() { for (const entry of events) yield entry; },
    async result() { return result; },
  };
}

test("delegated lazy stream restores working message at first content, preserves events and result", async () => {
  for (const content of ["text_delta", "thinking_delta", "toolcall_start"] as const) {
    const messages: (string | undefined)[] = [];
    const status = requestWorkingStatus(message => messages.push(message), undefined, () => true);
    let continueGeneration!: () => void;
    const generation = new Promise<void>(resolve => { continueGeneration = resolve; });
    const source = {
      async *[Symbol.asyncIterator]() {
        yield event("start");
        await generation;
        yield event(content);
        yield { type: "done", reason: "stop", message: result } as AssistantMessageEvent;
      },
      async result() { return result; },
    };
    const stream = lazyStream(model, async () => status.follow(source));
    status.report("Server ready; waiting for model response");
    const received: AssistantMessageEvent["type"][] = [];
    for await (const entry of stream) {
      received.push(entry.type);
      if (entry.type === "start") {
        assert.equal(messages.at(-1), "Server ready; waiting for model response");
        continueGeneration();
      }
      if (entry.type === content) assert.equal(messages.at(-1), undefined);
    }
    assert.deepEqual(received, ["start", content, "done"]);
    assert.equal(await stream.result(), result);
    assert.deepEqual(messages, ["Server ready; waiting for model response", undefined]);
  }
});

test("abort and older requests cannot repaint or clear the current status", async () => {
  const controller = new AbortController();
  const messages: (string | undefined)[] = [];
  let active = 1;
  const old = requestWorkingStatus(message => messages.push(message), controller.signal, () => active === 1);
  old.report("starting");
  active = 2;
  const current = requestWorkingStatus(message => messages.push(message), undefined, () => active === 2);
  current.report("current");
  controller.abort();
  old.report("late readiness");
  old.finish();
  assert.deepEqual(messages, ["starting", "current"]);
  const stream = lazyStream(model, async () => current.follow(fakeStream([event("start"), { type: "error", reason: "error", error: result } as AssistantMessageEvent])));
  const received: AssistantMessageEvent["type"][] = [];
  for await (const entry of stream) received.push(entry.type);
  assert.deepEqual(received, ["start", "error"]);
  assert.deepEqual(messages, ["starting", "current", undefined]);
});

test("abort clears its own status before background readiness and ignores late callbacks", () => {
  const controller = new AbortController();
  const messages: (string | undefined)[] = [];
  const status = requestWorkingStatus(message => messages.push(message), controller.signal, () => true);
  status.report("starting");
  controller.abort();
  status.report("late readiness");
  status.finish();
  assert.deepEqual(messages, ["starting", undefined]);
});
