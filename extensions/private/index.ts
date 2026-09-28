import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { shellQuote } from "./policy.mjs";

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
    description: "Open a fresh, local-only Qwen chat in Ghostty (no context forwarding)",
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
        // Dynamic values are argv, not interpolated AppleScript. No prompt,
        // cwd, session ID, or transcript is passed to the new window.
        const command = [process.execPath, launcher, process.argv[1]].map(shellQuote).join(" ");
        await exec("/usr/bin/osascript", ["-e", GHOSTTY_SCRIPT, "--", command], { timeout: 15000, maxBuffer: 4096 });
        ctx.ui.notify("Opened a private window. Wait for the PRIVATE status before entering personal information. No chat context was forwarded.", "info");
      } catch {
        ctx.ui.notify("Could not open private chat. Ghostty 1.3+ and macOS Automation permission are required. No fallback or context forwarding was attempted.", "error");
      } finally {
        opening = false;
      }
    },
  });
}
