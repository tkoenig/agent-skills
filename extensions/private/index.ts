import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("private", {
    description: "Start a fresh session named Private using local Qwen",
    handler: async (args, ctx) => {
      const finish = args.trim() === "--finish";
      if (args.trim() && !finish) {
        ctx.ui.notify("Use /private without arguments, then ask in the new session.", "warning");
        return;
      }
      const model = ctx.modelRegistry.find("mlx-core", "mlx-community/Qwen3.8-27B-4bit");
      if (!model) {
        ctx.ui.notify("Local Qwen is unavailable. Check mlx-core and the installed model.", "error");
        return;
      }
      if (finish) {
        if (ctx.sessionManager.getBranch().some(entry => entry.type === "message" && entry.message.role !== "system")) {
          ctx.ui.notify("Use /private without arguments to start a fresh session.", "warning");
          return;
        }
        if (await pi.setModel(model)) pi.setSessionName("Private");
        else ctx.ui.notify("Could not select local Qwen. No prompt was sent.", "error");
        return;
      }
      await ctx.waitForIdle();
      await ctx.newSession({
        // Session replacement invalidates the old pi API. Invoke the finishing
        // step on the replacement runtime; this is a command, not an LLM prompt.
        withSession: async fresh => { await fresh.sendUserMessage("/private --finish", { expandPromptTemplates: true }); },
      });
    },
  });
}
