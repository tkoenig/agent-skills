import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installLocalModelGuard } from "./guards.mjs";

export default function (pi: ExtensionAPI) {
  // Pi may swallow hook exceptions. Exit rather than silently send this local
  // conversation to a different provider. This is not a tool/network sandbox.
  installLocalModelGuard(pi, () => {
    process.stderr.write("Local session stopped: the conversation model must use mlx-core. No cloud fallback.\n");
    process.exit(78);
  });
}
