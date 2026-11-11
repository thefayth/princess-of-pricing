import { WorkspaceRole, type Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { contentHash } from "@pop/connectors";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { workspaceParamsSchema } from "../schemas/common";
import {
  createCancellationTaskBodySchema,
  calculateRewardScenarioBodySchema,
  createCardBodySchema,
  createCancellationRunBodySchema,
  createDealOfferBodySchema,
  createFinancialGoalBodySchema,
  createGameStopBodySchema,
  createGameStopEventBodySchema,
  createGameStopSessionBodySchema,
  importFadBodySchema,
  createPointsAccountBodySchema,
  createPointsRegisterEntryBodySchema,
  createSubscriptionBodySchema,
  createSubscriptionServiceBodySchema,
  createSyncEventBodySchema,
  createWatchBodySchema,
  completeGameStopSessionBodySchema,
  connectGmailBodySchema,
  createDevicePairingBodySchema,
  gameStopsQuerySchema,
  pointsRegisterQuerySchema,
  resolveDuplicateCandidateBodySchema,
  updateAutomationPolicyBodySchema,
  updateCancellationTaskBodySchema,
  updateGameStopBodySchema,
  updateGameStopEventBodySchema,
  updatePointsModeBodySchema,
} from "../schemas/pop";
import { saveGmailConnection, scanGmailMetadata } from "../services/gmail-service";
import { replayIdempotency, requireIdempotencyKey, withIdempotency } from "../services/idempotency-service";
import { evaluateStoredGameStopSession, hashGameStopAnswer, loadPointsPalace } from "../services/points-palace-service";
import { importFadSubscriptions, refreshBetaRecommendations } from "../services/beta-service";
import { assertWorkspaceMembership, assertWorkspaceRole } from "../services/workspace-service";
import { AppError } from "../utils/app-error";
import { serializeConnector } from "../utils/serializers";

const EDIT_ROLES = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.BOOKKEEPER];

function jsonStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function money(amountCents: number, currency = "USD") {
  return { amountCents, currency };
}

function jsonObjects(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function canonicalServiceKey(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalized.includes("spotify")) return "spotify";
  if (normalized.includes("apple music")) return "apple-music";
  return normalized.replace(/\s+/g, "-") || "unknown-service";
}

function isExactSubscriptionDuplicate(a: { serviceKey: string | null; planName: string | null; amountCents: number; currency: string; cadence: string; isBundle: boolean; isFamilyOrHousehold: boolean }, b: typeof a) {
  if (a.isBundle || b.isBundle || a.isFamilyOrHousehold || b.isFamilyOrHousehold) return false;
  return canonicalServiceKey(a.serviceKey ?? "") === canonicalServiceKey(b.serviceKey ?? "")
    && (a.planName ?? "").trim().toLowerCase() === (b.planName ?? "").trim().toLowerCase()
    && a.amountCents === b.amountCents
    && a.currency.toUpperCase() === b.currency.toUpperCase()
    && a.cadence === b.cadence;
}

export async function popRoutes(app: FastifyInstance) {
  app.get(
    "/workspaces/:workspaceId/pop/dashboard",
    {
      preHandler: app.authenticate,
      schema: { tags: ["pop"], summary: "Get the Prince of Pricing workspace dashboard", security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      const membership = await assertWorkspaceMembership(request.user.sub, workspaceId);
      const [watches, subscriptions, cancellationTasks, cards, offers, recommendations, evidence, connectors, notifications, services, dealOffers, duplicateCandidates, automationPolicy, cancellationRuns, pointsPalace] = await Promise.all([
        prisma.priceWatch.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } }),
        prisma.popSubscription.findMany({ where: { workspaceId }, orderBy: { nextRenewalAt: "asc" } }),
        prisma.cancellationTask.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } }),
        prisma.userCard.findMany({ where: { workspaceId }, include: { rewardRules: true }, orderBy: { createdAt: "asc" } }),
        prisma.offer.findMany({ where: { workspaceId }, include: { merchant: true }, orderBy: { observedAt: "desc" }, take: 100 }),
        prisma.recommendation.findMany({ where: { workspaceId, dismissedAt: null }, orderBy: [{ estimatedSavingsCents: "desc" }, { createdAt: "desc" }], take: 50 }),
        prisma.evidenceRecord.findMany({ where: { workspaceId }, orderBy: { observedAt: "desc" }, take: 250 }),
        prisma.popConnector.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
        prisma.popNotification.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
        prisma.subscriptionService.findMany({ where: { workspaceId }, orderBy: { displayName: "asc" } }),
        prisma.dealOffer.findMany({ where: { workspaceId }, orderBy: { observedAt: "desc" }, take: 100 }),
        prisma.duplicateCandidate.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 100 }),
        prisma.automationPolicy.findUnique({ where: { workspaceId } }),
        prisma.cancellationRun.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
        loadPointsPalace(workspaceId, request.user.sub),
      ]);

      return {
        workspace: { id: membership.workspace.id, name: membership.workspace.name, mode: "LIVE" },
        generatedAt: new Date().toISOString(),
        watches: watches.map((item) => ({ ...item, targetPrice: money(item.targetPriceCents, item.currency), currentPrice: item.currentPriceCents == null ? undefined : money(item.currentPriceCents, item.currency) })),
        subscriptions: subscriptions.map((item) => ({ ...item, amount: money(item.amountCents, item.currency), evidenceIds: jsonStrings(item.evidenceIds) })),
        cancellationTasks: cancellationTasks.map((item) => ({ ...item, instructions: jsonStrings(item.instructions) })),
        cards: cards.map((card) => ({ ...card, rewardRules: card.rewardRules.map((rule) => ({ ...rule, evidenceIds: jsonStrings(rule.evidenceIds) })) })),
        offers: offers.map((offer) => ({ ...offer, currentPrice: money(offer.currentPriceCents, offer.currency), originalPrice: offer.originalPriceCents == null ? undefined : money(offer.originalPriceCents, offer.currency), evidenceIds: [] })),
        recommendations: recommendations.map((item) => ({ ...item, estimatedSavings: money(item.estimatedSavingsCents, item.currency), confidence: item.confidenceBasisPoints / 10_000, evidenceIds: jsonStrings(item.evidenceIds), assumptions: jsonStrings(item.assumptions) })),
        evidence: evidence.map((item) => ({ ...item, contentHash: item.contentHash })),
        connectors: connectors.map(serializeConnector),
        notifications: notifications.map((item) => ({ id: item.id, title: item.title, body: item.detail, severity: item.kind === "RENEWAL" || item.kind === "OFFER_EXPIRING" ? "URGENT" as const : "OPPORTUNITY" as const, createdAt: item.createdAt, read: Boolean(item.readAt) })),
        subscriptionRadar: {
          services: services.map((item) => ({ ...item, aliases: jsonStrings(item.aliases), domains: jsonStrings(item.domains), category: item.category, automationSupported: item.automationSupported })),
          dealOffers: dealOffers.map((item) => ({ ...item, price: money(item.priceCents, item.currency), renewalPrice: item.renewalPriceCents == null ? undefined : money(item.renewalPriceCents, item.currency), evidenceIds: jsonStrings(item.evidenceIds), confidence: item.confidenceBasisPoints / 10_000 })),
          duplicateCandidates: duplicateCandidates.map((item) => ({ ...item, subscriptionIds: [item.subscriptionAId, item.subscriptionBId], confidence: item.confidenceBasisPoints / 10_000, reasons: jsonStrings(item.reasons), evidenceIds: jsonStrings(item.evidenceIds) })),
          automationPolicy: automationPolicy ? { ...automationPolicy, protectedServiceKeys: jsonStrings(automationPolicy.protectedServiceKeys), protectedPlanKinds: jsonStrings(automationPolicy.protectedPlanKinds) } : undefined,
          cancellationRuns,
        },
        pointsPalace,
      };
    },
  );

  app.post("/workspaces/:workspaceId/pop/watches", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createWatchBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-watch", async () => {
      await prisma.evidenceRecord.upsert({
        where: { workspaceId_contentHash: { workspaceId, contentHash: contentHash({ kind: "manual-watch", key }) } },
        create: { workspaceId, kind: "USER_CONFIRMATION", sourceName: "Manual price watch", summary: `You set a target for ${body.title} at ${body.merchantName}.`, observedAt: new Date(), contentHash: contentHash({ kind: "manual-watch", key }) },
        update: {},
      });
      const watch = await prisma.priceWatch.create({ data: { workspaceId, ...body, status: body.currentPriceCents != null && body.currentPriceCents <= body.targetPriceCents ? "TARGET_HIT" : "WATCHING" } });
      return { statusCode: 201, response: { watch } };
    });
    await refreshBetaRecommendations(prisma, workspaceId);
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/subscriptions", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createSubscriptionBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-subscription", async () => {
      const evidence = await prisma.evidenceRecord.upsert({
        where: { workspaceId_contentHash: { workspaceId, contentHash: contentHash({ kind: "manual-subscription", key }) } },
        create: { workspaceId, kind: "USER_CONFIRMATION", sourceName: "Manual subscription entry", summary: `You recorded ${body.merchantName} as a ${body.cadence.toLowerCase()} subscription.`, observedAt: new Date(), contentHash: contentHash({ kind: "manual-subscription", key }) },
        update: {},
      });
      const subscription = await prisma.popSubscription.create({ data: { workspaceId, ...body, evidenceIds: [...body.evidenceIds, evidence.id] } });
      return { statusCode: 201, response: { subscription } };
    });
    await refreshBetaRecommendations(prisma, workspaceId);
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/imports/fad", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = importFadBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "import-fad", async () => {
      const imported = await importFadSubscriptions(prisma, workspaceId, body.payload);
      const summary = await refreshBetaRecommendations(prisma, workspaceId);
      return { statusCode: 201, response: { ...imported, ...summary } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/recommendations/recalculate", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "recalculate-beta-recommendations", async () => ({ statusCode: 200, response: await refreshBetaRecommendations(prisma, workspaceId) }));
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/connectors/gmail", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = connectGmailBodySchema.parse(request.body);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "connect-gmail", async () => ({ statusCode: 201, response: { connector: serializeConnector(await saveGmailConnection(prisma, workspaceId, body)) } }));
    // Old idempotency records may still contain the full connector configuration.
    return reply.code(result.statusCode).send({ connector: serializeConnector(result.response.connector as Parameters<typeof serializeConnector>[0]) });
  });

  app.post("/workspaces/:workspaceId/pop/connectors/gmail/scan", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "scan-gmail-metadata", async () => ({ statusCode: 200, response: await scanGmailMetadata(prisma, workspaceId) }));
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/device-pairings", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createDevicePairingBodySchema.parse(request.body);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-device-pairing", async () => {
      const code = [randomBytes(2).toString("hex"), randomBytes(2).toString("hex"), randomBytes(2).toString("hex")].join("-").toUpperCase();
      await prisma.devicePairing.create({ data: { workspaceId, userId: request.user.sub, codeHash: createHash("sha256").update(code).digest("hex"), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
      return { statusCode: 201, response: { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), deviceName: body.name } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/subscription-services", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const services = await prisma.subscriptionService.findMany({ where: { workspaceId }, orderBy: { displayName: "asc" } });
    return { services: services.map((item) => ({ ...item, aliases: jsonStrings(item.aliases), domains: jsonStrings(item.domains) })) };
  });

  app.post("/workspaces/:workspaceId/pop/subscription-services", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createSubscriptionServiceBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-subscription-service", async () => {
      const service = await prisma.subscriptionService.upsert({
        where: { workspaceId_canonicalKey: { workspaceId, canonicalKey: body.canonicalKey } },
        create: { workspaceId, ...body },
        update: { displayName: body.displayName, aliases: body.aliases, domains: body.domains, category: body.category, automationSupported: body.automationSupported },
      });
      return { statusCode: 201, response: { service } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/deal-offers", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const offers = await prisma.dealOffer.findMany({ where: { workspaceId }, orderBy: { observedAt: "desc" }, take: 100 });
    return { offers: offers.map((item) => ({ ...item, evidenceIds: jsonStrings(item.evidenceIds), terms: jsonObjects(item.terms) })) };
  });

  app.post("/workspaces/:workspaceId/pop/deal-offers", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createDealOfferBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-deal-offer", async () => {
      const { terms, serviceId, ...offerBody } = body;
      const offer = await prisma.dealOffer.upsert({
        where: { workspaceId_contentHash: { workspaceId, contentHash: body.contentHash } },
        create: { workspaceId, ...offerBody, serviceId, terms: terms as Prisma.InputJsonObject | undefined },
        update: { ...offerBody, terms: terms as Prisma.InputJsonObject | undefined, updatedAt: new Date() },
      });
      return { statusCode: 201, response: { offer } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/duplicate-candidates", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const candidates = await prisma.duplicateCandidate.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
    return { candidates: candidates.map((item) => ({ ...item, subscriptionIds: [item.subscriptionAId, item.subscriptionBId], reasons: jsonStrings(item.reasons), evidenceIds: jsonStrings(item.evidenceIds), confidence: item.confidenceBasisPoints / 10_000 })) };
  });

  app.post("/workspaces/:workspaceId/pop/duplicate-candidates/scan", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "scan-duplicate-candidates", async () => {
      const [subscriptions, policy] = await Promise.all([
        prisma.popSubscription.findMany({ where: { workspaceId, status: { in: ["ACTIVE", "CANCEL_PENDING"] } }, orderBy: { createdAt: "asc" } }),
        prisma.automationPolicy.findUnique({ where: { workspaceId } }),
      ]);
      const candidates = [];
      for (let firstIndex = 0; firstIndex < subscriptions.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < subscriptions.length; secondIndex += 1) {
          const first = subscriptions[firstIndex];
          const second = subscriptions[secondIndex];
          if (!isExactSubscriptionDuplicate(first, second)) continue;
          const [subscriptionAId, subscriptionBId] = [first.id, second.id].sort();
          const reasons = ["Same canonical service, plan, cadence, currency, and amount", "Both records are active recurring charges"];
          const protectedByPolicy = !policy?.enabled || !policy.autoCancelExactDuplicates || jsonStrings(policy.protectedServiceKeys).includes(canonicalServiceKey(first.serviceKey ?? first.merchantName)) || jsonStrings(policy.protectedPlanKinds).some((kind) => (first.planName ?? "").toLowerCase().includes(kind.toLowerCase())) || Boolean(first.lastUsedAt && Date.now() - first.lastUsedAt.getTime() < (policy.recentlyUsedDays * 86_400_000));
          const candidate = await prisma.duplicateCandidate.upsert({
            where: { workspaceId_subscriptionAId_subscriptionBId_type: { workspaceId, subscriptionAId, subscriptionBId, type: "ACTIVE_SERVICE_DUPLICATE" } },
            create: { workspaceId, type: "ACTIVE_SERVICE_DUPLICATE", subscriptionAId, subscriptionBId, serviceKey: canonicalServiceKey(first.serviceKey ?? first.merchantName), confidenceBasisPoints: 9_000, status: protectedByPolicy ? "PENDING_REVIEW" : "AUTO_CANCEL_ELIGIBLE", reasons, evidenceIds: first.evidenceIds as Prisma.InputJsonArray },
            update: { confidenceBasisPoints: 9_000, status: protectedByPolicy ? "PENDING_REVIEW" : "AUTO_CANCEL_ELIGIBLE", reasons, evidenceIds: first.evidenceIds as Prisma.InputJsonArray, updatedAt: new Date() },
          });
          candidates.push(candidate);
        }
      }
      return { statusCode: 200, response: { candidates, scannedSubscriptions: subscriptions.length } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/deal-alerts", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    return { alerts: await prisma.dealAlert.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }) };
  });

  app.post("/workspaces/:workspaceId/pop/duplicate-candidates/:candidateId/resolve", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const { candidateId } = request.params as { candidateId: string };
    const body = resolveDuplicateCandidateBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, `resolve-duplicate:${candidateId}`, async () => {
      const updated = await prisma.duplicateCandidate.updateMany({ where: { id: candidateId, workspaceId, version: body.version }, data: { status: body.status, version: { increment: 1 } } });
      if (updated.count !== 1) throw new AppError(409, "Duplicate candidate changed and requires review");
      const candidate = await prisma.duplicateCandidate.findUniqueOrThrow({ where: { id: candidateId } });
      await prisma.actionReceipt.create({ data: { workspaceId, actionType: "DUPLICATE_CANDIDATE_RESOLVED", entityType: "DuplicateCandidate", entityId: candidateId, actorUserId: request.user.sub, idempotencyKey: key, details: { status: body.status } } });
      return { statusCode: 200, response: { candidate } };
    });
    return reply.code(result.statusCode).header("etag", `W/\"${(result.response.candidate as { version: number }).version}\"`).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/automation-policies", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const policy = await prisma.automationPolicy.findUnique({ where: { workspaceId } });
    return { policy: policy ? { ...policy, protectedServiceKeys: jsonStrings(policy.protectedServiceKeys), protectedPlanKinds: jsonStrings(policy.protectedPlanKinds) } : null };
  });

  app.put("/workspaces/:workspaceId/pop/automation-policies", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = updateAutomationPolicyBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "update-automation-policy", async () => {
      const current = await prisma.automationPolicy.findUnique({ where: { workspaceId } });
      if (body.version && current && body.version !== current.version) throw new AppError(409, "Automation policy changed and requires review");
      const policy = await prisma.automationPolicy.upsert({
        where: { workspaceId },
        create: { workspaceId, ...body, version: 1 },
        update: { enabled: body.enabled, autoCancelExactDuplicates: body.autoCancelExactDuplicates, protectedServiceKeys: body.protectedServiceKeys, protectedPlanKinds: body.protectedPlanKinds, recentlyUsedDays: body.recentlyUsedDays, maxMonthlyAmountCents: body.maxMonthlyAmountCents, dailyDealAlerts: body.dailyDealAlerts, renewalAlerts: body.renewalAlerts, version: { increment: 1 } },
      });
      await prisma.actionReceipt.create({ data: { workspaceId, actionType: "AUTOMATION_POLICY_UPDATED", entityType: "AutomationPolicy", entityId: policy.id, actorUserId: request.user.sub, idempotencyKey: key, details: { enabled: policy.enabled, autoCancelExactDuplicates: policy.autoCancelExactDuplicates } } });
      return { statusCode: 200, response: { policy } };
    });
    return reply.code(result.statusCode).header("etag", `W/\"${(result.response.policy as { version: number }).version}\"`).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/cancellation-runs", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    return { runs: await prisma.cancellationRun.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }) };
  });

  app.post("/workspaces/:workspaceId/pop/cancellation-runs", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createCancellationRunBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const candidate = await prisma.duplicateCandidate.findFirst({ where: { id: body.candidateId, workspaceId } });
    const subscription = await prisma.popSubscription.findFirst({ where: { id: body.subscriptionId, workspaceId } });
    if (!candidate || !subscription) throw new AppError(404, "Cancellation target not found");
    if (candidate.status !== "AUTO_CANCEL_ELIGIBLE") throw new AppError(409, "Candidate is not eligible for automatic cancellation");
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-cancellation-run", async () => {
      const run = await prisma.$transaction(async (transaction) => {
        const created = await transaction.cancellationRun.create({ data: { workspaceId, candidateId: candidate.id, subscriptionId: subscription.id, adapterKey: body.adapterKey, reason: body.reason } });
        await transaction.duplicateCandidate.update({ where: { id: candidate.id }, data: { status: "CANCEL_IN_PROGRESS", version: { increment: 1 } } });
        return created;
      });
      await prisma.actionReceipt.create({ data: { workspaceId, actionType: "CANCELLATION_RUN_PLANNED", entityType: "CancellationRun", entityId: run.id, actorUserId: request.user.sub, idempotencyKey: key, details: { candidateId: candidate.id, adapterKey: body.adapterKey } } });
      return { statusCode: 202, response: { run } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/cards", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createCardBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const { rewardRules, ...cardData } = body;
    const result = await withIdempotency(workspaceId, key, "create-card", async () => {
      const evidence = await prisma.evidenceRecord.upsert({
        where: { workspaceId_contentHash: { workspaceId, contentHash: contentHash({ kind: "manual-card", key }) } },
        create: { workspaceId, kind: "USER_CONFIRMATION", sourceName: "Manual card entry", summary: `You recorded ${body.productName} reward information.`, observedAt: new Date(), contentHash: contentHash({ kind: "manual-card", key }) },
        update: {},
      });
      const card = await prisma.userCard.create({ data: { workspaceId, ...cardData, rewardRules: { create: rewardRules.map((rule) => ({ workspaceId, ...rule, evidenceIds: [...rule.evidenceIds, evidence.id] })) } }, include: { rewardRules: true } });
      return { statusCode: 201, response: { card } };
    });
    await refreshBetaRecommendations(prisma, workspaceId);
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/cancellation-tasks", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createCancellationTaskBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const subscription = await prisma.popSubscription.findFirst({ where: { id: body.subscriptionId, workspaceId } });
    if (!subscription) throw new AppError(404, "Subscription not found");
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-cancellation-task", async () => {
      const task = await prisma.cancellationTask.create({ data: { workspaceId, merchantName: subscription.merchantName, subscriptionId: subscription.id, status: "USER_ACTION_REQUIRED", instructions: body.instructions, actionUrl: body.actionUrl } });
      return { statusCode: 201, response: { task } };
    });
    return reply.code(result.statusCode).header("etag", `W/\"${(result.response.task as { version: number }).version}\"`).send(result.response);
  });

  app.patch("/workspaces/:workspaceId/pop/cancellation-tasks/:taskId", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const { taskId } = request.params as { taskId: string };
    const body = updateCancellationTaskBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const ifMatch = request.headers["if-match"];
    if (ifMatch && ifMatch !== `W/\"${body.version}\"`) throw new AppError(409, "Cancellation task version conflict");
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, `update-cancellation-task:${taskId}`, async () => {
      const updated = await prisma.cancellationTask.updateMany({ where: { id: taskId, workspaceId, version: body.version }, data: { status: body.status, version: { increment: 1 }, completedAt: body.status === "COMPLETED" ? new Date() : null } });
      if (updated.count !== 1) throw new AppError(409, "Cancellation task changed and requires review");
      const task = await prisma.cancellationTask.findUniqueOrThrow({ where: { id: taskId } });
      await prisma.actionReceipt.create({ data: { workspaceId, actionType: "CANCELLATION_STATUS_CONFIRMED", entityType: "CancellationTask", entityId: taskId, actorUserId: request.user.sub, idempotencyKey: key, details: { status: body.status } } });
      return { statusCode: 200, response: { task } };
    });
    const task = result.response.task as { version: number };
    return reply.code(result.statusCode).header("etag", `W/\"${task.version}\"`).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/points-accounts", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    return { accounts: (await loadPointsPalace(workspaceId, request.user.sub)).accounts };
  });

  app.post("/workspaces/:workspaceId/pop/points-accounts", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createPointsAccountBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    if (body.kind === "POP_PROGRESS") throw new AppError(400, "PoP progress accounts are managed by verified progress awards");
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-points-account", async () => {
      const account = await prisma.$transaction(async (transaction) => {
        const created = await transaction.pointsAccount.create({ data: { workspaceId, ...body } });
        if (body.balance > 0) {
          await transaction.pointsRegisterEntry.create({
            data: { workspaceId, accountId: created.id, balanceKind: "LOYALTY_POINTS", type: "EARNED", status: "CONFIRMED", pointsDelta: body.balance, label: `${body.name} opening balance`, occurredAt: new Date(), evidenceIds: [], idempotencyKey: `${key}:opening` },
          });
        }
        return created;
      });
      return { statusCode: 201, response: { account } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/points-register", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const { days } = pointsRegisterQuerySchema.parse(request.query);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const since = Date.now() - days * 86_400_000;
    const palace = await loadPointsPalace(workspaceId, request.user.sub);
    return { windowDays: days, entries: palace.register.filter((entry) => Date.parse(entry.occurredAt) >= since), recency: palace.recency, progress: palace.progress };
  });

  app.post("/workspaces/:workspaceId/pop/points-register", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createPointsRegisterEntryBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const account = body.accountId ? await prisma.pointsAccount.findFirst({ where: { id: body.accountId, workspaceId, kind: "LOYALTY_POINTS" } }) : null;
    if (body.accountId && !account) throw new AppError(404, "Loyalty points account not found");
    if (["EXPIRATION", "REDEMPTION", "REVERSAL"].includes(body.type) && body.pointsDelta > 0) throw new AppError(400, `${body.type.toLowerCase()} entries must not increase a balance`);
    if (body.correctionOfId) {
      const original = await prisma.pointsRegisterEntry.findFirst({ where: { id: body.correctionOfId, workspaceId } });
      if (!original) throw new AppError(404, "Register entry to correct was not found");
      if (!["CORRECTION", "REVERSAL"].includes(body.type)) throw new AppError(400, "A correction reference requires a correction or reversal entry");
    }
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "append-points-register", async () => {
      const entry = await prisma.$transaction(async (transaction) => {
        const created = await transaction.pointsRegisterEntry.create({ data: { workspaceId, ...body, evidenceIds: body.evidenceIds, metadata: body.metadata as Prisma.InputJsonObject | undefined, idempotencyKey: key } });
        const changesBalance = body.status === "CONFIRMED" && !["MISSED_ESTIMATE", "EXPECTED"].includes(body.type);
        if (account && changesBalance) {
          await transaction.pointsAccount.update({ where: { id: account.id }, data: { balance: { increment: body.pointsDelta }, lastEarnedAt: body.type === "EARNED" ? body.occurredAt : account.lastEarnedAt, version: { increment: 1 } } });
        }
        await transaction.actionReceipt.create({ data: { workspaceId, actionType: "POINTS_REGISTER_APPENDED", entityType: "PointsRegisterEntry", entityId: created.id, actorUserId: request.user.sub, idempotencyKey: key, details: { balanceKind: body.balanceKind, type: body.type, status: body.status } } });
        return created;
      });
      return { statusCode: 201, response: { entry } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/spending-profile", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    return { profile: await prisma.spendingProfile.findUnique({ where: { workspaceId } }) };
  });

  app.get("/workspaces/:workspaceId/pop/financial-goals", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    return { goals: (await loadPointsPalace(workspaceId, request.user.sub)).goals };
  });

  app.post("/workspaces/:workspaceId/pop/financial-goals", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createFinancialGoalBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-financial-goal", async () => {
      const goal = await prisma.financialGoal.create({ data: { workspaceId, ...body } });
      return { statusCode: 201, response: { goal } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/benefits", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const benefits = await prisma.rewardBenefit.findMany({ where: { workspaceId }, include: { usages: true }, orderBy: [{ validThrough: "asc" }, { createdAt: "asc" }] });
    return { benefits: benefits.map((benefit) => ({ ...benefit, evidenceIds: jsonStrings(benefit.evidenceIds) })) };
  });

  app.get("/workspaces/:workspaceId/pop/reward-scenarios", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    return { scenarios: await prisma.rewardScenario.findMany({ where: { workspaceId }, orderBy: { calculatedAt: "desc" }, take: 100 }) };
  });

  app.post("/workspaces/:workspaceId/pop/reward-scenarios", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = calculateRewardScenarioBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    if (body.goalId && !await prisma.financialGoal.findFirst({ where: { id: body.goalId, workspaceId } })) throw new AppError(404, "Financial goal not found");
    const cards = await prisma.userCard.findMany({ where: { workspaceId }, include: { rewardRules: true } });
    const category = body.category.toLowerCase();
    const choices = cards.flatMap((card) => card.rewardRules.filter((rule) => !rule.validThrough || rule.validThrough > new Date()).filter((rule) => rule.category === "*" || rule.category.toLowerCase() === category).map((rule) => ({ cardId: card.id, cardName: card.productName, ruleId: rule.id, estimatedValueCents: Math.min(Math.floor(body.purchaseCents * rule.rateBasisPoints / 10_000), rule.capCents ?? Number.MAX_SAFE_INTEGER) }))).sort((left, right) => right.estimatedValueCents - left.estimatedValueCents);
    const best = choices[0];
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "calculate-reward-scenario", async () => {
      const scenario = await prisma.rewardScenario.create({ data: { workspaceId, goalId: body.goalId, name: body.name, input: { purchaseCents: body.purchaseCents, category: body.category }, result: { choices, best }, estimatedValueCents: best?.estimatedValueCents ?? 0, confidenceBasisPoints: best ? 9_000 : 5_000, evidenceIds: [] } });
      return { statusCode: 201, response: { scenario, best } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/game-stops", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const query = gameStopsQuerySchema.parse(request.query);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const palace = await loadPointsPalace(workspaceId, request.user.sub);
    return { stops: palace.gameStops.filter((stop) => (!query.area || stop.coarseArea === query.area) && (!query.city || stop.city.toLowerCase() === query.city.toLowerCase())), atHomeEvents: palace.atHomeEvents };
  });

  app.post("/workspaces/:workspaceId/pop/game-stops", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createGameStopBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-game-stop", async () => {
      const { latitude, longitude, ...data } = body;
      const stop = await prisma.gameStop.create({ data: { workspaceId, ...data, latitudeE6: Math.round(latitude * 1_000_000), longitudeE6: Math.round(longitude * 1_000_000) } });
      return { statusCode: 201, response: { stop } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/city-packs", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceRole(request.user.sub, workspaceId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    return { stops: await prisma.gameStop.findMany({ where: { workspaceId }, include: { events: { orderBy: { activeFrom: "desc" } } }, orderBy: [{ city: "asc" }, { name: "asc" }] }) };
  });

  app.patch("/workspaces/:workspaceId/pop/game-stops/:gameStopId", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const { gameStopId } = request.params as { gameStopId: string };
    const body = updateGameStopBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, `update-game-stop:${gameStopId}`, async () => {
      const updated = await prisma.gameStop.updateMany({ where: { id: gameStopId, workspaceId, version: body.version }, data: { status: body.status, sourceName: body.sourceName, sourceUrl: body.sourceUrl, validThrough: body.validThrough, version: { increment: 1 } } });
      if (updated.count !== 1) throw new AppError(409, "Game Stop changed and requires review");
      const stop = await prisma.gameStop.findUniqueOrThrow({ where: { id: gameStopId } });
      await prisma.actionReceipt.create({ data: { workspaceId, actionType: "GAME_STOP_UPDATED", entityType: "GameStop", entityId: stop.id, actorUserId: request.user.sub, idempotencyKey: key, details: { status: stop.status, validThrough: stop.validThrough?.toISOString() } } });
      return { statusCode: 200, response: { stop } };
    });
    return reply.code(result.statusCode).header("etag", `W/\"${(result.response.stop as { version: number }).version}\"`).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/game-stop-events", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createGameStopEventBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    if (body.gameStopId && !await prisma.gameStop.findFirst({ where: { id: body.gameStopId, workspaceId } })) throw new AppError(404, "Game Stop not found");
    if (!body.options.some((option) => option.toLowerCase() === body.correctAnswer.toLowerCase())) throw new AppError(400, "The correct answer must be one of the event options");
    if (body.atHome && body.gameStopId) throw new AppError(400, "At-home events cannot require a physical Game Stop");
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-game-stop-event", async () => {
      const { correctAnswer, ...data } = body;
      const event = await prisma.gameStopEvent.create({ data: { workspaceId, ...data, options: data.options, correctAnswerHash: hashGameStopAnswer(correctAnswer) } });
      return { statusCode: 201, response: { event: { ...event, correctAnswerHash: undefined } } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.patch("/workspaces/:workspaceId/pop/game-stop-events/:eventId", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const { eventId } = request.params as { eventId: string };
    const body = updateGameStopEventBodySchema.parse(request.body);
    await assertWorkspaceRole(request.user.sub, workspaceId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, `update-game-stop-event:${eventId}`, async () => {
      const updated = await prisma.gameStopEvent.updateMany({ where: { id: eventId, workspaceId, version: body.version }, data: { activeThrough: body.activeThrough, pointsAward: body.pointsAward, evidenceIds: body.evidenceIds, version: { increment: 1 } } });
      if (updated.count !== 1) throw new AppError(409, "Game Stop event changed and requires review");
      const event = await prisma.gameStopEvent.findUniqueOrThrow({ where: { id: eventId } });
      await prisma.actionReceipt.create({ data: { workspaceId, actionType: "GAME_STOP_EVENT_UPDATED", entityType: "GameStopEvent", entityId: event.id, actorUserId: request.user.sub, idempotencyKey: key, details: { activeThrough: event.activeThrough?.toISOString(), pointsAward: event.pointsAward } } });
      return { statusCode: 200, response: { event: { ...event, correctAnswerHash: undefined } } };
    });
    return reply.code(result.statusCode).header("etag", `W/\"${(result.response.event as { version: number }).version}\"`).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/game-stops/:gameStopId/sessions", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const { gameStopId } = request.params as { gameStopId: string };
    const body = createGameStopSessionBodySchema.parse(request.body);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const event = await prisma.gameStopEvent.findFirst({ where: { id: body.eventId, workspaceId, gameStopId: gameStopId === "at-home" ? null : gameStopId, atHome: body.atHome, activeFrom: { lte: new Date() }, OR: [{ activeThrough: null }, { activeThrough: { gt: new Date() } }] }, include: { gameStop: true } });
    if (!event) throw new AppError(404, "Game Stop event is not available");
    if (!body.atHome) {
      const pointsMode = await prisma.pointsModePreference.findUnique({ where: { workspaceId_userId: { workspaceId, userId: request.user.sub } } });
      if (!pointsMode?.activeUntil || pointsMode.activeUntil <= new Date()) throw new AppError(409, "Turn on Points Mode before starting a nearby event");
      if (!body.coarseArea || body.coarseArea !== event.gameStop?.coarseArea) throw new AppError(409, "The Game Stop is outside the active coarse area");
    }
    if (!body.atHome && (body.distanceMeters == null || body.distanceMeters > 150)) throw new AppError(409, "Move within 150 meters of the Game Stop to begin");
    if (!body.atHome && (body.accuracyMeters == null || body.accuracyMeters > 200)) throw new AppError(409, "Location accuracy is not sufficient for this event");
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "create-game-stop-session", async () => {
      const session = await prisma.gameStopSession.create({ data: { workspaceId, userId: request.user.sub, eventId: event.id, gameStopId: event.gameStopId, coarseArea: body.coarseArea, atHome: body.atHome, proximityDistanceMeters: body.distanceMeters, locationAccuracyMeters: body.accuracyMeters, timezoneOffsetMinutes: body.timezoneOffsetMinutes, expiresAt: new Date(Date.now() + 10 * 60_000) } });
      return { statusCode: 201, response: { session: { id: session.id, eventId: event.id, gameStopId: event.gameStopId ?? undefined, prompt: event.prompt, options: jsonStrings(event.options), pointsAward: event.pointsAward, atHome: event.atHome, expiresAt: session.expiresAt.toISOString() } } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/game-stop-sessions/:sessionId/complete", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const { sessionId } = request.params as { sessionId: string };
    const body = completeGameStopSessionBodySchema.parse(request.body);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const key = requireIdempotencyKey(request.headers);
    const operation = `complete-game-stop-session:${sessionId}`;
    const replay = await replayIdempotency(workspaceId, key, operation);
    if (replay) return reply.code(replay.statusCode).send(replay.response);
    const session = await prisma.gameStopSession.findFirst({ where: { id: sessionId, workspaceId, userId: request.user.sub }, include: { event: true, gameStop: true } });
    if (!session) throw new AppError(404, "Game Stop session not found");
    if (session.completedAt) throw new AppError(409, "Game Stop session was already completed");
    const completions = await prisma.gameStopCompletion.findMany({ where: { workspaceId, userId: request.user.sub, completedAt: { gte: new Date(Date.now() - 8 * 86_400_000) } }, select: { gameStopId: true, completedAt: true } });
    const eligibility = evaluateStoredGameStopSession({ now: new Date(), expiresAt: session.expiresAt, atHome: session.atHome, gameStopId: session.gameStopId, proximityDistanceMeters: session.proximityDistanceMeters, locationAccuracyMeters: session.locationAccuracyMeters, timezoneOffsetMinutes: session.timezoneOffsetMinutes, completions });
    if (eligibility !== "ALLOWED") throw new AppError(409, `Game Stop completion is not allowed: ${eligibility}`);
    if (hashGameStopAnswer(body.answer) !== session.event.correctAnswerHash) throw new AppError(422, "That answer does not complete the event");
    const result = await withIdempotency(workspaceId, key, operation, async () => {
      const completed = await prisma.$transaction(async (transaction) => {
        const progressAccount = await transaction.pointsAccount.upsert({ where: { workspaceId_programKey_kind: { workspaceId, programKey: "pop-progress", kind: "POP_PROGRESS" } }, create: { workspaceId, name: "PoP progress", programKey: "pop-progress", kind: "POP_PROGRESS" }, update: {} });
        const evidence = await transaction.evidenceRecord.upsert({ where: { workspaceId_contentHash: { workspaceId, contentHash: hashGameStopAnswer(`game-stop:${session.id}:${session.eventId}`) } }, create: { workspaceId, kind: "USER_CONFIRMATION", sourceName: session.atHome ? "PoP at-home event" : "PoP Game Stop", summary: `Completed ${session.event.title} without a purchase requirement.`, observedAt: new Date(), contentHash: hashGameStopAnswer(`game-stop:${session.id}:${session.eventId}`), metadata: { gameStopId: session.gameStopId, eventId: session.eventId, atHome: session.atHome } }, update: {} });
        const registerEntry = await transaction.pointsRegisterEntry.create({ data: { workspaceId, accountId: progressAccount.id, balanceKind: "POP_PROGRESS", type: "PROGRESS_AWARD", status: "CONFIRMED", pointsDelta: session.event.pointsAward, label: session.event.title, merchantName: session.gameStop?.name, city: session.gameStop?.city, coarseArea: session.coarseArea, occurredAt: new Date(), evidenceIds: [evidence.id], idempotencyKey: `${key}:register`, metadata: { eventId: session.eventId, atHome: session.atHome } } });
        const completion = await transaction.gameStopCompletion.create({ data: { workspaceId, userId: request.user.sub, sessionId: session.id, eventId: session.eventId, gameStopId: session.gameStopId, city: session.gameStop?.city, coarseArea: session.coarseArea, evidenceIds: [evidence.id] } });
        const award = await transaction.progressAward.create({ data: { workspaceId, completionId: completion.id, registerEntryId: registerEntry.id, points: session.event.pointsAward } });
        await transaction.pointsAccount.update({ where: { id: progressAccount.id }, data: { balance: { increment: session.event.pointsAward }, lastEarnedAt: new Date(), version: { increment: 1 } } });
        await transaction.gameStopSession.update({ where: { id: session.id }, data: { completedAt: new Date() } });
        await transaction.actionReceipt.create({ data: { workspaceId, actionType: "GAME_STOP_COMPLETED", entityType: "GameStopCompletion", entityId: completion.id, actorUserId: request.user.sub, idempotencyKey: key, details: { eventId: session.eventId, points: session.event.pointsAward, atHome: session.atHome } } });
        return { completion, award, registerEntry };
      });
      return { statusCode: 201, response: completed };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.get("/workspaces/:workspaceId/pop/points-mode", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    return { pointsMode: (await loadPointsPalace(workspaceId, request.user.sub)).pointsMode };
  });

  app.put("/workspaces/:workspaceId/pop/points-mode", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = updatePointsModeBodySchema.parse(request.body);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    const current = await prisma.pointsModePreference.findUnique({ where: { workspaceId_userId: { workspaceId, userId: request.user.sub } } });
    if (body.version && current && body.version !== current.version) throw new AppError(409, "Points Mode settings changed and require review");
    const key = requireIdempotencyKey(request.headers);
    const activeUntil = body.enabled ? new Date(Date.now() + 15 * 60_000) : null;
    const result = await withIdempotency(workspaceId, key, "update-points-mode", async () => {
      const preference = await prisma.pointsModePreference.upsert({ where: { workspaceId_userId: { workspaceId, userId: request.user.sub } }, create: { workspaceId, userId: request.user.sub, activeUntil, cityWatchEnabled: body.cityWatchEnabled, cityWatchCities: body.cityWatchCities }, update: { activeUntil, cityWatchEnabled: body.cityWatchEnabled, cityWatchCities: body.cityWatchCities, version: { increment: 1 } } });
      await prisma.actionReceipt.create({ data: { workspaceId, actionType: body.enabled ? "POINTS_MODE_ENABLED" : "POINTS_MODE_DISABLED", entityType: "PointsModePreference", entityId: preference.id, actorUserId: request.user.sub, idempotencyKey: key, details: { activeUntil: activeUntil?.toISOString(), rawCoordinatesStored: false } } });
      return { statusCode: 200, response: { pointsMode: { activeUntil: preference.activeUntil?.toISOString(), cityWatchEnabled: preference.cityWatchEnabled, cityWatchCities: jsonStrings(preference.cityWatchCities), version: preference.version } } };
    });
    return reply.code(result.statusCode).header("etag", `W/\"${(result.response.pointsMode as { version: number }).version}\"`).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/points-recalculate", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    await assertWorkspaceRole(request.user.sub, workspaceId, EDIT_ROLES);
    const key = requireIdempotencyKey(request.headers);
    const result = await withIdempotency(workspaceId, key, "recalculate-points", async () => {
      const entries = await prisma.pointsRegisterEntry.findMany({ where: { workspaceId }, orderBy: { occurredAt: "asc" } });
      const accounts = await prisma.pointsAccount.findMany({ where: { workspaceId } });
      await prisma.$transaction(async (transaction) => {
        for (const account of accounts) {
          const accountEntries = entries.filter((entry) => entry.accountId === account.id && entry.status === "CONFIRMED" && entry.type !== "MISSED_ESTIMATE");
          const balance = Math.max(0, accountEntries.reduce((total, entry) => total + entry.pointsDelta, 0));
          const lastEarnedAt = [...accountEntries].reverse().find((entry) => entry.type === "EARNED" || entry.type === "PROGRESS_AWARD")?.occurredAt;
          await transaction.pointsAccount.update({ where: { id: account.id }, data: { balance, lastEarnedAt, version: { increment: 1 } } });
        }
        const categoryTotals = new Map<string, number>();
        const merchantTotals = new Map<string, number>();
        for (const entry of entries.filter((item) => item.balanceKind === "LOYALTY_POINTS" && item.status === "CONFIRMED" && item.type === "EARNED")) {
          if (entry.category) categoryTotals.set(entry.category, (categoryTotals.get(entry.category) ?? 0) + entry.pointsDelta);
          if (entry.merchantName) merchantTotals.set(entry.merchantName, (merchantTotals.get(entry.merchantName) ?? 0) + entry.pointsDelta);
        }
        await transaction.spendingProfile.upsert({ where: { workspaceId }, create: { workspaceId, categorySummary: [...categoryTotals].map(([name, points]) => ({ name, points })), merchantSummary: [...merchantTotals].map(([name, points]) => ({ name, points })), lastCalculatedAt: new Date() }, update: { categorySummary: [...categoryTotals].map(([name, points]) => ({ name, points })), merchantSummary: [...merchantTotals].map(([name, points]) => ({ name, points })), lastCalculatedAt: new Date(), version: { increment: 1 } } });
      });
      return { statusCode: 200, response: { pointsPalace: await loadPointsPalace(workspaceId, request.user.sub) } };
    });
    return reply.code(result.statusCode).send(result.response);
  });

  app.post("/workspaces/:workspaceId/pop/sync-events", { preHandler: app.authenticate, schema: { tags: ["pop"], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    const { workspaceId } = workspaceParamsSchema.parse(request.params);
    const body = createSyncEventBodySchema.parse(request.body);
    await assertWorkspaceMembership(request.user.sub, workspaceId);
    if (request.user.devicePublicId && body.devicePublicId !== request.user.devicePublicId) throw new AppError(403, "A desktop can only sync its own device records");
    const key = requireIdempotencyKey(request.headers);
    const conflict = body.entityType === "CancellationTask" && body.operation !== "APPEND";
    const result = await withIdempotency(workspaceId, key, "create-sync-event", async () => {
      const event = await prisma.syncEvent.create({ data: { workspaceId, ...body, payload: body.payload as Prisma.InputJsonObject, idempotencyKey: key, conflict } });
      return { statusCode: conflict ? 409 : 202, response: { event, requiresReview: conflict } };
    });
    return reply.code(result.statusCode).send(result.response);
  });
}
