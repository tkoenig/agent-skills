import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { installPrivateGuards } from "./guards.mjs";

// Extension event exceptions are sometimes reported and swallowed by Pi.
// A privacy-policy violation therefore terminates this dedicated process,
// rather than throwing and allowing a provider request to continue.
function refuse(): never {
  process.stderr.write("Private session stopped: local-only configuration check failed. No fallback.\n");
  process.exit(78);
}

export default async function (pi: ExtensionAPI) {
  const profile = process.env.PI_PRIVATE_PROFILE;
  if (!profile || resolve(profile) !== process.cwd() || process.env.PI_CODING_AGENT_DIR !== profile || process.env.PI_OFFLINE !== "1") refuse();

  installPrivateGuards(pi, refuse);

  // This is the only loaded integration; no ambient extensions, Intercom,
  // MCP, skills, project instructions, or remote providers are imported.
  try {
    const provider = await import(pathToFileURL(join(homedir(), ".pi/agent/extensions/mlx-core/index.ts")).href);
    await provider.default(pi);
  } catch {
    refuse();
  }
}
