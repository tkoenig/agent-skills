/**
 * OpenAI image generation for pi.
 *
 * Supports three image backends:
 * - opencode: OpenCode Zen subscription via OPENCODE_API_KEY / auth.json opencode entry
 * - subscription: ChatGPT Plus/Pro via pi's /login openai-codex flow
 * - api: OpenAI Platform API via OPENAI_API_KEY / auth.json openai entry
 *
 * With backend=auto, the extension follows the current selected model provider
 * when it is opencode, openai-codex, or openai. Other providers prompt for a
 * backend in interactive mode or fail with an explicit warning in non-UI mode.
 *
 * The subscription path uses ChatGPT's Codex responses backend with the
 * built-in image_generation tool. The API path uses /v1/images/generations.
 *
 * Usage examples:
 *   "Generate an image of a retro robot barista"
 *   "Use openai_generate_image with backend subscription"
 *
 * Save modes:
 *   save=none     - Don't save to disk (default)
 *   save=project  - Save to <repo>/.pi/generated-images/
 *   save=global   - Save to ~/.pi/agent/generated-images/
 *   save=custom   - Save to saveDir param or PI_IMAGE_SAVE_DIR
 *
 * Config files (project overrides global):
 *   ~/.pi/agent/extensions/openai-image-gen.json
 *   <repo>/.pi/extensions/openai-image-gen.json
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { StringEnum } from "@mariozechner/pi-ai";
import { type ExtensionAPI, getAgentDir, withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "typebox";

const TOOL_NAME = "openai_generate_image";
const API_PROVIDER = "openai";
const SUBSCRIPTION_PROVIDER = "openai-codex";
const OPENCODE_PROVIDER = "opencode";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_SUBSCRIPTION_CHAT_MODEL = "gpt-5.4";
const DEFAULT_OPENCODE_MODEL = "gpt-5.5";
const DEFAULT_BACKEND = "auto";
const DEFAULT_SAVE_MODE = "none";
const DEFAULT_OUTPUT_FORMAT = "png";
const DEFAULT_QUALITY = "auto";
const DEFAULT_SIZE = "auto";
const DEFAULT_BACKGROUND = "auto";

const OPENAI_IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";
const CHATGPT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
const OPENCODE_RESPONSES_ENDPOINT = "https://opencode.ai/zen/v1/responses";
const JWT_CLAIM_PATH = "https://api.openai.com/auth" as const;

const BACKENDS = ["auto", "opencode", "subscription", "api"] as const;
type Backend = (typeof BACKENDS)[number];

const SAVE_MODES = ["none", "project", "global", "custom"] as const;
type SaveMode = (typeof SAVE_MODES)[number];

const OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;
type OutputFormat = (typeof OUTPUT_FORMATS)[number];

const QUALITIES = ["auto", "low", "medium", "high"] as const;
type Quality = (typeof QUALITIES)[number];

const BACKGROUNDS = ["auto", "transparent", "opaque"] as const;
type Background = (typeof BACKGROUNDS)[number];

const SIZES = ["auto", "1024x1024", "1024x1536", "1536x1024"] as const;
type Size = (typeof SIZES)[number];

const TOOL_PARAMS = Type.Object({
	prompt: Type.String({ description: "Image description." }),
	backend: Type.Optional(StringEnum(BACKENDS)),
	model: Type.Optional(
		Type.String({
			description: `Backend-specific model id. Defaults to ${DEFAULT_OPENCODE_MODEL} for opencode and ${DEFAULT_IMAGE_MODEL} for api.`,
		}),
	),
	subscriptionChatModel: Type.Optional(
		Type.String({
			description: `ChatGPT subscription model used to call the image_generation tool. Defaults to ${DEFAULT_SUBSCRIPTION_CHAT_MODEL}.`,
		}),
	),
	size: Type.Optional(StringEnum(SIZES)),
	quality: Type.Optional(StringEnum(QUALITIES)),
	outputFormat: Type.Optional(StringEnum(OUTPUT_FORMATS)),
	background: Type.Optional(StringEnum(BACKGROUNDS)),
	save: Type.Optional(StringEnum(SAVE_MODES)),
	saveDir: Type.Optional(
		Type.String({
			description: "Directory to save image when save=custom. Defaults to PI_IMAGE_SAVE_DIR if set.",
		}),
	),
});

type ToolParams = Static<typeof TOOL_PARAMS>;

interface ExtensionConfig {
	save?: SaveMode;
	saveDir?: string;
	backend?: Backend;
	subscriptionChatModel?: string;
	model?: string;
}

interface SaveConfig {
	mode: SaveMode;
	outputDir?: string;
}

interface BackendSelection {
	backend: Exclude<Backend, "auto">;
	credential: string;
}

interface ImageResult {
	imageBase64: string;
	mimeType: string;
	revisedPrompt?: string;
	notes?: string[];
	backendDetails: Record<string, unknown>;
}

interface ParsedSseResult {
	imageBase64?: string;
	partialImageBase64?: string;
	status?: string;
	outputText: string[];
}

function readConfigFile(path: string): ExtensionConfig {
	if (!existsSync(path)) {
		return {};
	}
	try {
		const content = readFileSync(path, "utf-8");
		const parsed = JSON.parse(content) as ExtensionConfig;
		return parsed ?? {};
	} catch {
		return {};
	}
}

function loadConfig(cwd: string): ExtensionConfig {
	const globalPath = join(getAgentDir(), "extensions", "openai-image-gen.json");
	const globalConfig = readConfigFile(globalPath);
	const projectConfig = readConfigFile(join(cwd, ".pi", "extensions", "openai-image-gen.json"));
	return { ...globalConfig, ...projectConfig };
}

function resolveSaveConfig(params: ToolParams, cwd: string): SaveConfig {
	const config = loadConfig(cwd);
	const envMode = (process.env.PI_IMAGE_SAVE_MODE || "").toLowerCase();
	const mode = (params.save || envMode || config.save || DEFAULT_SAVE_MODE) as SaveMode;

	if (!SAVE_MODES.includes(mode)) {
		return { mode: DEFAULT_SAVE_MODE as SaveMode };
	}

	if (mode === "project") {
		return { mode, outputDir: join(cwd, ".pi", "generated-images") };
	}

	if (mode === "global") {
		return { mode, outputDir: join(getAgentDir(), "generated-images") };
	}

	if (mode === "custom") {
		const dir = params.saveDir || process.env.PI_IMAGE_SAVE_DIR || config.saveDir;
		if (!dir || !dir.trim()) {
			throw new Error("save=custom requires saveDir or PI_IMAGE_SAVE_DIR.");
		}
		return { mode, outputDir: dir };
	}

	return { mode };
}

function imageExtension(mimeType: string): string {
	const lower = mimeType.toLowerCase();
	if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
	if (lower.includes("webp")) return "webp";
	return "png";
}

async function saveImage(base64Data: string, mimeType: string, outputDir: string): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const ext = imageExtension(mimeType);
	const filename = `image-${timestamp}-${randomUUID().slice(0, 8)}.${ext}`;
	const filePath = join(outputDir, filename);
	await withFileMutationQueue(filePath, async () => {
		await mkdir(outputDir, { recursive: true });
		await writeFile(filePath, Buffer.from(base64Data, "base64"));
	});
	return filePath;
}

function mimeTypeForFormat(format: OutputFormat | undefined): string {
	switch (format) {
		case "jpeg":
			return "image/jpeg";
		case "webp":
			return "image/webp";
		default:
			return "image/png";
	}
}

async function getCredentialForProvider(ctx: {
	modelRegistry: { getApiKeyForProvider: (provider: string) => Promise<string | undefined> };
}, provider: string): Promise<string | undefined> {
	return ctx.modelRegistry.getApiKeyForProvider(provider);
}

async function selectBackend(
	params: ToolParams,
	ctx: {
		cwd: string;
		hasUI?: boolean;
		model?: { provider?: string; id?: string };
		ui?: { select: (title: string, items: string[]) => Promise<string | undefined> };
		modelRegistry: { getApiKeyForProvider: (provider: string) => Promise<string | undefined> };
	},
): Promise<BackendSelection> {
	const config = loadConfig(ctx.cwd);
	const preferred = (params.backend || config.backend || DEFAULT_BACKEND) as Backend;
	const opencodeCredential = await getCredentialForProvider(ctx, OPENCODE_PROVIDER);
	const subscriptionCredential = await getCredentialForProvider(ctx, SUBSCRIPTION_PROVIDER);
	const apiCredential = await getCredentialForProvider(ctx, API_PROVIDER);

	const requireBackend = (backend: Exclude<Backend, "auto">): BackendSelection => {
		if (backend === "opencode") {
			if (!opencodeCredential) {
				throw new Error("Missing OpenCode credentials. Set OPENCODE_API_KEY or add an auth.json opencode entry.");
			}
			return { backend, credential: opencodeCredential };
		}
		if (backend === "subscription") {
			if (!subscriptionCredential) {
				throw new Error("Missing ChatGPT subscription login. Run /login and select openai-codex.");
			}
			return { backend, credential: subscriptionCredential };
		}
		if (!apiCredential) {
			throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY or add an auth.json openai entry.");
		}
		return { backend, credential: apiCredential };
	};

	if (preferred !== "auto") {
		return requireBackend(preferred);
	}

	const currentProvider = ctx.model?.provider;
	if (currentProvider === OPENCODE_PROVIDER) {
		return requireBackend("opencode");
	}
	if (currentProvider === SUBSCRIPTION_PROVIDER) {
		return requireBackend("subscription");
	}
	if (currentProvider === API_PROVIDER) {
		return requireBackend("api");
	}

	const choices: Array<{ label: string; backend: Exclude<Backend, "auto">; credential: string }> = [];
	if (opencodeCredential) choices.push({ label: "OpenCode", backend: "opencode", credential: opencodeCredential });
	if (subscriptionCredential) choices.push({ label: "ChatGPT subscription", backend: "subscription", credential: subscriptionCredential });
	if (apiCredential) choices.push({ label: "OpenAI API", backend: "api", credential: apiCredential });

	if (choices.length === 0) {
		throw new Error(
			"No OpenAI image backend available. Configure OPENCODE_API_KEY, run /login for openai-codex, or configure OPENAI_API_KEY.",
		);
	}

	const current = currentProvider ? `${currentProvider}/${ctx.model?.id || "unknown"}` : "unknown model";
	if (ctx.hasUI && ctx.ui) {
		const labels = choices.map((choice) => choice.label);
		const cancel = "Cancel image generation";
		const selected = await ctx.ui.select(
			`Current model ${current} is not an image backend. Choose image backend:`,
			[...labels, cancel],
		);
		if (!selected || selected === cancel) {
			throw new Error("Image generation cancelled.");
		}
		const choice = choices.find((item) => item.label === selected);
		if (choice) {
			return { backend: choice.backend, credential: choice.credential };
		}
	}

	const available = choices.map((choice) => choice.backend).join(", ");
	throw new Error(
		`Current model ${current} is not an image backend. Specify backend explicitly (${available}); GitHub Copilot does not support image_generation.`,
	);
}

function extractAccountId(token: string): string {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) throw new Error("Invalid token");
		const payload = JSON.parse(Buffer.from(parts[1] || "", "base64url").toString("utf-8")) as {
			[JWT_CLAIM_PATH]?: { chatgpt_account_id?: string };
		};
		const accountId = payload?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
		if (!accountId) throw new Error("No account ID in token");
		return accountId;
	} catch {
		throw new Error("Failed to extract ChatGPT account id from the openai-codex login token.");
	}
}

function resolveCodexUrl(baseUrl?: string): string {
	const raw = baseUrl && baseUrl.trim().length > 0 ? baseUrl : CHATGPT_CODEX_BASE_URL;
	const normalized = raw.replace(/\/+$/, "");
	if (normalized.endsWith("/codex/responses")) return normalized;
	if (normalized.endsWith("/codex")) return `${normalized}/responses`;
	return `${normalized}/codex/responses`;
}

function buildSubscriptionHeaders(token: string, accountId: string): Headers {
	const headers = new Headers();
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("chatgpt-account-id", accountId);
	headers.set("originator", "pi");
	headers.set("OpenAI-Beta", "responses=experimental");
	headers.set("accept", "text/event-stream");
	headers.set("content-type", "application/json");
	headers.set("user-agent", `pi (${os.platform()} ${os.release()}; ${os.arch()})`);
	return headers;
}

async function parseSseForSubscriptionImage(response: Response, signal?: AbortSignal): Promise<ParsedSseResult> {
	if (!response.body) {
		throw new Error("No response body from ChatGPT subscription backend.");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const outputText: string[] = [];
	let imageBase64: string | undefined;
	let partialImageBase64: string | undefined;
	let status: string | undefined;

	try {
		while (true) {
			if (signal?.aborted) {
				throw new Error("Request was aborted");
			}

			let readResult: ReadableStreamReadResult<Uint8Array>;
			try {
				readResult = await reader.read();
			} catch (error) {
				if (imageBase64 || partialImageBase64) {
					break;
				}
				throw error;
			}
			const { done, value } = readResult;
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			let idx = buffer.indexOf("\n\n");
			while (idx !== -1) {
				const chunk = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 2);
				idx = buffer.indexOf("\n\n");

				const dataLines = chunk
					.split("\n")
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice(5).trim())
					.filter(Boolean);
				if (dataLines.length === 0) continue;

				const payload = dataLines.join("\n");
				if (payload === "[DONE]") continue;

				let event: Record<string, any>;
				try {
					event = JSON.parse(payload) as Record<string, any>;
				} catch {
					continue;
				}

				if (event.type === "error") {
					throw new Error(event.message || event.code || JSON.stringify(event) || "ChatGPT image generation failed.");
				}

				if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
					outputText.push(event.delta);
				}

				if (event.type === "response.image_generation_call.partial_image" && typeof event.partial_image_b64 === "string") {
					partialImageBase64 = event.partial_image_b64;
				}

				if (["response.completed", "response.done", "response.incomplete"].includes(event.type)) {
					status = typeof event.response?.status === "string" ? event.response.status : status;
					const outputs = Array.isArray(event.response?.output) ? event.response.output : [];
					const imageOutput = outputs.find(
						(item: any) => item?.type === "image_generation_call" && typeof item?.result === "string" && item.result.length > 0,
					);
					if (typeof imageOutput?.result === "string") {
						imageBase64 = imageOutput.result;
					}
				}

				if (event.type === "response.failed") {
					throw new Error(event.response?.error?.message || JSON.stringify(event.response?.error || event) || "ChatGPT image generation failed.");
				}
			}
		}
	} finally {
		try {
			await reader.cancel();
		} catch {}
		try {
			reader.releaseLock();
		} catch {}
	}

	return { imageBase64, partialImageBase64, status, outputText };
}

async function generateViaSubscription(
	params: ToolParams,
	token: string,
	ctx: { cwd: string },
	signal: AbortSignal | undefined,
	onUpdate?: (update: { content: Array<{ type: "text"; text: string }>; details?: Record<string, unknown> }) => void,
): Promise<ImageResult> {
	const config = loadConfig(ctx.cwd);
	const accountId = extractAccountId(token);
	const imageModel = params.model || config.model;
	const chatModel = params.subscriptionChatModel || config.subscriptionChatModel || DEFAULT_SUBSCRIPTION_CHAT_MODEL;
	const size = params.size || DEFAULT_SIZE;
	const quality = params.quality || DEFAULT_QUALITY;
	const outputFormat = params.outputFormat || DEFAULT_OUTPUT_FORMAT;
	const background = params.background || DEFAULT_BACKGROUND;

	onUpdate?.({
		content: [{ type: "text", text: `Requesting image from ChatGPT subscription via ${chatModel} + ${imageModel || "default image model"}...` }],
		details: { backend: "subscription", chatModel, imageModel: imageModel || "default", size, quality, outputFormat, background },
	});

	const response = await fetch(resolveCodexUrl(), {
		method: "POST",
		headers: buildSubscriptionHeaders(token, accountId),
		body: JSON.stringify({
			model: chatModel,
			store: false,
			stream: true,
			instructions:
				"Generate exactly one image that matches the user's request. Prefer using the image_generation tool directly and keep any text output minimal.",
			tool_choice: "auto",
			parallel_tool_calls: false,
			text: { verbosity: "low" },
			input: [
				{
					role: "user",
					content: [{ type: "input_text", text: params.prompt }],
				},
			],
			tools: [
				{
					type: "image_generation",
					action: "generate",
					...(imageModel ? { model: imageModel } : {}),
					size,
					quality,
					output_format: outputFormat,
					background,
					partial_images: 1,
				},
			],
		}),
		signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Subscription image request failed (${response.status}): ${errorText}`);
	}

	const parsed = await parseSseForSubscriptionImage(response, signal);
	const usedPartial = !parsed.imageBase64 && !!parsed.partialImageBase64;
	const imageBase64 = parsed.imageBase64 || parsed.partialImageBase64;
	if (!imageBase64) {
		throw new Error("ChatGPT subscription backend returned no image data.");
	}

	const notes: string[] = [];
	const textNotes = parsed.outputText.join("").trim();
	if (textNotes) {
		notes.push(textNotes);
	}
	if (usedPartial) {
		notes.push("Returned a partial image preview because the final image was not delivered before the stream ended.");
	}

	return {
		imageBase64,
		mimeType: mimeTypeForFormat(outputFormat),
		notes: notes.length > 0 ? notes : undefined,
		backendDetails: {
			backend: "subscription",
			chatModel,
			imageModel: imageModel || "default",
			size,
			quality,
			outputFormat,
			background,
			status: parsed.status,
			usedPartial,
		},
	};
}

async function generateViaOpencode(
	params: ToolParams,
	apiKey: string,
	ctx: { cwd: string },
	signal: AbortSignal | undefined,
	onUpdate?: (update: { content: Array<{ type: "text"; text: string }>; details?: Record<string, unknown> }) => void,
): Promise<ImageResult> {
	const config = loadConfig(ctx.cwd);
	const model = params.model || config.model || DEFAULT_OPENCODE_MODEL;
	const size = params.size || DEFAULT_SIZE;
	const quality = params.quality || DEFAULT_QUALITY;
	const outputFormat = params.outputFormat || DEFAULT_OUTPUT_FORMAT;
	const background = params.background || DEFAULT_BACKGROUND;

	onUpdate?.({
		content: [{ type: "text", text: `Requesting image from OpenCode via ${model}...` }],
		details: { backend: "opencode", model, size, quality, outputFormat, background },
	});

	const response = await fetch(OPENCODE_RESPONSES_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			store: false,
			input: [
				{
					role: "user",
					content: [{ type: "input_text", text: params.prompt }],
				},
			],
			tools: [
				{
					type: "image_generation",
					action: "generate",
					size,
					quality,
					output_format: outputFormat,
					background,
				},
			],
			tool_choice: "auto",
		}),
		signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`OpenCode image request failed (${response.status}): ${errorText}`);
	}

	const json = (await response.json()) as {
		status?: string;
		output?: Array<{
			type?: string;
			result?: string;
			content?: Array<{ type?: string; text?: string }>;
		}>;
	};
	const outputs = Array.isArray(json.output) ? json.output : [];
	const imageOutput = outputs.find(
		(item) => item?.type === "image_generation_call" && typeof item?.result === "string" && item.result.length > 0,
	);
	if (!imageOutput?.result) {
		throw new Error("OpenCode returned no image data.");
	}

	const notes = outputs
		.flatMap((item) => (Array.isArray(item.content) ? item.content : []))
		.map((item) => (item.type === "output_text" && typeof item.text === "string" ? item.text.trim() : ""))
		.filter(Boolean);

	return {
		imageBase64: imageOutput.result,
		mimeType: mimeTypeForFormat(outputFormat),
		notes: notes.length > 0 ? notes : undefined,
		backendDetails: {
			backend: "opencode",
			imageModel: model,
			size,
			quality,
			outputFormat,
			background,
			status: json.status,
		},
	};
}

async function generateViaApi(
	params: ToolParams,
	apiKey: string,
	ctx: { cwd: string },
	signal: AbortSignal | undefined,
	onUpdate?: (update: { content: Array<{ type: "text"; text: string }>; details?: Record<string, unknown> }) => void,
): Promise<ImageResult> {
	const config = loadConfig(ctx.cwd);
	const imageModel = params.model || config.model || DEFAULT_IMAGE_MODEL;
	const size = params.size || DEFAULT_SIZE;
	const quality = params.quality || DEFAULT_QUALITY;
	const outputFormat = params.outputFormat || DEFAULT_OUTPUT_FORMAT;
	const background = params.background || DEFAULT_BACKGROUND;

	onUpdate?.({
		content: [{ type: "text", text: `Requesting image from OpenAI API via ${imageModel}...` }],
		details: { backend: "api", imageModel, size, quality, outputFormat, background },
	});

	const response = await fetch(OPENAI_IMAGES_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: imageModel,
			prompt: params.prompt,
			size,
			quality,
			output_format: outputFormat,
			background,
			n: 1,
		}),
		signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`OpenAI API image request failed (${response.status}): ${errorText}`);
	}

	const json = (await response.json()) as {
		data?: Array<{ b64_json?: string; revised_prompt?: string }>;
	};
	const firstImage = json.data?.[0];
	if (!firstImage?.b64_json) {
		throw new Error("OpenAI API returned no image data.");
	}

	return {
		imageBase64: firstImage.b64_json,
		mimeType: mimeTypeForFormat(outputFormat),
		revisedPrompt: firstImage.revised_prompt,
		backendDetails: {
			backend: "api",
			imageModel,
			size,
			quality,
			outputFormat,
			background,
		},
	};
}

function summaryText(result: ImageResult, savedPath: string | undefined, saveMode: SaveMode): string {
	const parts: string[] = [];
	const backend = String(result.backendDetails.backend || "unknown");
	const imageModel = String(result.backendDetails.imageModel || DEFAULT_IMAGE_MODEL);
	parts.push(`Generated image via ${backend}/${imageModel}.`);

	if (backend === "subscription" && result.backendDetails.chatModel) {
		parts.push(`Chat model: ${result.backendDetails.chatModel}.`);
	}
	if (result.backendDetails.size) {
		parts.push(`Size: ${result.backendDetails.size}.`);
	}
	if (result.backendDetails.quality) {
		parts.push(`Quality: ${result.backendDetails.quality}.`);
	}
	if (savedPath) {
		parts.push(`Saved image to: ${savedPath}`);
	} else if (saveMode !== "none") {
		parts.push(`Save mode: ${saveMode}.`);
	}
	if (result.revisedPrompt) {
		parts.push(`Revised prompt: ${result.revisedPrompt}`);
	}
	if (result.notes && result.notes.length > 0) {
		parts.push(`Model notes: ${result.notes.join(" ")}`);
	}

	return parts.join(" ");
}

export default function openaiImageGen(pi: ExtensionAPI) {
	pi.registerCommand("openai-image-status", {
		description: "Show whether OpenAI image backends are available",
		handler: async (_args, ctx) => {
			const opencode = await getCredentialForProvider(ctx, OPENCODE_PROVIDER);
			const subscription = await getCredentialForProvider(ctx, SUBSCRIPTION_PROVIDER);
			const api = await getCredentialForProvider(ctx, API_PROVIDER);
			const githubCopilot = await getCredentialForProvider(ctx, "github-copilot");
			ctx.ui.notify(
				`opencode:${opencode ? "available" : "missing"} • subscription:${subscription ? "available" : "missing"} • api:${api ? "available" : "missing"} • github-copilot:${githubCopilot ? "available/no-image-generation" : "missing"}`,
				"info",
			);
		},
	});

	pi.registerTool({
		name: TOOL_NAME,
		label: "OpenAI image",
		description:
			"Generate an image with OpenAI GPT Image models. Supports OpenCode, ChatGPT subscription login via openai-codex, and the OpenAI API via OPENAI_API_KEY.",
		promptSnippet: "Generate images with OpenAI GPT Image using OpenCode, ChatGPT subscription, or Platform API auth.",
		promptGuidelines: [
			"Use openai_generate_image when the user asks for an OpenAI-generated image or explicitly mentions ChatGPT Images / GPT Image.",
		],
		parameters: TOOL_PARAMS,
		async execute(_toolCallId, params: ToolParams, signal, onUpdate, ctx) {
			const selected = await selectBackend(params, ctx);
			const saveConfig = resolveSaveConfig(params, ctx.cwd);
			const result =
				selected.backend === "opencode"
					? await generateViaOpencode(params, selected.credential, ctx, signal, onUpdate)
					: selected.backend === "subscription"
						? await generateViaSubscription(params, selected.credential, ctx, signal, onUpdate)
						: await generateViaApi(params, selected.credential, ctx, signal, onUpdate);

			let savedPath: string | undefined;
			let saveError: string | undefined;
			if (saveConfig.mode !== "none" && saveConfig.outputDir) {
				try {
					savedPath = await saveImage(result.imageBase64, result.mimeType, saveConfig.outputDir);
				} catch (error) {
					saveError = error instanceof Error ? error.message : String(error);
				}
			}

			let text = summaryText(result, savedPath, saveConfig.mode);
			if (saveError) {
				text += ` Failed to save image: ${saveError}`;
			}

			return {
				content: [
					{ type: "text", text },
					{ type: "image", data: result.imageBase64, mimeType: result.mimeType },
				],
				details: {
					...result.backendDetails,
					savedPath,
					saveMode: saveConfig.mode,
					revisedPrompt: result.revisedPrompt,
					notes: result.notes,
				},
			};
		},
	});
}
