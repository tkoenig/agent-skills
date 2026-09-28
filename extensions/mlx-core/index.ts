// Provider/lazy-stream pattern adapted from Armin Ronacher's pi-ds4 (MIT).
import { createProvider, lazyStream, type Model, type ProviderStreams, type StreamOptions } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createLifecycle } from "./lifecycle.ts";
import { discoverModels, type LocalModel } from "./catalog.ts";
import { checkUpdates } from "./updates.ts";
import { applyReasoningBudget } from "./budgets.ts";
import { showLogs } from "./log-viewer.ts";
import { requestWorkingStatus } from "./working-status.ts";

const PROVIDER = "mlx-core";
const PLACEHOLDER_URL = "http://127.0.0.1:1/v1"; // Replaced only after verified managed startup.
const extensionDir = dirname(fileURLToPath(import.meta.url));

export default async function (pi: ExtensionAPI) {
  const root = process.env.PI_MLX_CORE_DIR ?? join(homedir(), ".pi", "mlx-core");
  let config: { binary?: string; modelDir?: string; contextTokens?: number; maxTokens?: number; answerReserveTokens?: number; readyTimeoutMs?: number } = {};
  try { config = JSON.parse(await readFile(join(root, "settings.json"), "utf8")); }
  catch (e: any) { if (e.code !== "ENOENT") throw e; }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Invalid MLX settings object");
  const binary = config.binary ?? "/opt/homebrew/bin/mlx-serve";
  const modelDir = config.modelDir ?? join(homedir(), ".mlx-serve", "models");
  const contextTokens = config.contextTokens ?? 65536;
  const maxTokens = config.maxTokens ?? Math.min(32768, Math.floor(contextTokens / 2));
  const answerReserveTokens = config.answerReserveTokens ?? Math.min(8192, Math.floor(maxTokens / 4));
  const readyTimeoutMs = config.readyTimeoutMs ?? 120000;
  if (!isAbsolute(binary) || !isAbsolute(modelDir)) throw new Error("MLX binary and modelDir must be absolute paths");
  if (!Number.isInteger(contextTokens) || contextTokens < 4096 || contextTokens > 262144) throw new Error("MLX contextTokens must be 4096..262144");
  if (!Number.isInteger(maxTokens) || maxTokens < 1024 || maxTokens >= contextTokens) throw new Error("MLX maxTokens must be at least 1024 and less than contextTokens");
  if (!Number.isInteger(answerReserveTokens) || answerReserveTokens < 1 || answerReserveTokens >= maxTokens) throw new Error("MLX answerReserveTokens must be positive and less than maxTokens");
  if (!Number.isInteger(readyTimeoutMs) || readyTimeoutMs < 1000 || readyTimeoutMs > 900000) throw new Error("Invalid MLX readyTimeoutMs");
  const lifecycle = createLifecycle({ root, binary, modelDir, contextTokens, readyTimeoutMs, watchdog: join(extensionDir, "mlx-watchdog.sh") });
  let installed = await discoverModels(modelDir, contextTokens);
  let workingStatus: ((message?: string) => void) | undefined;
  let disposed = false;
  let currentRequest: object | undefined;

  function asModel(entry: LocalModel): Model<"openai-completions"> {
    return { id: entry.id, name: `${entry.id.split("/").at(-1)} (local MLX)`,
      api: "openai-completions", provider: PROVIDER, baseUrl: PLACEHOLDER_URL,
      reasoning: entry.reasoning, input: ["text"], contextWindow: entry.contextWindow,
      maxTokens: Math.min(maxTokens, Math.floor(entry.contextWindow / 2)), cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      compat: { supportsStore: false, supportsDeveloperRole: false, maxTokensField: "max_tokens",
        supportsStrictMode: false, supportsUsageInStreaming: true, supportsReasoningEffort: true,
        thinkingFormat: "qwen" },
    };
  }
  const upstream = openAICompletionsApi();
  const prepare = (model: Model<any>, signal: AbortSignal | undefined, run: (model: Model<any>) => ReturnType<ProviderStreams["stream"]>) => {
    const turnStatus = workingStatus;
    const request = {};
    currentRequest = request;
    const status = requestWorkingStatus(message => turnStatus?.(message), signal,
      () => !disposed && workingStatus === turnStatus && currentRequest === request);
    return lazyStream(model, async () => {
      try {
        if (!installed.some(entry => entry.id === model.id) || model.id.includes("@")) throw new Error("MLX model is not installed locally; run /mlx refresh");
        const state = await lifecycle.ensure(signal, status.report);
        signal?.throwIfAborted();
        status.report("Server ready; waiting for model response");
        const response = await fetch(`${state.apiBaseUrl}/models`, { redirect: "error", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error("Cannot query the managed MLX model catalog");
        const catalog = await response.json() as { data?: { id: string }[] };
        if (!catalog.data?.some(entry => entry.id === model.id)) throw new Error(`Managed mlx-serve does not advertise ${model.id}`);
        return status.follow(run({ ...model, baseUrl: state.apiBaseUrl }));
      } catch (error) { status.finish(); throw error; }
    });
  };
  // Preserve Pi's request instrumentation; apply the reserve to the final payload
  // after an existing onPayload hook has had its opportunity to replace it.
  function budgeted<T extends StreamOptions>(options: T | undefined): T & StreamOptions {
    return { ...options, onPayload: async (payload, model) => {
      const replacement = await options?.onPayload?.(payload, model);
      return applyReasoningBudget(replacement ?? payload, answerReserveTokens);
    } } as T & StreamOptions;
  }
  const api: ProviderStreams = {
    stream: (model, context, options) => prepare(model, options?.signal, local => upstream.stream(local, context, budgeted(options))),
    streamSimple: (model, context, options) => prepare(model, options?.signal, local => upstream.streamSimple(local, context, budgeted(options))),
  };
  function register() {
    const provider = createProvider({ id: PROVIDER, name: "MLX Core (this Mac)", baseUrl: PLACEHOLDER_URL,
      auth: { apiKey: { name: "Local MLX server", async resolve() { return { auth: { apiKey: "mlx-local" }, source: "local mlx-serve" }; } } },
      models: installed.map(asModel), api,
    });
    pi.registerProvider({ ...provider, getModels: () => installed.map(asModel),
      async refreshModels({ signal }) {
        const found = await discoverModels(modelDir, contextTokens);
        if (!signal?.aborted) installed = found;
      },
    });
  }
  register();
  pi.registerCommand("mlx", {
    description: "Local MLX: status, start, stop (release this session), refresh, logs, updates",
    handler: async (args, ctx) => {
      let action = args.trim();
      if (!action && ctx.hasUI) action = await ctx.ui.select("MLX Core (this Mac)", ["status", "start", "stop", "refresh", "logs", "updates"]) ?? "";
      if (!action) action = "status";
      switch (action) {
        case "start": {
          ctx.ui.setStatus("mlx", "Preparing mlx-serve");
          try {
            const state = await lifecycle.ensure(undefined, message => ctx.ui.setStatus("mlx", message));
            ctx.ui.notify(`Managed mlx-serve: ${state.apiBaseUrl} (HTTP ready; model loads on request)`, "info");
          } finally { ctx.ui.setStatus("mlx", undefined); }
          break;
        }
        case "stop":
          if (!ctx.isIdle()) throw new Error("Wait for the current turn before releasing MLX");
          await lifecycle.release();
          ctx.ui.notify("Released this session's MLX lease. Server stops when all users release it.", "info"); break;
        case "refresh":
          installed = await discoverModels(modelDir, contextTokens); register();
          ctx.ui.notify(`Found ${installed.length} supported local model(s).`, "info"); break;
        case "updates":
          ctx.ui.notify(await checkUpdates(binary, { offline: /^(1|true|yes)$/i.test(process.env.PI_OFFLINE ?? "") }), "info"); break;
        case "logs": await showLogs(ctx, [lifecycle.logFile, join(root, "server.log")]); break;
        case "status": {
          const { state, healthy } = await lifecycle.status();
          ctx.ui.notify(`${installed.length} local model(s); ${healthy ? `managed server PID ${state!.pid} healthy at ${state!.apiBaseUrl}` : state ? "recorded server is stale, stopping, or unhealthy" : "no managed server"}`, "info"); break;
        }
        default: throw new Error("Usage: /mlx [status|start|stop|refresh|logs|updates]");
      }
    },
  });
  pi.on("before_agent_start", (_event, ctx) => {
    currentRequest = undefined;
    workingStatus = ctx.model?.provider === PROVIDER ? message => ctx.ui.setWorkingMessage(message) : undefined;
  });
  pi.on("agent_settled", (_event, ctx) => {
    if (workingStatus) ctx.ui.setWorkingMessage();
    workingStatus = undefined;
    currentRequest = undefined;
  });
  pi.on("session_shutdown", async (event, ctx) => {
    disposed = true;
    if (workingStatus) ctx.ui.setWorkingMessage();
    workingStatus = undefined;
    currentRequest = undefined;
    await lifecycle.dispose(event.reason);
  });
}
