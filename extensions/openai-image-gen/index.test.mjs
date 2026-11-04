import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

// Exercise the real request builder with isolated config and no network/auth access.
const source = stripTypeScriptTypes(readFileSync(new URL("./index.ts", import.meta.url), "utf8")
	.replace(/^import .*;\n/gm, "")
	.replace("export default function", "function"));

function harness(config = {}) {
	const root = mkdtempSync(join(os.tmpdir(), "pi-image-gen-test-"));
	const cwd = join(root, "project");
	mkdirSync(join(cwd, ".pi", "extensions"), { recursive: true });
	writeFileSync(join(cwd, ".pi", "extensions", "openai-image-gen.json"), JSON.stringify(config));
	let request;
	const context = vm.createContext({
		Buffer, Headers, TextDecoder, os, join, existsSync, readFileSync, process: { env: {} },
		getAgentDir: () => join(root, "agent"),
		Type: new Proxy({}, { get: () => (...args) => args }),
		StringEnum: (values) => values,
		fetch: async (url, init) => {
			request = { url, body: JSON.parse(init.body) };
			throw new Error("request captured");
		},
	});
	vm.runInContext(source, context);
	const payload = Buffer.from(JSON.stringify({
		"https://api.openai.com/auth": { chatgpt_account_id: "test-account" },
	})).toString("base64url");
	return {
		parse: (response) => context.parseSseForSubscriptionImage(response),
		async request(model, params = {}) {
			await assert.rejects(context.generateViaSubscription(
				{ prompt: "test", ...params }, `test.${payload}.test`, { cwd, model }, undefined,
			), /request captured/);
			return request;
		},
	};
}

function sseResponse(events) {
	return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
}

test("final image is captured from output_item.done even with generating status", async () => {
	const result = await harness().parse(sseResponse([
		{ type: "response.image_generation_call.partial_image", partial_image_b64: "preview" },
		{ type: "response.output_item.done", item: { type: "image_generation_call", status: "generating", result: "final-image" } },
		{ type: "response.completed", response: { status: "completed", output: [] } },
	]));
	assert.equal(result.imageBase64, "final-image");
	assert.equal(result.status, "completed");
});

test("completed response image extraction remains supported", async () => {
	const result = await harness().parse(sseResponse([
		{ type: "response.completed", response: { status: "completed", output: [{ type: "image_generation_call", result: "final-image" }] } },
	]));
	assert.equal(result.imageBase64, "final-image");
});

test("non-image output items and empty results are not treated as final images", async () => {
	const result = await harness().parse(sseResponse([
		{ type: "response.output_item.done", item: { type: "message", result: "not-an-image" } },
		{ type: "response.output_item.done", item: { type: "image_generation_call", result: "" } },
	]));
	assert.equal(result.imageBase64, undefined);
});

test("subscription follows the selected Codex model without pinning the image renderer", async () => {
	const request = await harness().request({ provider: "openai-codex", id: "gpt-6.1-sol" });
	assert.equal(request.body.model, "gpt-6.1-sol");
	assert.equal(request.url, "https://chatgpt.com/backend-api/codex/responses");
	assert.equal(request.body.tools[0].type, "image_generation");
	assert.equal(request.body.tools[0].model, undefined);
});

test("subscription tracks later Codex model selections", async () => {
	const request = await harness().request({ provider: "openai-codex", id: "future-codex-model" });
	assert.equal(request.body.model, "future-codex-model");
});

test("per-call model overrides config and selected model", async () => {
	const request = await harness({ subscriptionChatModel: "configured-model" }).request(
		{ provider: "openai-codex", id: "selected-model" },
		{ subscriptionChatModel: "explicit-model", model: "explicit-image-model" },
	);
	assert.equal(request.body.model, "explicit-model");
	assert.equal(request.body.tools[0].model, "explicit-image-model");
});

test("config overrides the selected Codex model", async () => {
	const request = await harness({ subscriptionChatModel: "configured-model" }).request(
		{ provider: "openai-codex", id: "selected-model" },
	);
	assert.equal(request.body.model, "configured-model");
});

test("another provider or missing model uses a current Codex fallback", async () => {
	for (const model of [undefined, { provider: "anthropic", id: "claude" }, { provider: "openai-codex" }]) {
		assert.equal((await harness().request(model)).body.model, "gpt-6.1-sol");
	}
});
