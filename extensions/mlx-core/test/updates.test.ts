import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUpdates, compareVersions } from "../updates.ts";
const versionReader = async () => "mlx-serve 26.9.1\nmlx 0.32.2\n";

test("version comparison is numeric and doesn't misclassify prereleases", () => {
  assert.equal(compareVersions("26.9.1", "v26.9.6"), -1);
  assert.equal(compareVersions("26.10.1", "26.9.6"), 1);
  assert.equal(compareVersions("26.9.6", "26.9.6"), 0);
  assert.equal(compareVersions("26.9.6-rc1", "26.9.6"), undefined);
});
test("offline update check never contacts GitHub", async () => {
  const result = await checkUpdates("unused", { versionReader, offline: true,
    fetcher: async () => { throw new Error("Must not make a request"); },
  });
  assert.match(result, /26.9.1/); assert.match(result, /skipped/);
});
test("explicit check sends no auth or local data, reports stable release", async () => {
  const result = await checkUpdates("unused", { versionReader, fetcher: async (url, options) => {
    assert.equal(url, "https://api.github.com/repos/ddalcu/mlx-serve/releases/latest");
    assert.equal(options?.body, undefined);
    assert.equal(new Headers(options?.headers).has("Authorization"), false);
    assert.equal(options?.redirect, "error");
    return Response.json({ tag_name: "v26.9.6", prerelease: false, draft: false });
  } });
  assert.match(result, /Update available/); assert.match(result, /No updates installed/);
});
test("rate limits and malformed releases fail clearly without mutation", async () => {
  await assert.rejects(checkUpdates("unused", { versionReader, fetcher: async () => new Response("", { status: 403 }) }), /403/);
  await assert.rejects(checkUpdates("unused", { versionReader, fetcher: async () => Response.json({ tag_name: "v26.9.7-beta", prerelease: true }) }), /recognized stable/);
});
