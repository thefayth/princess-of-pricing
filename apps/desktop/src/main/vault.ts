import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3-multiple-ciphers";
import { safeStorage } from "electron";

export type BrowserObservation = {
  schemaVersion: "pop-browser-observation/v1";
  title: string;
  merchantName: string;
  priceCents: number;
  currency: string;
  url: string;
  observedAt: string;
};

export type PromoAttempt = { schemaVersion: "pop-promo-attempt/v1"; url: string; attemptedAt: string; results: Array<{ codeHash: string; outcome: string; savingsCents: number | null }> };

export class LocalVault {
  private readonly db: Database.Database;
  readonly databasePath: string;

  constructor(dataRoot: string) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable");
    mkdirSync(dataRoot, { recursive: true });
    const keyPath = join(dataRoot, "vault-key.dpapi");
    const key = existsSync(keyPath)
      ? safeStorage.decryptString(Buffer.from(readFileSync(keyPath, "utf8"), "base64"))
      : randomBytes(32).toString("hex");
    if (!existsSync(keyPath)) {
      writeFileSync(keyPath, safeStorage.encryptString(key).toString("base64"), { encoding: "utf8", mode: 0o600, flag: "wx" });
    }

    this.databasePath = join(dataRoot, "pop-vault.sqlite3");
    this.db = new Database(this.databasePath);
    this.db.pragma("cipher='sqlcipher'");
    this.db.pragma("legacy=4");
    this.db.pragma(`key='${key}'`);
    this.db.pragma("journal_mode=WAL");
    this.db.pragma("foreign_keys=ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sync_events (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  addObservation(idempotencyKey: string, observation: BrowserObservation) {
    const result = this.db.prepare("INSERT OR IGNORE INTO observations (idempotency_key, payload_json, observed_at) VALUES (?, ?, ?)").run(idempotencyKey, JSON.stringify(observation), observation.observedAt);
    if (result.changes === 1) this.db.prepare("INSERT OR IGNORE INTO sync_events (id, entity_type, entity_id, operation, payload_json, idempotency_key) VALUES (?, ?, ?, 'APPEND', ?, ?)").run(`observation:${idempotencyKey}`, "BrowserObservation", idempotencyKey, JSON.stringify(observation), `observation:${idempotencyKey}`);
    return { inserted: result.changes === 1 };
  }

  addPromoAttempt(idempotencyKey: string, attempt: PromoAttempt) {
    const result = this.db.prepare("INSERT OR IGNORE INTO observations (idempotency_key, payload_json, observed_at) VALUES (?, ?, ?)").run(idempotencyKey, JSON.stringify(attempt), attempt.attemptedAt);
    if (result.changes === 1) this.db.prepare("INSERT OR IGNORE INTO sync_events (id, entity_type, entity_id, operation, payload_json, idempotency_key) VALUES (?, ?, ?, 'APPEND', ?, ?)").run(`promo:${idempotencyKey}`, "PromoAttempt", idempotencyKey, JSON.stringify(attempt), `promo:${idempotencyKey}`);
    return { inserted: result.changes === 1 };
  }

  setting<T>(key: string): T | undefined {
    const row = this.db.prepare("SELECT value_json FROM settings WHERE key = ?").get(key) as { value_json: string } | undefined;
    return row ? JSON.parse(row.value_json) as T : undefined;
  }

  setSetting(key: string, value: unknown) {
    this.db.prepare("INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, version = settings.version + 1, updated_at = CURRENT_TIMESTAMP").run(key, JSON.stringify(value));
  }

  pendingSyncEvents() { return this.db.prepare("SELECT id, entity_type, entity_id, operation, payload_json, idempotency_key FROM sync_events WHERE state = 'PENDING' ORDER BY created_at ASC LIMIT 100").all() as Array<{ id: string; entity_type: string; entity_id: string; operation: "APPEND" | "UPSERT" | "DELETE"; payload_json: string; idempotency_key: string }>; }
  markSynced(id: string) { this.db.prepare("UPDATE sync_events SET state = 'SYNCED' WHERE id = ?").run(id); }

  listObservations() {
    return this.db.prepare("SELECT id, payload_json, observed_at, created_at FROM observations ORDER BY id DESC LIMIT 250").all();
  }

  status() {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM observations").get() as { count: number };
    const pairing = this.setting<{ workspaceId: string; devicePublicId: string; expiresAt: string }>("pairing");
    return { encrypted: true, cipher: "sqlcipher", databasePath: this.databasePath, observations: row.count, paired: Boolean(pairing), workspaceId: pairing?.workspaceId, tokenExpiresAt: pairing?.expiresAt };
  }

  close() {
    this.db.close();
  }
}
