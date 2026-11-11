import { app, BrowserWindow, ipcMain, session } from "electron";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalVault, type BrowserObservation, type PromoAttempt } from "./vault";

app.setName("Prince of Pricing");
const isSelfTest = process.argv.includes("--self-test");
const dataRoot = isSelfTest
  ? mkdtempSync(join(tmpdir(), "pop-self-test-"))
  : join(process.env.LOCALAPPDATA ?? app.getPath("appData"), "PrinceOfPricing");
app.setPath("userData", dataRoot);

let vault: LocalVault;
let mainWindow: BrowserWindow | null = null;

function rendererUrl() {
  return new URL(`file://${join(__dirname, "../renderer/index.html").replace(/\\/g, "/")}`).href;
}

function validateIpcSender(url: string) {
  if (!url.startsWith(rendererUrl())) throw new Error("Untrusted IPC sender");
}

function validObservation(value: unknown): value is BrowserObservation {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.schemaVersion === "pop-browser-observation/v1"
    && typeof item.title === "string" && item.title.length <= 240
    && typeof item.merchantName === "string" && item.merchantName.length <= 160
    && Number.isInteger(item.priceCents) && Number(item.priceCents) >= 0
    && typeof item.currency === "string" && /^[A-Z]{3}$/.test(item.currency)
    && typeof item.url === "string" && item.url.startsWith("https://")
    && typeof item.observedAt === "string";
}

function validPromoAttempt(value: unknown): value is PromoAttempt {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.schemaVersion === "pop-promo-attempt/v1" && typeof item.url === "string" && item.url.startsWith("https://") && typeof item.attemptedAt === "string" && Array.isArray(item.results) && item.results.length <= 10 && item.results.every((result) => result && typeof result === "object" && typeof (result as Record<string, unknown>).codeHash === "string" && typeof (result as Record<string, unknown>).outcome === "string");
}

function startExtensionIntake() {
  const server = createServer((request, response) => {
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "content-type,idempotency-key");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    if (request.method !== "POST" || !["/observations", "/promo-attempts"].includes(request.url ?? "") || request.socket.remoteAddress !== "127.0.0.1") {
      response.writeHead(404).end(); return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 65_536) request.destroy(); else chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const key = request.headers["idempotency-key"];
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (typeof key !== "string" || key.length < 8) throw new Error("Invalid intake");
        const result = request.url === "/observations" && validObservation(payload) ? vault.addObservation(key, payload) : request.url === "/promo-attempts" && validPromoAttempt(payload) ? vault.addPromoAttempt(key, payload) : (() => { throw new Error("Invalid intake"); })();
        response.writeHead(result.inserted ? 201 : 200, { "content-type": "application/json" }).end(JSON.stringify(result));
      } catch {
        response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "Invalid observation" }));
      }
    });
  });
  server.listen(48731, "127.0.0.1");
  return server;
}

async function pairDesktop(code: string) {
  const base = process.env.POP_API_URL ?? "https://pop.thefayth.net/api/v1";
  const response = await fetch(`${base.replace(/\/$/, "")}/auth/device/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.trim().toUpperCase(), name: "Prince of Pricing for Windows", platform: "windows" }) });
  const payload = await response.json().catch(() => null) as { deviceToken?: string; devicePublicId?: string; workspaceId?: string; expiresAt?: string; message?: string } | null;
  if (!response.ok || !payload?.deviceToken || !payload.devicePublicId || !payload.workspaceId || !payload.expiresAt) throw new Error(payload?.message ?? "Desktop pairing failed");
  vault.setSetting("pairing", payload);
  return vault.status();
}

async function syncDesktop() {
  const pairing = vault.setting<{ deviceToken: string; devicePublicId: string; workspaceId: string; expiresAt: string }>("pairing");
  if (!pairing || new Date(pairing.expiresAt).getTime() <= Date.now()) throw new Error("Pair this desktop again before syncing");
  const base = process.env.POP_API_URL ?? "https://pop.thefayth.net/api/v1";
  let synced = 0;
  for (const event of vault.pendingSyncEvents()) {
    const response = await fetch(`${base.replace(/\/$/, "")}/workspaces/${encodeURIComponent(pairing.workspaceId)}/pop/sync-events`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${pairing.deviceToken}`, "idempotency-key": event.idempotency_key }, body: JSON.stringify({ devicePublicId: pairing.devicePublicId, entityType: event.entity_type, entityId: event.entity_id, operation: event.operation, payload: JSON.parse(event.payload_json) }) });
    if (!response.ok) throw new Error("Desktop sync paused; your saved records remain local.");
    vault.markSynced(event.id);
    synced += 1;
  }
  return { synced, status: vault.status() };
}

function createWindow() {
  const preload = join(__dirname, "preload.js");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#f5f5f1",
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => { if (url !== rendererUrl()) event.preventDefault(); });
  void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  vault = new LocalVault(dataRoot);
  if (isSelfTest) {
    const status = vault.status();
    console.log(JSON.stringify({ ok: status.encrypted, cipher: status.cipher, dataRoot: "temporary" }));
    vault.close();
    rmSync(dataRoot, { recursive: true, force: true });
    app.quit();
    return;
  }

  const intake = startExtensionIntake();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ipcMain.handle("vault:status", (event) => { validateIpcSender(event.senderFrame?.url ?? ""); return vault.status(); });
  ipcMain.handle("vault:list-observations", (event) => { validateIpcSender(event.senderFrame?.url ?? ""); return vault.listObservations(); });
  ipcMain.handle("vault:pair", (event, code: unknown) => { validateIpcSender(event.senderFrame?.url ?? ""); if (typeof code !== "string" || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code)) throw new Error("Enter the 12-character pairing code"); return pairDesktop(code); });
  ipcMain.handle("vault:sync", (event) => { validateIpcSender(event.senderFrame?.url ?? ""); return syncDesktop(); });
  createWindow();
  app.on("before-quit", () => { intake.close(); vault.close(); });
});

app.on("window-all-closed", () => app.quit());
