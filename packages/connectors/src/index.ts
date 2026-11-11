import { createHash } from "node:crypto";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export type FadSubscriptionExport = {
  sourceId: string;
  merchantName: string;
  amountCents: number;
  currency: string;
  cadence: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "UNKNOWN";
  nextRenewalAt?: string;
  status: "ACTIVE" | "CANCEL_PENDING" | "CANCELLED" | "PAUSED";
  confidenceBasisPoints: number;
};

export type FadPopExport = {
  schemaVersion: "pop-fad-export/v1";
  workspaceExternalId: string;
  generatedAt: string;
  subscriptions: FadSubscriptionExport[];
  contentHash: string;
};

export function normalizeFadExport(input: unknown): FadPopExport {
  if (!input || typeof input !== "object") throw new Error("FAD export must be an object");
  const source = input as Record<string, unknown>;
  if (source.schemaVersion !== "pop-fad-export/v1") throw new Error("Unsupported FAD export version");
  const rawSubscriptions = Array.isArray(source.subscriptions) ? source.subscriptions : [];
  const subscriptions = rawSubscriptions.map((raw) => {
    const item = raw as Record<string, unknown>;
    const amountCents = Number(item.amountCents);
    if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("Invalid subscription amount");
    return {
      sourceId: String(item.sourceId),
      merchantName: String(item.merchantName).trim(),
      amountCents,
      currency: String(item.currency ?? "USD").toUpperCase(),
      cadence: String(item.cadence ?? "UNKNOWN") as FadSubscriptionExport["cadence"],
      nextRenewalAt: item.nextRenewalAt ? String(item.nextRenewalAt) : undefined,
      status: String(item.status ?? "ACTIVE") as FadSubscriptionExport["status"],
      confidenceBasisPoints: Math.max(0, Math.min(10_000, Number(item.confidenceBasisPoints ?? 0))),
    };
  });
  const normalized = {
    schemaVersion: "pop-fad-export/v1" as const,
    workspaceExternalId: String(source.workspaceExternalId),
    generatedAt: String(source.generatedAt),
    subscriptions,
  };
  return { ...normalized, contentHash: contentHash(normalized) };
}

export type GmailMetadata = {
  messageId: string;
  fromDomain: string;
  subject: string;
  receivedAt: string;
};

export function normalizeGmailMetadata(input: GmailMetadata) {
  const subject = input.subject.replace(/\s+/g, " ").trim().slice(0, 240);
  return {
    messageIdHash: contentHash(input.messageId),
    fromDomain: input.fromDomain.toLowerCase().replace(/^www\./, "").slice(0, 160),
    subject,
    receivedAt: new Date(input.receivedAt).toISOString(),
    possibleSubscription: /renew|receipt|subscription|membership|trial|billing/i.test(subject),
    contentHash: contentHash({ fromDomain: input.fromDomain, subject, receivedAt: input.receivedAt }),
  };
}

export type DealSource = {
  serviceName: string;
  title: string;
  planName: string;
  eligibility: "NEW_ONLY" | "RETURNING_ONLY" | "STUDENT" | "FAMILY" | "DEVICE" | "PARTNER" | "ANY" | "UNKNOWN";
  priceCents: number;
  renewalPriceCents?: number;
  trialDays?: number;
  currency?: string;
  sourceName: string;
  sourceUrl: string;
  validThrough?: string;
  termsSummary?: string;
};

export function normalizeDealSource(input: DealSource) {
  if (!input.serviceName.trim() || !input.title.trim() || !input.planName.trim()) throw new Error("Deal source identity is required");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) throw new Error("Deal price must be a non-negative integer number of cents");
  const sourceUrl = assertAllowedMerchantUrl(input.sourceUrl, [new URL(input.sourceUrl).hostname]);
  const observedAt = new Date().toISOString();
  const normalized = {
    serviceName: input.serviceName.trim(),
    title: input.title.trim(),
    planName: input.planName.trim(),
    eligibility: input.eligibility,
    priceCents: input.priceCents,
    renewalPriceCents: input.renewalPriceCents,
    trialDays: input.trialDays,
    currency: (input.currency ?? "USD").toUpperCase(),
    sourceName: input.sourceName.trim(),
    sourceUrl: sourceUrl.toString(),
    validThrough: input.validThrough ? new Date(input.validThrough).toISOString() : undefined,
    termsSummary: input.termsSummary?.trim().slice(0, 1000),
    observedAt,
  };
  return { ...normalized, contentHash: contentHash(normalized) };
}

export function assertAllowedMerchantUrl(rawUrl: string, allowedHosts: string[]) {
  const url = new URL(rawUrl);
  const allowed = allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (url.protocol !== "https:" || !allowed) throw new Error("Merchant source is not allowlisted");
  return url;
}
