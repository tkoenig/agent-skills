import { isLocalModel } from "./policy.mjs";

// Restrict the conversation model only. Do not modify tools, user shell
// commands, extensions, provider credentials, session storage, or network access.
export function installLocalModelGuard(pi, refuse) {
  pi.on("session_start", (_event, ctx) => {
    if (!isLocalModel(ctx.model)) return refuse();
    ctx.ui.setStatus("private", "LOCAL MODEL · normal Pi access");
  });
  pi.on("model_select", event => { if (!isLocalModel(event.model)) return refuse(); });
  for (const event of ["before_agent_start", "before_provider_request"]) {
    pi.on(event, (_event, ctx) => { if (!isLocalModel(ctx.model)) return refuse(); });
  }
}
