import { isPrivateModel } from "./policy.mjs";

export function installPrivateGuards(pi, refuse) {
  const allowed = ctx => isPrivateModel(ctx.model) && !ctx.sessionManager.getSessionFile();
  pi.on("session_start", (_event, ctx) => {
    if (!allowed(ctx)) return refuse();
    pi.setActiveTools([]);
    ctx.ui.setStatus("private", "PRIVATE · local Qwen · no tools · no saved Pi transcript");
  });
  pi.on("model_select", (event) => { if (!isPrivateModel(event.model)) return refuse(); });
  for (const event of ["session_switch", "session_fork"]) {
    pi.on(event, (_event, ctx) => { if (!allowed(ctx)) return refuse(); });
  }
  pi.on("before_agent_start", (_event, ctx) => {
    if (!allowed(ctx) || pi.getActiveTools().length) return refuse();
  });
  // Covers requests such as manual compaction as well as ordinary turns.
  pi.on("before_provider_request", (_event, ctx) => { if (!allowed(ctx)) return refuse(); });
  pi.on("tool_call", () => ({ block: true, reason: "Private chat has no enabled tools." }));
  pi.on("user_bash", () => ({ result: { output: "Shell commands are disabled in private chat.", exitCode: 1, cancelled: false, truncated: false } }));
}
