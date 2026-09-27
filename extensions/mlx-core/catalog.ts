import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep, resolve } from "node:path";

export interface LocalModel { id: string; path: string; contextWindow: number; reasoning: boolean }

// Read only the shared on-disk store; no server launch, download, or remote discovery.
export async function discoverModels(root: string, contextCap: number): Promise<LocalModel[]> {
  const models: LocalModel[] = [];
  async function visit(dir: string, depth: number) {
    const entries = await readdir(dir, { withFileTypes: true }).catch((e: any) => {
      if (e.code === "ENOENT") return []; throw e;
    });
    if (entries.some(e => e.name === "config.json")) {
      try {
        const config = JSON.parse(await readFile(join(dir, "config.json"), "utf8"));
        // Initial support is intentionally text-only Qwen 3.5/3.6/3.8. Do not
        // mislabel embedding, audio, or untested architectures as chat models.
        if (!["qwen3_5", "qwen3_5_moe", "qwen3_8", "qwen3_8_moe"].includes(config.model_type)) return;
        const id = relative(root, dir).split(sep).join("/");
        if (!id || id.includes("@") || id.includes("..")) return;
        const indexPath = join(dir, "model.safetensors.index.json");
        let weights: string[];
        try {
          const index = JSON.parse(await readFile(indexPath, "utf8"));
          weights = [...new Set(Object.values(index.weight_map) as string[])];
        } catch (e: any) {
          if (e.code !== "ENOENT") throw e;
          weights = ["model.safetensors"];
        }
        if (!weights.length) return;
        for (const file of weights) {
          if (typeof file !== "string" || resolve(dir, file) !== join(dir, file) || file.includes("..") || file.includes("/")) return;
          const info = await stat(join(dir, file));
          if (!info.isFile() || info.size === 0) return;
        }
        const text = config.text_config ?? config;
        const declared = Number(text.max_position_embeddings);
        const template = await readFile(join(dir, "chat_template.jinja"), "utf8").catch(() => "");
        models.push({ id, path: dir, contextWindow: Number.isFinite(declared) && declared > 0 ? Math.min(declared, contextCap) : contextCap,
          reasoning: template.includes("enable_thinking") });
      } catch (e: any) {
        // A download can be incomplete. Other models remain usable.
        if (e.code !== "ENOENT" && !(e instanceof SyntaxError)) throw e;
      }
      return;
    }
    if (depth < 2) for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) await visit(join(dir, entry.name), depth + 1);
    }
  }
  await visit(root, 0);
  return models.sort((a, b) => a.id.localeCompare(b.id));
}
