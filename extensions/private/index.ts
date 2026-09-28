import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { shellQuote } from "./policy.mjs";
import { resolvePiCli } from "./cli-path.mjs";

const exec = promisify(execFile);
export const GHOSTTY_SCRIPT = `on run argv
  tell application "Ghostty"
    set config to new surface configuration
    set command of config to item 1 of argv
    set initial working directory of config to "/"
    set wait after command of config to true
    set privateWindow to new window with configuration config
    activate window privateWindow
  end tell
end run`;

export default function (pi: ExtensionAPI) {
  let opening = false;
  pi.registerCommand("private", {
    description: "Open normal Pi with local Qwen in Ghostty (same tools/config, fresh conversation)",
    handler: async (args, ctx) => {
      if (args.trim()) {
        ctx.ui.notify("Use /private without arguments. Ask your question in the new local window; nothing is forwarded.", "warning");
        return;
      }
      if (opening) return;
      opening = true;
      try {
        const launcher = join(dirname(fileURLToPath(import.meta.url)), "launch.mjs");
        await access(launcher);
        await access("/Applications/Ghostty.app");
        // Preserve the normal working/config directories, not conversation history.
        // Dynamic values are argv, not interpolated AppleScript.
        const cli = resolvePiCli(process.argv[1]);
        const agentDir = resolve(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"));
        const command = [process.execPath, launcher, cli, ctx.cwd, agentDir].map(shellQuote).join(" ");
        await exec("/usr/bin/osascript", ["-e", GHOSTTY_SCRIPT, "--", command], { timeout: 15000, maxBuffer: 4096 });
        ctx.ui.notify("Opened local-model Pi with normal tools, configuration, and session saving. No conversation history was forwarded.", "info");
      } catch {
        ctx.ui.notify("Could not open private chat. Requires an npm-installed Pi CLI, Ghostty 1.3+, and macOS Automation permission. No fallback or context forwarding was attempted.", "error");
      } finally {
        opening = false;
      }
    },
  });
}
