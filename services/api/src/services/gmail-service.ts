import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { normalizeGmailMetadata } from "@pop/connectors";
import { env } from "../config/env";
import { decryptConnectorValue, encryptConnectorValue } from "./connector-crypto";
import { AppError } from "../utils/app-error";

type GmailConfig = { email: string; refreshToken: ReturnType<typeof encryptConnectorValue>; accessToken?: ReturnType<typeof encryptConnectorValue>; expiresAt?: string };
type GmailMessage = { id: string; internalDate?: string; payload?: { headers?: Array<{ name?: string; value?: string }> } };

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function activeToken(config: GmailConfig) {
  if (config.accessToken && config.expiresAt && new Date(config.expiresAt).getTime() > Date.now() + 60_000) return decryptConnectorValue(config.accessToken);
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) throw new AppError(503, "Google connector is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: decryptConnectorValue(config.refreshToken), grant_type: "refresh_token" }) });
  const payload = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !payload?.access_token) throw new AppError(502, "Gmail connection needs to be reconnected");
  return payload.access_token;
}

export async function saveGmailConnection(db: PrismaClient, workspaceId: string, input: { email: string; refreshToken: string; accessToken?: string; expiresAt?: Date }) {
  const config: GmailConfig = { email: input.email.toLowerCase(), refreshToken: encryptConnectorValue(input.refreshToken), accessToken: input.accessToken ? encryptConnectorValue(input.accessToken) : undefined, expiresAt: input.expiresAt?.toISOString() };
  return db.popConnector.upsert({
    where: { workspaceId_kind_name: { workspaceId, kind: "GMAIL_METADATA", name: "Gmail metadata" } },
    create: { workspaceId, kind: "GMAIL_METADATA", name: "Gmail metadata", status: "CONNECTED", detail: `Metadata only for ${config.email}; no email bodies are retained.`, config },
    update: { status: "CONNECTED", detail: `Metadata only for ${config.email}; no email bodies are retained.`, config },
  });
}

export async function scanGmailMetadata(db: PrismaClient, workspaceId: string) {
  const connector = await db.popConnector.findUnique({ where: { workspaceId_kind_name: { workspaceId, kind: "GMAIL_METADATA", name: "Gmail metadata" } } });
  if (!connector?.config || connector.status !== "CONNECTED") throw new AppError(409, "Connect Gmail before scanning");
  const config = connector.config as unknown as GmailConfig;
  const token = await activeToken(config);
  const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50", { headers: { authorization: `Bearer ${token}` } });
  const listing = await list.json().catch(() => null) as { messages?: Array<{ id: string }> } | null;
  if (!list.ok) throw new AppError(502, "Gmail metadata could not be read");
  let imported = 0;
  for (const item of listing?.messages ?? []) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) continue;
    const message = await response.json() as GmailMessage;
    const headers = new Map((message.payload?.headers ?? []).map((header) => [header.name?.toLowerCase() ?? "", header.value ?? ""]));
    const from = headers.get("from") ?? "";
    const domain = from.match(/@([a-z0-9.-]+)/i)?.[1] ?? "unknown";
    const normalized = normalizeGmailMetadata({ messageId: message.id, fromDomain: domain, subject: headers.get("subject") ?? "(no subject)", receivedAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : headers.get("date") ?? new Date().toISOString() });
    await db.evidenceRecord.upsert({
      where: { workspaceId_contentHash: { workspaceId, contentHash: hash(`gmail:${normalized.messageIdHash}`) } },
      create: { workspaceId, kind: "EMAIL_METADATA", sourceName: `Gmail: ${normalized.fromDomain}`, summary: normalized.subject, observedAt: new Date(normalized.receivedAt), contentHash: hash(`gmail:${normalized.messageIdHash}`), metadata: { fromDomain: normalized.fromDomain, possibleSubscription: normalized.possibleSubscription, receivedAt: normalized.receivedAt } },
      update: { observedAt: new Date(normalized.receivedAt) },
    });
    imported += 1;
  }
  await db.popConnector.update({ where: { id: connector.id }, data: { lastSyncAt: new Date(), lastContentHash: hash(`${workspaceId}:${Date.now()}`), detail: `Metadata-only scan reviewed ${imported} message headers; no bodies are retained.` } });
  return { imported };
}
