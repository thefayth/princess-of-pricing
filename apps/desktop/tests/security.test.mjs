import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop renderer is sandboxed and navigation is denied", async () => {
  const source = await readFile(new URL("../src/main/main.ts", import.meta.url), "utf8");
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /sandbox:\s*true/);
  assert.match(source, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(source, /validateIpcSender/);
});

test("vault uses SQLCipher mode and Electron safeStorage", async () => {
  const source = await readFile(new URL("../src/main/vault.ts", import.meta.url), "utf8");
  assert.match(source, /safeStorage\.encryptString/);
  assert.match(source, /cipher='sqlcipher'/);
  assert.match(source, /legacy=4/);
  assert.doesNotMatch(source, /password|cvv|accountNumber/);
});
