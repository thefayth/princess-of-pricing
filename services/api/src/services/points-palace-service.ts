import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const DAY_MS = 86_400_000;
const POINTS_PER_LEVEL = 250;

function jsonStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function hashGameStopAnswer(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function serializeEvent(event: {
  id: string;
  gameStopId: string | null;
  title: string;
  taskType: string;
  prompt: string;
  options: Prisma.JsonValue;
  pointsAward: number;
  atHome: boolean;
  activeThrough: Date | null;
}) {
  return {
    id: event.id,
    gameStopId: event.gameStopId ?? undefined,
    title: event.title,
    taskType: event.taskType,
    prompt: event.prompt,
    options: jsonStrings(event.options),
    pointsAward: event.pointsAward,
    atHome: event.atHome,
    expiresAt: event.activeThrough?.toISOString(),
  };
}

export async function loadPointsPalace(workspaceId: string, userId: string) {
  const now = new Date();
  const activeEventWhere = {
    activeFrom: { lte: now },
    OR: [{ activeThrough: null }, { activeThrough: { gt: now } }],
  } satisfies Prisma.GameStopEventWhereInput;
  const [accounts, register, goals, stops, atHomeEvents, completions, pointsMode] = await Promise.all([
    prisma.pointsAccount.findMany({ where: { workspaceId }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.pointsRegisterEntry.findMany({ where: { workspaceId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 250 }),
    prisma.financialGoal.findMany({ where: { workspaceId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
    prisma.gameStop.findMany({
      where: { workspaceId, status: "ACTIVE", OR: [{ validThrough: null }, { validThrough: { gt: now } }] },
      include: { events: { where: { ...activeEventWhere, atHome: false }, orderBy: { activeFrom: "desc" }, take: 1 } },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    }),
    prisma.gameStopEvent.findMany({ where: { workspaceId, gameStopId: null, atHome: true, ...activeEventWhere }, orderBy: { activeFrom: "desc" }, take: 10 }),
    prisma.gameStopCompletion.findMany({ where: { workspaceId, userId }, orderBy: { completedAt: "desc" }, take: 250 }),
    prisma.pointsModePreference.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }),
  ]);

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const registerItems = register.map((entry) => ({
    id: entry.id,
    accountId: entry.accountId ?? undefined,
    balanceKind: entry.balanceKind,
    type: entry.type,
    status: entry.status,
    pointsDelta: entry.pointsDelta,
    label: entry.label,
    merchantName: entry.merchantName ?? undefined,
    category: entry.category ?? undefined,
    city: entry.city ?? undefined,
    coarseArea: entry.coarseArea ?? undefined,
    occurredAt: entry.occurredAt.toISOString(),
    estimatedCashValue: entry.estimatedCashValueCents == null ? undefined : { amountCents: entry.estimatedCashValueCents, currency: "USD" },
    estimatedTravelValue: entry.estimatedTravelValueCents == null ? undefined : { amountCents: entry.estimatedTravelValueCents, currency: "USD" },
    evidenceIds: jsonStrings(entry.evidenceIds),
    correctionOfId: entry.correctionOfId ?? undefined,
  }));
  const latest = new Map<string, { label: string; scope: "MERCHANT" | "CATEGORY" | "PROGRAM"; occurredAt: Date }>();
  for (const entry of register) {
    if (entry.balanceKind !== "LOYALTY_POINTS" || entry.status !== "CONFIRMED" || entry.type !== "EARNED") continue;
    const dimensions: Array<[string, string, "MERCHANT" | "CATEGORY" | "PROGRAM"]> = [];
    if (entry.merchantName) dimensions.push([`merchant:${entry.merchantName.toLowerCase()}`, entry.merchantName, "MERCHANT"]);
    if (entry.category) dimensions.push([`category:${entry.category.toLowerCase()}`, entry.category, "CATEGORY"]);
    const account = entry.accountId ? accountById.get(entry.accountId) : undefined;
    if (account) dimensions.push([`program:${account.id}`, account.name, "PROGRAM"]);
    for (const [key, label, scope] of dimensions) {
      const current = latest.get(key);
      if (!current || entry.occurredAt > current.occurredAt) latest.set(key, { label, scope, occurredAt: entry.occurredAt });
    }
  }
  const recency = [...latest.entries()].map(([key, item]) => {
    const daysSince = Math.max(0, Math.floor((now.getTime() - item.occurredAt.getTime()) / DAY_MS));
    return { key, label: item.label, scope: item.scope, status: daysSince <= 30 ? "RECENT" : "QUIET", lastEarnedAt: item.occurredAt.toISOString(), daysSince };
  }).sort((left, right) => left.daysSince - right.daysSince);

  const totalPoints = Math.max(0, register.filter((entry) => entry.balanceKind === "POP_PROGRESS" && entry.status === "CONFIRMED").reduce((total, entry) => total + entry.pointsDelta, 0));
  const level = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
  const confirmedLoyaltyPoints = accounts.filter((account) => account.kind === "LOYALTY_POINTS").reduce((total, account) => total + account.balance, 0);
  const estimatedCashValueCents = accounts.filter((account) => account.kind === "LOYALTY_POINTS").reduce((total, account) => total + Math.floor((account.balance * (account.cashValueCentsPerThousand ?? 0)) / 1000), 0);

  const lastCompletionByStop = new Map<string, Date>();
  for (const completion of completions) {
    if (completion.gameStopId && !lastCompletionByStop.has(completion.gameStopId)) lastCompletionByStop.set(completion.gameStopId, completion.completedAt);
  }

  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      programKey: account.programKey,
      kind: account.kind,
      balance: account.balance,
      expiresAt: account.expiresAt?.toISOString(),
      lastEarnedAt: account.lastEarnedAt?.toISOString(),
      cashValueCentsPerThousand: account.cashValueCentsPerThousand ?? undefined,
      travelValueCentsPerThousand: account.travelValueCentsPerThousand ?? undefined,
    })),
    register: registerItems,
    recency,
    goals: goals.map((goal) => ({ id: goal.id, kind: goal.kind, name: goal.name, target: { amountCents: goal.targetCents, currency: goal.currency }, captured: { amountCents: goal.capturedCents, currency: goal.currency }, status: goal.status, version: goal.version })),
    gameStops: stops.map((stop) => {
      const event = stop.events[0];
      const lastCompletedAt = lastCompletionByStop.get(stop.id);
      const completedRecently = Boolean(lastCompletedAt && now.getTime() - lastCompletedAt.getTime() < 7 * DAY_MS);
      return {
        id: stop.id,
        name: stop.name,
        city: stop.city,
        coarseArea: stop.coarseArea,
        latitude: stop.latitudeE6 / 1_000_000,
        longitude: stop.longitudeE6 / 1_000_000,
        status: completedRecently ? "COMPLETED_RECENTLY" : event ? (now.getTime() - event.activeFrom.getTime() < 7 * DAY_MS ? "NEW_EVENT" : "AVAILABLE") : "NO_CURRENT_EVENT",
        sourceName: stop.sourceName,
        sourceUrl: stop.sourceUrl ?? undefined,
        event: event ? serializeEvent(event) : undefined,
        lastCompletedAt: lastCompletedAt?.toISOString(),
      };
    }),
    atHomeEvents: atHomeEvents.map(serializeEvent),
    pointsMode: {
      activeUntil: pointsMode?.activeUntil && pointsMode.activeUntil > now ? pointsMode.activeUntil.toISOString() : undefined,
      cityWatchEnabled: pointsMode?.cityWatchEnabled ?? false,
      cityWatchCities: pointsMode ? jsonStrings(pointsMode.cityWatchCities) : [],
      version: pointsMode?.version ?? 1,
    },
    progress: {
      level,
      totalPoints,
      nextLevelPoints: level * POINTS_PER_LEVEL,
      confirmedLoyaltyPoints,
      estimatedCashValue: { amountCents: estimatedCashValueCents, currency: "USD" },
    },
  };
}

export function evaluateStoredGameStopSession(input: {
  now: Date;
  expiresAt: Date;
  atHome: boolean;
  gameStopId: string | null;
  proximityDistanceMeters: number | null;
  locationAccuracyMeters: number | null;
  timezoneOffsetMinutes: number;
  completions: Array<{ gameStopId: string | null; completedAt: Date }>;
}) {
  if (input.expiresAt <= input.now) return "SESSION_EXPIRED" as const;
  if (!input.atHome) {
    if (input.proximityDistanceMeters == null || input.proximityDistanceMeters > 150) return "OUTSIDE_STOP" as const;
    if (input.locationAccuracyMeters == null || input.locationAccuracyMeters > 200) return "LOCATION_INACCURATE" as const;
  }
  const offsetMs = input.timezoneOffsetMinutes * 60_000;
  const localNow = input.now.getTime() - offsetMs;
  const dayStartUtc = Math.floor(localNow / DAY_MS) * DAY_MS + offsetMs;
  if (input.completions.filter((completion) => completion.completedAt.getTime() >= dayStartUtc).length >= 3) return "DAILY_LIMIT" as const;
  const sevenDaysAgo = input.now.getTime() - 7 * DAY_MS;
  if (!input.atHome && input.gameStopId && input.completions.some((completion) => completion.gameStopId === input.gameStopId && completion.completedAt.getTime() >= sevenDaysAgo)) return "STOP_COOLDOWN" as const;
  return "ALLOWED" as const;
}
