import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { privateArgs, privateEnv } from "./policy.mjs";

// Only the executable path is accepted. Prompts, resume flags, and arbitrary
// Pi arguments cannot cross the parent/private boundary through this launcher.
if (process.argv.length !== 3) {
  console.error("Usage: node launch.mjs /absolute/path/to/pi/dist/cli.js");
  process.exit(2);
}
const cli = realpathSync(process.argv[2]);
const pkg = JSON.parse(readFileSync(join(dirname(cli), "..", "package.json"), "utf8"));
if (pkg.name !== "@earendil-works/pi-coding-agent") throw new Error("Expected the installed Pi CLI");
const root = dirname(fileURLToPath(import.meta.url));
const home = homedir();
const state = join(home, ".pi-private");
mkdirSync(state, { recursive: true, mode: 0o700 });
chmodSync(state, 0o700);
const profile = mkdtempSync(join(state, "run-"));
chmodSync(profile, 0o700);
// Fresh settings and credential storage on every launch. No parent profile.
writeFileSync(join(profile, "settings.json"), JSON.stringify({
  packages: [], extensions: [], defaultTools: [],
  compaction: { enabled: false }, retry: { enabled: false },
  quietStartup: true,
}), { mode: 0o600 });
writeFileSync(join(profile, "auth.json"), "{}\n", { mode: 0o600 });
console.log("PRIVATE · local Qwen only · no tools or Contacts access yet");
console.log("Fresh chat. Pi transcript persistence disabled; terminal/MLX logs may remain locally.");
const child = spawn(process.execPath, privateArgs(cli, join(root, "runtime.ts"), join(root, "SYSTEM.md")), {
  cwd: profile, env: privateEnv(home, profile), stdio: "inherit",
});
child.once("error", () => { console.error("Private Pi failed to start; no fallback attempted."); process.exitCode = 1; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
// The terminal owns this process, not the originating Pi session. No IPC,
// completion message, transcript capture, or output pipe to the parent.
