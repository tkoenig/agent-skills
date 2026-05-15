/**
 * Rubydex MCP tools for pi.
 *
 * Thin wrapper around MCPorter + Shopify's rubydex_mcp server.
 * Requires a configured MCPorter server named `rubydex`.
 */

import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

const DEFAULT_SERVER = "rubydex";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_INDEXING_ATTEMPTS = 5;

const LIMIT_DESCRIPTION = `Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}, whichever is hit first.`;

const optionalLimit = Type.Optional(
	Type.Integer({ minimum: 0, description: "Maximum number of results to return. Rubydex caps this per tool." }),
);
const optionalOffset = Type.Optional(Type.Integer({ minimum: 0, description: "Number of results to skip for pagination." }));

const emptyParams = Type.Object({});

const searchParams = Type.Object({
	query: Type.String({ description: "Search query to match against Ruby declaration names." }),
	kind: Type.Optional(
		Type.String({ description: "Optional declaration kind filter: Class, Module, Method, Constant, etc." }),
	),
	matchMode: Type.Optional(
		Type.String({ description: "Matching mode: fuzzy (default) or exact." }),
	),
	limit: optionalLimit,
	offset: optionalOffset,
});

type SearchParams = Static<typeof searchParams>;

const declarationParams = Type.Object({
	name: Type.String({ description: "Fully qualified declaration name, e.g. Video or Video#platform_url()." }),
});

type DeclarationParams = Static<typeof declarationParams>;

const paginatedNameParams = Type.Object({
	name: Type.String({ description: "Fully qualified class, module, or constant name." }),
	limit: optionalLimit,
	offset: optionalOffset,
});

type PaginatedNameParams = Static<typeof paginatedNameParams>;

const fileDeclarationsParams = Type.Object({
	filePath: Type.String({ description: "Ruby file path, relative or absolute." }),
});

type FileDeclarationsParams = Static<typeof fileDeclarationsParams>;

interface ToolResponseDetails {
	selector: string;
	params: Record<string, unknown>;
	truncated: boolean;
	truncatedBy: "lines" | "bytes" | null;
	totalLines: number;
	totalBytes: number;
	outputLines: number;
	outputBytes: number;
}

interface McporterInvocation {
	command: string;
	argsPrefix: string[];
}

function mcporterInvocation(): McporterInvocation {
	const explicit = process.env.MCPORTER_BIN;
	if (explicit?.trim()) {
		return { command: explicit.trim(), argsPrefix: [] };
	}

	return { command: "npx", argsPrefix: ["-y", "mcporter"] };
}

function serverName(): string {
	return process.env.RUBYDEX_MCP_SERVER?.trim() || DEFAULT_SERVER;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		return Promise.reject(new Error("Cancelled"));
	}

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(resolve, ms);
		const onAbort = () => {
			clearTimeout(timeout);
			reject(new Error("Cancelled"));
		};

		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

function compactErrorOutput(stdout: string, stderr: string): string {
	const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n\n");
	if (!combined) return "No output";
	const truncated = truncateHead(combined, { maxLines: 80, maxBytes: 8_000 });
	return truncated.content + (truncated.truncated ? "\n[error output truncated]" : "");
}

async function callRubydex(
	pi: ExtensionAPI,
	mcpToolName: string,
	params: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<unknown> {
	const selector = `${serverName()}.${mcpToolName}`;
	const invocation = mcporterInvocation();
	const args = [
		...invocation.argsPrefix,
		"call",
		selector,
		"--args",
		JSON.stringify(params),
		"--output",
		"json",
		"--timeout",
		String(DEFAULT_TIMEOUT_MS),
	];

	let attempt = 0;
	while (true) {
		attempt += 1;
		const result = await pi.exec(invocation.command, args, { signal, timeout: DEFAULT_TIMEOUT_MS + 10_000 });
		const stdout = result.stdout.trim();

		let parsed: unknown;
		try {
			parsed = stdout ? JSON.parse(stdout) : undefined;
		} catch (error) {
			throw new Error(
				`MCPorter returned non-JSON output for ${selector}: ${compactErrorOutput(result.stdout, result.stderr)}`,
			);
		}

		if (result.code !== 0) {
			throw new Error(`MCPorter call failed for ${selector}: ${compactErrorOutput(result.stdout, result.stderr)}`);
		}

		if (isIndexingResponse(parsed) && attempt < MAX_INDEXING_ATTEMPTS) {
			await sleep(Math.min(1_000 * attempt, 5_000), signal);
			continue;
		}

		if (isErrorResponse(parsed)) {
			throw new Error(`Rubydex ${parsed.error}: ${parsed.message}${parsed.suggestion ? ` (${parsed.suggestion})` : ""}`);
		}

		return parsed;
	}
}

function isErrorResponse(value: unknown): value is { error: string; message?: string; suggestion?: string } {
	return Boolean(value && typeof value === "object" && "error" in value && typeof (value as { error?: unknown }).error === "string");
}

function isIndexingResponse(value: unknown): boolean {
	return isErrorResponse(value) && value.error === "indexing";
}

function rubydexResult(selector: string, params: Record<string, unknown>, data: unknown) {
	const json = JSON.stringify(data, null, 2) ?? String(data);
	const truncated = truncateHead(json, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
	const suffix = truncated.truncated
		? `\n\n[Rubydex result truncated: ${truncated.outputLines} of ${truncated.totalLines} lines, ${formatSize(truncated.outputBytes)} of ${formatSize(truncated.totalBytes)}. Narrow the query, lower limit, or use offset for more.]`
		: "";

	const details: ToolResponseDetails = {
		selector,
		params,
		truncated: truncated.truncated,
		truncatedBy: truncated.truncatedBy,
		totalLines: truncated.totalLines,
		totalBytes: truncated.totalBytes,
		outputLines: truncated.outputLines,
		outputBytes: truncated.outputBytes,
	};

	return {
		content: [{ type: "text" as const, text: truncated.content + suffix }],
		details,
	};
}

function cleanFilePath(filePath: string): string {
	return filePath.replace(/^@/, "");
}

export default function rubydexExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "rubydex_stats",
		label: "Rubydex Stats",
		description: `Get Rubydex index statistics for the current Ruby codebase. ${LIMIT_DESCRIPTION}`,
		promptSnippet: "Get semantic Ruby codebase index statistics from Rubydex.",
		promptGuidelines: [
			"Use rubydex_stats to verify Rubydex indexing is ready before using other Rubydex tools if MCP startup may have just happened.",
		],
		parameters: emptyParams,
		async execute(_toolCallId, _params, signal) {
			const data = await callRubydex(pi, "codebase_stats", {}, signal);
			return rubydexResult(`${serverName()}.codebase_stats`, {}, data);
		},
	});

	pi.registerTool({
		name: "rubydex_search",
		label: "Rubydex Search",
		description: `Search Ruby classes, modules, methods, constants, and other declarations by semantic index. Prefer this over grep when looking for Ruby identifiers or definitions. ${LIMIT_DESCRIPTION}`,
		promptSnippet: "Search Ruby declarations semantically by identifier name using Rubydex.",
		promptGuidelines: [
			"Use rubydex_search before grep when looking for Ruby classes, modules, methods, constants, or definitions by identifier name.",
		],
		parameters: searchParams,
		async execute(_toolCallId, params: SearchParams, signal) {
			const mcpParams: Record<string, unknown> = {
				query: params.query,
				kind: params.kind,
				match_mode: params.matchMode,
				limit: params.limit,
				offset: params.offset,
			};
			const data = await callRubydex(pi, "search_declarations", mcpParams, signal);
			return rubydexResult(`${serverName()}.search_declarations`, mcpParams, data);
		},
	});

	pi.registerTool({
		name: "rubydex_declaration",
		label: "Rubydex Declaration",
		description: `Get complete information about a Ruby class, module, method, or constant by exact fully qualified name. Includes locations, comments, ancestors, and members. ${LIMIT_DESCRIPTION}`,
		promptSnippet: "Get semantic Ruby declaration details by fully qualified name using Rubydex.",
		promptGuidelines: [
			"Use rubydex_declaration before reading a Ruby file when you need a concise structural summary of a known class, module, method, or constant.",
		],
		parameters: declarationParams,
		async execute(_toolCallId, params: DeclarationParams, signal) {
			const mcpParams = { name: params.name };
			const data = await callRubydex(pi, "get_declaration", mcpParams, signal);
			return rubydexResult(`${serverName()}.get_declaration`, mcpParams, data);
		},
	});

	pi.registerTool({
		name: "rubydex_descendants",
		label: "Rubydex Descendants",
		description: `Get known descendants for a Ruby class or module, including transitive descendants. ${LIMIT_DESCRIPTION}`,
		promptSnippet: "Find Ruby descendants for a class or module using Rubydex.",
		promptGuidelines: [
			"Use rubydex_descendants when investigating inheritance, modules, subclasses, or impact of changing a Ruby base class/module.",
		],
		parameters: paginatedNameParams,
		async execute(_toolCallId, params: PaginatedNameParams, signal) {
			const mcpParams = { name: params.name, limit: params.limit, offset: params.offset };
			const data = await callRubydex(pi, "get_descendants", mcpParams, signal);
			return rubydexResult(`${serverName()}.get_descendants`, mcpParams, data);
		},
	});

	pi.registerTool({
		name: "rubydex_constant_references",
		label: "Rubydex Constant References",
		description: `Find resolved references to a Ruby class, module, or constant across the codebase. Prefer this over grep for constant usages because it uses Rubydex constant resolution. ${LIMIT_DESCRIPTION}`,
		promptSnippet: "Find resolved Ruby constant references using Rubydex.",
		promptGuidelines: [
			"Use rubydex_constant_references instead of grep when looking for semantic Ruby constant usages and references.",
		],
		parameters: paginatedNameParams,
		async execute(_toolCallId, params: PaginatedNameParams, signal) {
			const mcpParams = { name: params.name, limit: params.limit, offset: params.offset };
			const data = await callRubydex(pi, "find_constant_references", mcpParams, signal);
			return rubydexResult(`${serverName()}.find_constant_references`, mcpParams, data);
		},
	});

	pi.registerTool({
		name: "rubydex_file_declarations",
		label: "Rubydex File Declarations",
		description: `List Ruby declarations defined in a file. Use this before reading large Ruby files to get a structural overview. ${LIMIT_DESCRIPTION}`,
		promptSnippet: "List semantic Ruby declarations defined in a file using Rubydex.",
		promptGuidelines: [
			"Use rubydex_file_declarations before reading large Ruby files when you need a structural overview of classes, modules, methods, and constants in that file.",
		],
		parameters: fileDeclarationsParams,
		async execute(_toolCallId, params: FileDeclarationsParams, signal) {
			const mcpParams = { file_path: cleanFilePath(params.filePath) };
			const data = await callRubydex(pi, "get_file_declarations", mcpParams, signal);
			return rubydexResult(`${serverName()}.get_file_declarations`, mcpParams, data);
		},
	});
}
