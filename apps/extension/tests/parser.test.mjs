import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("extension is user-activated and has no persistent content script", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1:48731/*"]);
});

test("parser does not collect unrelated browsing fields", async () => {
  const source = await readFile(new URL("../parser.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /history|cookie|localStorage|document\.body|innerText/);
  assert.match(source, /application\/ld\+json/);
});

test("promo workflow is user-activated and refuses checkout submission controls", async () => {
  const source = await readFile(new URL("../checkout.mjs", import.meta.url), "utf8");
  assert.match(source, /slice\(0, 10\)/);
  assert.match(source, /30_000/);
  assert.match(source, /button\[type='button'\]/);
  assert.doesNotMatch(source, /submit\(\)|payment|cardNumber/i);
});
