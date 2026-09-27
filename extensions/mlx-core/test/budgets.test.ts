import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReasoningBudget } from "../budgets.ts";

test("high thinking preserves answer space rather than consuming the whole output", () => {
  const input = { max_tokens: 32768, enable_thinking: true, reasoning_effort: "high", messages: [] };
  assert.deepEqual(applyReasoningBudget(input, 8192), { ...input, reasoning_budget_tokens: 24576 });
  assert.equal("reasoning_budget_tokens" in input, false, "don't mutate instrumentation's payload");
});
test("low/medium retain their normal budgets; small output caps scale the reserve", () => {
  const base = { max_tokens: 32768, enable_thinking: true };
  assert.equal((applyReasoningBudget({ ...base, reasoning_effort: "medium" }, 8192) as any).reasoning_budget_tokens, 8192);
  assert.equal((applyReasoningBudget({ ...base, reasoning_effort: "low" }, 8192) as any).reasoning_budget_tokens, 2048);
  assert.equal((applyReasoningBudget({ ...base, max_tokens: 256, reasoning_effort: "high" }, 8192) as any).reasoning_budget_tokens, 192);
});
test("explicit smaller budgets survive, oversized budgets are bounded, thinking off is unchanged", () => {
  const input = { max_tokens: 32768, enable_thinking: true, reasoning_effort: "high", reasoning_budget_tokens: 100 };
  assert.equal((applyReasoningBudget(input, 8192) as any).reasoning_budget_tokens, 100);
  assert.equal((applyReasoningBudget({ ...input, reasoning_budget_tokens: 99999 }, 8192) as any).reasoning_budget_tokens, 24576);
  const off = { max_tokens: 32768, enable_thinking: false };
  assert.equal(applyReasoningBudget(off, 8192), off);
});
