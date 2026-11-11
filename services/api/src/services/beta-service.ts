import type { PrismaClient } from "@prisma/client";
import { contentHash, normalizeFadExport } from "@pop/connectors";

const YEARLY_MULTIPLIER = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, ANNUAL: 1, UNKNOWN: null } as const;

function jsonIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function createNotification(db: PrismaClient, workspaceId: string, kind: "PRICE_DROP" | "RENEWAL", title: string, detail: string) {
  const existing = await db.popNotification.findFirst({
    where: { workspaceId, kind, title, detail, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (!existing) await db.popNotification.create({ data: { workspaceId, kind, title, detail } });
}

export async function refreshBetaRecommendations(db: PrismaClient, workspaceId: string) {
  const [subscriptions, watches] = await Promise.all([
    db.popSubscription.findMany({ where: { workspaceId, status: { in: ["ACTIVE", "CANCEL_PENDING"] } } }),
    db.priceWatch.findMany({ where: { workspaceId, status: "TARGET_HIT" } }),
  ]);
  await db.recommendation.deleteMany({ where: { workspaceId, dismissedAt: null } });
  const now = new Date();
  const recommendations = subscriptions.flatMap((subscription) => {
    const multiplier = YEARLY_MULTIPLIER[subscription.cadence];
    if (!multiplier) return [];
    const annualCost = subscription.amountCents * multiplier;
    return [{
      workspaceId,
      type: "CANCEL_SUBSCRIPTION" as const,
      title: `Review ${subscription.merchantName} before renewal`,
      explanation: `PoP recorded a ${subscription.cadence.toLowerCase()} charge. Reviewing it could avoid up to $${(annualCost / 100).toFixed(2)} over the next year.`,
      estimatedSavingsCents: annualCost,
      currency: subscription.currency,
      confidenceBasisPoints: subscription.sourceKind === "FAD_EXPORT" ? 9_000 : 7_500,
      calculationInputs: { amountCents: subscription.amountCents, cadence: subscription.cadence },
      evidenceIds: jsonIds(subscription.evidenceIds),
      sourceTimestamps: [subscription.updatedAt.toISOString()],
      assumptions: ["The amount and cadence remain unchanged.", "Cancellation is only worthwhile if you no longer need the service."],
      actionLabel: "Review subscription",
      actionHref: "/subscriptions",
      expiresAt: subscription.nextRenewalAt,
    }];
  });
  if (recommendations.length) await db.recommendation.createMany({ data: recommendations });
  for (const watch of watches) {
    if (watch.currentPriceCents == null) continue;
    await createNotification(db, workspaceId, "PRICE_DROP", `${watch.title} reached your target`, `${watch.merchantName} is at $${(watch.currentPriceCents / 100).toFixed(2)}. Your target was $${(watch.targetPriceCents / 100).toFixed(2)}.`);
  }
  for (const subscription of subscriptions) {
    if (!subscription.nextRenewalAt) continue;
    const days = (subscription.nextRenewalAt.getTime() - now.getTime()) / 86_400_000;
    if (days >= 0 && days <= 7) await createNotification(db, workspaceId, "RENEWAL", `${subscription.merchantName} renews soon`, `PoP recorded a $${(subscription.amountCents / 100).toFixed(2)} ${subscription.cadence.toLowerCase()} renewal.`);
  }
  return { recommendations: recommendations.length, targetAlerts: watches.length };
}

export async function importFadSubscriptions(db: PrismaClient, workspaceId: string, payload: unknown) {
  const exportData = normalizeFadExport(payload);
  const observedAt = new Date(exportData.generatedAt);
  if (Number.isNaN(observedAt.getTime())) throw new Error("FAD export has an invalid generatedAt timestamp");
  return db.$transaction(async (transaction) => {
    const evidence = await transaction.evidenceRecord.upsert({
      where: { workspaceId_contentHash: { workspaceId, contentHash: exportData.contentHash } },
      create: { workspaceId, kind: "FAD_EXPORT", sourceName: "Faith Accounting export", summary: `Imported ${exportData.subscriptions.length} normalized subscription records.`, observedAt, contentHash: exportData.contentHash, metadata: { schemaVersion: exportData.schemaVersion, workspaceExternalId: exportData.workspaceExternalId } },
      update: { observedAt },
    });
    await transaction.popConnector.upsert({
      where: { workspaceId_kind_name: { workspaceId, kind: "FAD_EXPORT", name: "Faith Accounting export" } },
      create: { workspaceId, kind: "FAD_EXPORT", name: "Faith Accounting export", status: "CONNECTED", detail: "Normalized subscription metadata only.", lastSyncAt: observedAt, lastContentHash: exportData.contentHash },
      update: { status: "CONNECTED", detail: "Normalized subscription metadata only.", lastSyncAt: observedAt, lastContentHash: exportData.contentHash },
    });
    for (const item of exportData.subscriptions) {
      await transaction.popSubscription.upsert({
        where: { workspaceId_sourceFingerprint: { workspaceId, sourceFingerprint: `fad:${item.sourceId}` } },
        create: { workspaceId, merchantName: item.merchantName, amountCents: item.amountCents, currency: item.currency, cadence: item.cadence, nextRenewalAt: item.nextRenewalAt ? new Date(item.nextRenewalAt) : undefined, status: item.status, sourceKind: "FAD_EXPORT", sourceFingerprint: `fad:${item.sourceId}`, evidenceIds: [evidence.id] },
        update: { merchantName: item.merchantName, amountCents: item.amountCents, currency: item.currency, cadence: item.cadence, nextRenewalAt: item.nextRenewalAt ? new Date(item.nextRenewalAt) : undefined, status: item.status, sourceKind: "FAD_EXPORT", evidenceIds: [evidence.id], version: { increment: 1 } },
      });
    }
    return { evidenceId: evidence.id, imported: exportData.subscriptions.length, contentHash: contentHash(exportData) };
  });
}
