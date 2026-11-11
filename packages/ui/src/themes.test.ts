import assert from "node:assert/strict";
import test from "node:test";
import { POP_THEMES, parsePopTheme, themePortrait } from "./themes.js";

test("only the three approved themes can be restored", () => {
  assert.equal(POP_THEMES.length, 3);
  for (const theme of POP_THEMES) assert.equal(parsePopTheme(theme.id), theme.id);
  for (const invalid of [null, undefined, "dark", "__proto__", {}, 1]) assert.equal(parsePopTheme(invalid), "royal-atlas");
});
test("themes use approved Faith portraits without changing the shared data", () => {
  assert.equal(themePortrait("rose-ledger"), "/assets/princess/faith-pink.png");
  assert.equal(themePortrait("royal-atlas"), themePortrait("emerald-arcade"));
  assert.equal(themePortrait("rose-ledger", "/test/"), "/test/faith-pink.png");
});
