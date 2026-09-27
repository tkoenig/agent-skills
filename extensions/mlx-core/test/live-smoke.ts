// Opt-in: starts the real local server. Synthetic prompts only; no user files/auth.
import assert from "node:assert/strict";
import { normalizeContext, type Provider, type AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import extension from "../index.ts";
let provider: Provider<any> | undefined;
let shutdown: ((event: any) => Promise<void>) | undefined;
await extension({ registerProvider: (p: Provider<any>) => { provider = p; }, registerCommand: () => {},
  on: (event: string, handler: any) => { if (event === "session_shutdown") shutdown = handler; },
} as unknown as ExtensionAPI);
assert.ok(provider);
const model = provider.getModels().find(m => m.id === "mlx-community/Qwen3.8-27B-4bit");
assert.ok(model, "download the Qwen model first");
const options = { apiKey: "mlx-local", maxTokens: 256, temperature: 0 };
async function call(context: Parameters<typeof normalizeContext>[0], override = {}): Promise<AssistantMessage> {
  const stream = provider!.streamSimple(model!, normalizeContext(context), { ...options, ...override });
  let starts = 0, terminals = 0;
  for await (const event of stream) {
    if (event.type === "start") starts++;
    if (event.type === "done" || event.type === "error") terminals++;
  }
  const result = await stream.result();
  assert.equal(terminals, 1);
  if (result.stopReason !== "aborted") {
    assert.notEqual(result.stopReason, "error", result.errorMessage);
    assert.equal(starts, 1);
    assert.ok(result.usage.input > 0 && result.usage.output > 0, "usage reported");
  }
  return result;
}
try {
  const started = Date.now();
  const text = await call({ messages: [{ role: "user", content: "Reply with only: Grüß dich 👋", timestamp: Date.now() }] });
  assert.ok(text.content.some(c => c.type === "text" && c.text.includes("Grüß")));
  console.log(`PASS text + Unicode + stream protocol + usage (${((Date.now()-started)/1000).toFixed(1)}s including cold start)`);
  const prompt = { role: "user" as const, content: "Use the add tool to add 17 and 25. Do not calculate it yourself.", timestamp: Date.now() };
  const tool = { name: "add", description: "Add two integers", parameters: Type.Object({ a: Type.Integer(), b: Type.Integer() }) };
  const answer = await call({ tools: [tool], messages: [prompt] });
  const toolCall = answer.content.find(c => c.type === "toolCall");
  assert.ok(toolCall, "expected a parsed tool call");
  assert.equal(toolCall.name, "add"); assert.deepEqual(toolCall.arguments, { a: 17, b: 25 });
  const followup = await call({ tools: [tool], messages: [prompt, answer, {
    role: "toolResult", toolCallId: toolCall.id, toolName: "add", content: [{ type: "text", text: "42" }], isError: false, timestamp: Date.now(),
  }] });
  assert.ok(followup.content.some(c => c.type === "text" && c.text.includes("42")));
  console.log("PASS parsed tool call + tool-result round trip");
  const coding = await call({ messages: [{ role: "user", content: "Write a short Python function add(a, b) that returns their sum. Include one assert example. Return the code in your final answer.", timestamp: Date.now() }] }, { reasoning: "high", maxTokens: 1024 });
  assert.equal(coding.stopReason, "stop", "high thinking must finish its visible answer");
  assert.ok(coding.content.some(c => c.type === "text" && c.text.includes("def add")));
  console.log("PASS high-thinking coding response with answer reserve");
  const controller = new AbortController();
  const pending = call({ messages: [{ role: "user", content: "Write a long story about a garden.", timestamp: Date.now() }] }, { maxTokens: 2048, signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), 1000);
  try { assert.equal((await pending).stopReason, "aborted"); }
  finally { clearTimeout(timer); }
  console.log("PASS request cancellation");
} finally { await shutdown?.({ reason: "quit" }); }
