import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { DatabaseClient } from "../types/database";
import { AppError } from "../utils/app-error";
import { slugify } from "../utils/slug";
import { seedDefaultAccounts } from "./chart-of-accounts-service";

type CreateWorkspaceInput = {
  userId: string;
  name: string;
  type: "PERSONAL" | "BUSINESS";
  baseCurrency?: string;
  slug?: string;
  settings?: Prisma.InputJsonValue;
};

function answerHash(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function ensureUniqueWorkspaceSlug(
  db: DatabaseClient,
  requestedSlug: string,
): Promise<string> {
  const base = slugify(requestedSlug);
  let candidate = base;
  let counter = 1;

  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}

export async function createWorkspaceForUser(
  db: DatabaseClient,
  input: CreateWorkspaceInput,
) {
  const slug = await ensureUniqueWorkspaceSlug(db, input.slug ?? input.name);

  const workspace = await db.workspace.create({
    data: {
      ownerUserId: input.userId,
      name: input.name,
      slug,
      type: input.type,
      baseCurrency: (input.baseCurrency ?? "USD").toUpperCase(),
      settings: input.settings,
      memberships: {
        create: {
          userId: input.userId,
          role: WorkspaceRole.OWNER,
        },
      },
    },
  });

  await seedDefaultAccounts(db, workspace.id, workspace.type);
  await db.subscriptionService.createMany({
    data: [
      { workspaceId: workspace.id, canonicalKey: "spotify", displayName: "Spotify", aliases: ["Spotify Premium"], domains: ["spotify.com"], category: "MUSIC", automationSupported: true },
      { workspaceId: workspace.id, canonicalKey: "apple-music", displayName: "Apple Music", aliases: ["Apple Music Subscription"], domains: ["apple.com", "music.apple.com"], category: "MUSIC", automationSupported: false },
    ],
    skipDuplicates: true,
  });
  await db.automationPolicy.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, protectedPlanKinds: ["family", "bundle", "annual", "prepaid", "contract"] },
    update: {},
  });
  await db.pointsAccount.upsert({
    where: { workspaceId_programKey_kind: { workspaceId: workspace.id, programKey: "pop-progress", kind: "POP_PROGRESS" } },
    create: { workspaceId: workspace.id, name: "PoP progress", programKey: "pop-progress", kind: "POP_PROGRESS" },
    update: {},
  });
  await db.pointsModePreference.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: input.userId } },
    create: { workspaceId: workspace.id, userId: input.userId },
    update: {},
  });
  const orientationEvent = await db.gameStopEvent.findFirst({ where: { workspaceId: workspace.id, atHome: true, title: "Points Palace orientation" } });
  if (!orientationEvent) {
    await db.gameStopEvent.create({
      data: {
        workspaceId: workspace.id,
        title: "Points Palace orientation",
        taskType: "REVIEW_BENEFIT",
        prompt: "Which action protects value without requiring a purchase?",
        options: ["Review an expiring benefit", "Spend more for points", "Open another card"],
        correctAnswerHash: answerHash("Review an expiring benefit"),
        pointsAward: 40,
        atHome: true,
      },
    });
  }

  return workspace;
}

export async function seedPointsPalaceFixture(db: DatabaseClient, workspaceId: string) {
  const observedAt = new Date();
  const evidence = await db.evidenceRecord.upsert({
    where: { workspaceId_contentHash: { workspaceId, contentHash: "synthetic-points-palace-fixture-v1" } },
    create: { workspaceId, kind: "USER_CONFIRMATION", sourceName: "Synthetic Points Palace fixture", summary: "Synthetic earning activity for private beta verification.", observedAt, contentHash: "synthetic-points-palace-fixture-v1" },
    update: {},
  });
  const everyday = await db.pointsAccount.upsert({
    where: { workspaceId_programKey_kind: { workspaceId, programKey: "everyday-cash", kind: "LOYALTY_POINTS" } },
    create: { workspaceId, name: "Everyday rewards", programKey: "everyday-cash", kind: "LOYALTY_POINTS", balance: 12_480, cashValueCentsPerThousand: 1000, travelValueCentsPerThousand: 1000, lastEarnedAt: new Date(observedAt.getTime() - 4 * 86_400_000) },
    update: {},
  });
  const travel = await db.pointsAccount.upsert({
    where: { workspaceId_programKey_kind: { workspaceId, programKey: "travel-demo", kind: "LOYALTY_POINTS" } },
    create: { workspaceId, name: "Travel points", programKey: "travel-demo", kind: "LOYALTY_POINTS", balance: 38_200, cashValueCentsPerThousand: 1000, travelValueCentsPerThousand: 1650, lastEarnedAt: new Date(observedAt.getTime() - 48 * 86_400_000) },
    update: {},
  });
  const progress = await db.pointsAccount.findUniqueOrThrow({ where: { workspaceId_programKey_kind: { workspaceId, programKey: "pop-progress", kind: "POP_PROGRESS" } } });
  const entries = [
    { accountId: everyday.id, balanceKind: "LOYALTY_POINTS" as const, type: "EARNED" as const, status: "CONFIRMED" as const, pointsDelta: 12_480, label: "Everyday rewards opening balance", merchantName: "Neighborhood Market", category: "Groceries", city: "Los Angeles", occurredAt: new Date(observedAt.getTime() - 4 * 86_400_000), idempotencyKey: "fixture:everyday", estimatedCashValueCents: 12_480 },
    { accountId: travel.id, balanceKind: "LOYALTY_POINTS" as const, type: "EARNED" as const, status: "CONFIRMED" as const, pointsDelta: 38_200, label: "Travel points opening balance", merchantName: "Travel watch", category: "Travel", city: "Los Angeles", occurredAt: new Date(observedAt.getTime() - 48 * 86_400_000), idempotencyKey: "fixture:travel", estimatedCashValueCents: 38_200, estimatedTravelValueCents: 63_030 },
    { accountId: everyday.id, balanceKind: "LOYALTY_POINTS" as const, type: "EXPECTED" as const, status: "PENDING" as const, pointsDelta: 84, label: "Dining rewards expected", merchantName: "City Cafe", category: "Dining", city: "Los Angeles", occurredAt: new Date(observedAt.getTime() - 86_400_000), idempotencyKey: "fixture:expected" },
    { accountId: progress.id, balanceKind: "POP_PROGRESS" as const, type: "PROGRESS_AWARD" as const, status: "CONFIRMED" as const, pointsDelta: 190, label: "Points Palace orientation", occurredAt: new Date(observedAt.getTime() - 2 * 86_400_000), idempotencyKey: "fixture:progress" },
  ];
  for (const entry of entries) {
    await db.pointsRegisterEntry.upsert({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: entry.idempotencyKey } }, create: { workspaceId, ...entry, evidenceIds: [evidence.id] }, update: {} });
  }
  await db.pointsAccount.update({ where: { id: progress.id }, data: { balance: 190, lastEarnedAt: new Date(observedAt.getTime() - 2 * 86_400_000) } });
  if (!await db.financialGoal.findFirst({ where: { workspaceId, name: "Emergency fund" } })) {
    await db.financialGoal.create({ data: { workspaceId, kind: "EMERGENCY_FUND", name: "Emergency fund", targetCents: 250_000, capturedCents: 31_400 } });
  }
  let stop = await db.gameStop.findFirst({ where: { workspaceId, name: "Neighborhood Market", city: "Los Angeles" } });
  stop ??= await db.gameStop.create({ data: { workspaceId, name: "Neighborhood Market", city: "Los Angeles", coarseArea: "34.05,-118.25", latitudeE6: 34_052_200, longitudeE6: -118_243_700, sourceName: "Synthetic beta city pack" } });
  if (!await db.gameStopEvent.findFirst({ where: { workspaceId, gameStopId: stop.id, title: "Pick the strongest grocery card" } })) {
    await db.gameStopEvent.create({ data: { workspaceId, gameStopId: stop.id, title: "Pick the strongest grocery card", taskType: "SELECT_CARD", prompt: "Which owned card earns the highest verified grocery reward?", options: ["Everyday 2%", "Grocery 4%", "Use cash"], correctAnswerHash: answerHash("Grocery 4%"), pointsAward: 40, evidenceIds: [evidence.id] } });
  }
  await db.spendingProfile.upsert({ where: { workspaceId }, create: { workspaceId, categorySummary: [{ name: "Groceries", points: 12_480 }, { name: "Travel", points: 38_200 }], merchantSummary: [{ name: "Neighborhood Market", points: 12_480 }], lastCalculatedAt: observedAt }, update: {} });
}

export async function listWorkspaceMemberships(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: { workspace: true },
  });
}

export async function assertWorkspaceMembership(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembership(userId, workspaceId);

  if (!membership) {
    throw new AppError(404, "Workspace not found or inaccessible");
  }

  return membership;
}

export async function assertWorkspaceRole(
  userId: string,
  workspaceId: string,
  allowedRoles: WorkspaceRole[],
) {
  const membership = await assertWorkspaceMembership(userId, workspaceId);

  if (!allowedRoles.includes(membership.role)) {
    throw new AppError(403, "You do not have permission to modify this workspace");
  }

  return membership;
}
