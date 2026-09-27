// mlx-serve shares max_tokens between reasoning and the visible answer.
// Its explicit reasoning_budget_tokens closes the thinking block at the budget.
export function applyReasoningBudget(payload: unknown, reserveTokens: number): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const body = payload as Record<string, unknown>;
  if (body.enable_thinking !== true) return payload;
  const maxTokens = Number(body.max_tokens);
  if (!Number.isSafeInteger(maxTokens) || maxTokens <= 1) return payload;
  const reserve = Math.min(reserveTokens, Math.max(1, Math.floor(maxTokens / 4)));
  const ceiling = maxTokens - reserve;
  const budgets: Record<string, number> = { minimal: 1024, low: 2048, medium: 8192 };
  const effort = typeof body.reasoning_effort === "string" ? body.reasoning_effort : "low";
  const requested = Number.isSafeInteger(body.reasoning_budget_tokens) && Number(body.reasoning_budget_tokens) >= 0
    ? Number(body.reasoning_budget_tokens) : (budgets[effort] ?? ceiling);
  return { ...body, reasoning_budget_tokens: Math.min(requested, ceiling) };
}
