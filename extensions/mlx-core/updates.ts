import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const LATEST_RELEASE = "https://api.github.com/repos/ddalcu/mlx-serve/releases/latest";

export function compareVersions(installed: string, latest: string): number | undefined {
  const parse = (value: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
  const a = parse(installed), b = parse(latest);
  if (!a || !b) return undefined;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  return 0;
}

// Explicit command only: never called by factory, discovery, or inference.
export async function checkUpdates(binary: string, options: {
  offline?: boolean;
  fetcher?: typeof fetch;
  versionReader?: (binary: string) => Promise<string>;
} = {}): Promise<string> {
  const readVersion = options.versionReader ?? (async (path: string) => {
    const result = await exec(path, ["--version"], { timeout: 5000, maxBuffer: 64 * 1024 });
    return result.stdout;
  });
  const versionText = await readVersion(binary);
  const installed = /^mlx-serve\s+([^\s]+)/m.exec(versionText)?.[1];
  if (!installed) throw new Error("Cannot identify mlx-serve version from --version");
  if (options.offline) return `Installed mlx-serve: ${installed}\nUpdate check skipped: PI_OFFLINE is enabled.`;
  const response = await (options.fetcher ?? fetch)(LATEST_RELEASE, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "pi-mlx-core-update-check" },
    signal: AbortSignal.timeout(10000), redirect: "error",
  });
  if (!response.ok) throw new Error(`GitHub update check failed (${response.status}); installed mlx-serve is ${installed}. No changes made.`);
  const release = await response.json() as { tag_name?: unknown; draft?: boolean; prerelease?: boolean };
  if (release.draft || release.prerelease || typeof release.tag_name !== "string" || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw new Error("GitHub did not return a recognized stable mlx-serve release");
  }
  const latest = release.tag_name.replace(/^v/, "");
  const comparison = compareVersions(installed, latest);
  const status = comparison === undefined ? "Custom/prerelease build; compare manually" : comparison < 0 ? "Update available" : comparison === 0 ? "Up to date" : "Installed version is newer than latest stable";
  return `${status}\nInstalled mlx-serve: ${installed}\nLatest stable: ${latest}\nhttps://github.com/ddalcu/mlx-serve/releases/tag/${release.tag_name}\nNo updates installed. Update through your package manager, then restart the managed server.`;
}
