import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
  const savedDir = join(process.cwd(), ".pi", "saved-sessions");

  function ensureDir() {
    if (!existsSync(savedDir)) {
      mkdirSync(savedDir, { recursive: true });
    }
  }

  function slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getConversationSummary(ctx: any): string {
    const snippets: string[] = [];
    let chars = 0;
    const maxChars = 2000;

    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg.role !== "user" && msg.role !== "assistant") continue;

      let text: string | undefined;
      if (typeof msg.content === "string") {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textBlock = msg.content.find((b: any) => b.type === "text");
        if (textBlock) text = textBlock.text;
      }

      if (text) {
        const truncated = text.slice(0, 200);
        snippets.push(`${msg.role}: ${truncated}`);
        chars += truncated.length;
        if (chars >= maxChars) break;
      }
    }

    return snippets.join("\n");
  }

  async function generateName(ctx: any): Promise<string | undefined> {
    const summary = getConversationSummary(ctx);
    if (!summary) return undefined;

    const model = ctx.model;
    const modelFlag = model ? `${model.provider}/${model.id}` : "";

    const prompt =
      `Given this conversation, generate a short descriptive session name (max 80 chars). ` +
      `Use natural language, not kebab-case. Be concise and descriptive. ` +
      `Reply with ONLY the name, nothing else.\n\n${summary}`;

    try {
      const result = await pi.exec(
        "pi",
        [
          "-p",
          "--no-session",
          "--no-tools",
          "--thinking", "off",
          ...(modelFlag ? ["--model", modelFlag] : []),
          prompt,
        ],
        { timeout: 15000 }
      );

      if (result.code !== 0 || !result.stdout.trim()) return undefined;

      return result.stdout.trim().split("\n")[0].replace(/[`"']/g, "").slice(0, 80) || undefined;
    } catch {
      return undefined;
    }
  }

  // /save [name] — save session with a name for easy resuming
  pi.registerCommand("save", {
    description: "Name this session and create a symlink for easy resuming via /resume or CLI",
    handler: async (args, ctx) => {
      const sessionFile = ctx.sessionManager.getSessionFile();
      if (!sessionFile) {
        ctx.ui.notify("No session file (ephemeral mode)", "error");
        return;
      }

      let name = args?.trim();
      if (!name) {
        ctx.ui.setWidget("save", ["⏳ Generating name..."]);
        const generated = await generateName(ctx);
        ctx.ui.setWidget("save", undefined);

        if (generated) {
          const choice = await ctx.ui.select("Save session", [
            `Save as: ${generated}`,
            "Edit suggested name",
            "Cancel",
          ]);

          if (choice === `Save as: ${generated}`) {
            name = generated;
          } else if (choice === "Edit suggested name") {
            name = (await ctx.ui.editor("Edit session name:", generated))?.trim();
            if (!name) {
              ctx.ui.notify("Cancelled", "warning");
              return;
            }
          } else {
            ctx.ui.notify("Cancelled", "warning");
            return;
          }
        } else {
          name = await ctx.ui.input("Session name:");
          if (!name) {
            ctx.ui.notify("Cancelled", "warning");
            return;
          }
        }
      }

      if (!name) {
        ctx.ui.notify("Invalid name", "error");
        return;
      }

      const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const displayName = `${name} (${date})`;
      pi.setSessionName(displayName);

      const slugName = slugify(name);
      ensureDir();
      const linkPath = join(savedDir, `${slugName}.jsonl`);

      if (existsSync(linkPath)) {
        const overwrite = await ctx.ui.confirm("Overwrite?", `Saved session "${slugName}" already exists. Overwrite?`);
        if (!overwrite) return;
        unlinkSync(linkPath);
      }

      try {
        symlinkSync(sessionFile, linkPath);
        ctx.ui.notify(`Saved "${displayName}" — use /resume or: pi --session .pi/saved-sessions/${slugName}.jsonl`, "info");
      } catch (err: any) {
        ctx.ui.notify(`Failed: ${err.message}`, "error");
      }
    },
  });
}
