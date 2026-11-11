import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the PoP command center", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Princess of Pricing<\/title>/i);
  assert.match(html, /Next Money Move/i);
  assert.match(html, /Savings Kingdom/i);
  assert.match(html, /Evidence-first mode/i);
  for (const theme of ["Royal Atlas", "Rose Ledger", "Emerald Arcade"]) assert.ok(html.includes(theme));
  assert.doesNotMatch(html, /Starter Project|react-loading-skeleton|Building your site/i);
});

test("plans page is public and does not enable billing", async () => {
  const response = await render("/plans");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Princess of Pricing/);
  assert.match(html, /Proposed membership pricing/);
  assert.match(html, /Billing is not live/);
  assert.doesNotMatch(html, /live-gate-panel|checkout\.stripe\.com/);
});

test("renders every primary product route", async () => {
  for (const [path, label] of [
    ["/watchlist", "Watchlist"],
    ["/subscriptions", "Subscriptions"],
    ["/wallet", "Points Palace"],
    ["/nearby", "PoP Game Stops"],
    ["/evidence", "Evidence ledger"],
    ["/connections", "Connections"],
    ["/settings", "Settings"],
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(label, "i"), path);
  }
});
