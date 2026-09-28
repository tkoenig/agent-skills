import { spawn } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { privateArgs } from "./policy.mjs";
import { resolvePiCli } from "./cli-path.mjs";

// The parent passes executable/configuration paths, never a prompt or transcript.
if (process.argv.length !== 5) {
  console.error("Usage: node launch.mjs /absolute/path/to/installed/pi /working/directory /pi/agent/directory");
  process.exit(2);
}
let cli, cwd, agentDir;
try {
  cli = resolvePiCli(process.argv[2]);
  if (!isAbsolute(process.argv[3]) || !isAbsolute(process.argv[4])) throw new Error("Expected absolute directories");
  cwd = realpathSync(process.argv[3]);
  agentDir = realpathSync(process.argv[4]);
  if (!statSync(cwd).isDirectory() || !statSync(agentDir).isDirectory()) throw new Error("Expected directories");
} catch {
  console.error("Could not verify the Pi executable or directories. No fallback attempted.");
  process.exit(78);
}
const root = dirname(fileURLToPath(import.meta.url));
console.log("LOCAL MODEL · normal Pi tools, configuration, and saved sessions");
console.log("Tools retain normal access, including shell and network. No previous conversation is forwarded.");
const child = spawn(process.execPath, privateArgs(cli, join(root, "runtime.ts"), join(root, "SYSTEM.md")), {
  cwd, env: { ...process.env, PI_CODING_AGENT_DIR: agentDir }, stdio: "inherit",
});
child.once("error", () => { console.error("Local Pi failed to start; no model fallback attempted."); process.exitCode = 1; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
// The terminal owns this ordinary Pi session. No automatic result handoff.
