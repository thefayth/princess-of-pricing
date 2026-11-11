import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const { createDemoDashboard } = await import(process.env.POP_DOMAIN_MODULE ?? "@pop/domain");

const { chromium } = await import(process.env.POP_PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.POP_QA_URL ?? "http://127.0.0.1:4600";
const output = process.env.POP_QA_OUTPUT ?? "output/playwright";
await mkdir(output, { recursive: true });
const fixture = createDemoDashboard();
const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    for (const theme of ["royal-atlas", "rose-ledger", "emerald-arcade"]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      await context.addInitScript((value: string) => { if (!localStorage.getItem("pop.appearance.theme.v1")) localStorage.setItem("pop.appearance.theme.v1", value); }, theme);
      await context.route("**/api/pop/session", (route: any) => route.fulfill({ json: { authenticated: true } }));
      await context.route("**/api/pop/me", (route: any) => route.fulfill({ json: { workspaces: [{ workspace: fixture.workspace }] } }));
      await context.route("**/api/pop/workspaces/*/pop/dashboard", (route: any) => route.fulfill({ json: fixture }));
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error: Error) => errors.push(error.message));
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(`.pop-shell[data-theme="${theme}"]`).waitFor();
      await page.getByRole("button", { name: "Review & Decide" }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      assert.equal(await page.locator(".live-gate").count(), 0);
      assert.equal(await page.getByLabel("Theme", { exact: true }).inputValue(), theme);
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, missing: [...document.images].filter((image) => !image.complete || !image.naturalWidth).map((image) => image.src) }));
      assert.ok(dimensions.scroll <= dimensions.width, `${theme} ${viewport.width}: horizontal overflow`);
      assert.deepEqual(dimensions.missing, [], "All visible assets load");
      assert.deepEqual(errors, [], "No critical browser errors");
      if (viewport.width > 760) {
        const overlaps = await page.locator(".kingdom-map-stage .kingdom-hotspot").evaluateAll((links: Element[]) => {
          const boxes = links.map((link) => ({ name: link.textContent, box: link.getBoundingClientRect() }));
          return boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => a.box.left < b.box.right && a.box.right > b.box.left && a.box.top < b.box.bottom && a.box.bottom > b.box.top).map((b) => [a.name, b.name]));
        });
        assert.deepEqual(overlaps, [], "District labels do not overlap");
      }
      await page.screenshot({ path: path.join(output, `${theme}-${viewport.width}.png`), fullPage: true });
      await page.getByLabel("Theme", { exact: true }).selectOption(theme === "rose-ledger" ? "royal-atlas" : "rose-ledger");
      const selected = await page.getByLabel("Theme", { exact: true }).inputValue();
      assert.equal(await page.evaluate(() => localStorage.getItem("pop.appearance.theme.v1")), selected);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.getByLabel("Theme", { exact: true }).inputValue(), selected);
      results.push({ theme, viewport, errors, assets: "loaded", selected, fixture: "synthetic; test-intercepted only" });
      await context.close();
    }
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.message));
    await page.goto(`${base}/plans`, { waitUntil: "networkidle" });
    assert.match(await page.title(), /Princess of Pricing/);
    assert.match(await page.locator("body").innerText(), /proposed/i);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, `plans-${viewport.width}.png`), fullPage: true });
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Sign in to Princess of Pricing" }).waitFor();
  assert.ok(await page.getByRole("link", { name: "Continue with Google" }).isVisible());
  await context.close();
  await writeFile(path.join(output, "theme-browser-results.json"), JSON.stringify({ base, results, publicGate: "verified", plansViewports: 3 }, null, 2));
  console.log(`Passed ${results.length} theme/viewport workflows, three plans views, and the signed-out gate.`);
} finally {
  await browser.close();
}
