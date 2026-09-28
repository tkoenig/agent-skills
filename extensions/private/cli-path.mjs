import { readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

// npm's bin/pi can point at dist/cli.js or dist/bundle/cli.js. Locate
// the owning package instead of depending on a fixed directory depth.
export function resolvePiCli(path) {
  if (!isAbsolute(path)) throw new Error("Expected an absolute Pi executable path");
  const cli = realpathSync(path);
  let directory = dirname(cli);
  while (true) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (pkg) {
      if (pkg.name !== "@earendil-works/pi-coding-agent" || typeof pkg.bin?.pi !== "string" ||
          realpathSync(join(directory, pkg.bin.pi)) !== cli) {
        throw new Error("Expected the installed Pi package's declared executable");
      }
      return cli;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Could not locate the Pi executable's package.json");
    directory = parent;
  }
}
