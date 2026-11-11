import { z } from "zod";

const currencySchema = z.string().trim().length(3).default("USD").transform((value) => value.toUpperCase());
const centsSchema = z.number().int().nonnegative().max(2_000_000_000);

export const createWatchBodySchema = z.object({
  productId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(240),
  merchantName: z.string().trim().min(1).max(160),
  targetPriceCents: centsSchema,
  currentPriceCents: centsSchema.optional(),
  currency: currencySchema,
});

export const importFadBodySchema = z.object({ payload: z.unknown() });

export const connectGmailBodySchema = z.object({
  email: z.string().email().max(320),
  refreshToken: z.string().min(20).max(4096),
  accessToken: z.string().min(20).max(4096).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const createDevicePairingBodySchema = z.object({
  name: z.string().trim().min(1).max(120).default("Windows desktop"),
  platform: z.literal("windows").default("windows"),
});

export const exchangeDevicePairingBodySchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  name: z.string().trim().min(1).max(120).default("Windows desktop"),
  platform: z.literal("windows").default("windows"),
});

export const createSubscriptionBodySchema = z.object({
  merchantName: z.string().trim().min(1).max(160),
  serviceKey: z.string().trim().min(1).max(120).optional(),
  planName: z.string().trim().max(160).optional(),
  billingChannel: z.string().trim().max(80).optional(),
  accountHintHash: z.string().trim().max(128).optional(),
  lastUsedAt: z.coerce.date().optional(),
  isBundle: z.boolean().default(false),
  isFamilyOrHousehold: z.boolean().default(false),
  sourceKind: z.string().trim().max(80).optional(),
  amountCents: centsSchema,
  currency: currencySchema,
  cadence: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "UNKNOWN"]).default("UNKNOWN"),
  nextRenewalAt: z.coerce.date().optional(),
  evidenceIds: z.array(z.string()).default([]),
  sourceFingerprint: z.string().max(128).optional(),
});

export const createCardBodySchema = z.object({
  issuer: z.string().trim().min(1).max(160),
  productName: z.string().trim().min(1).max(200),
  network: z.string().trim().min(1).max(40),
  lastFour: z.string().regex(/^\d{4}$/).optional(),
  annualFeeCents: centsSchema.default(0),
  currency: currencySchema,
  rewardRules: z.array(z.object({
    category: z.string().trim().min(1).max(80),
    rateBasisPoints: z.number().int().min(0).max(100_000),
    capCents: centsSchema.optional(),
    validFrom: z.coerce.date().optional(),
    validThrough: z.coerce.date().optional(),
    evidenceIds: z.array(z.string()).default([]),
  })).default([]),
});

export const createCancellationTaskBodySchema = z.object({
  subscriptionId: z.string().min(1),
  instructions: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  actionUrl: z.string().url().optional(),
});

export const updateCancellationTaskBodySchema = z.object({
  status: z.enum(["OPEN", "USER_ACTION_REQUIRED", "COMPLETED", "DISMISSED"]),
  version: z.number().int().positive(),
});

export const createSyncEventBodySchema = z.object({
  devicePublicId: z.string().min(1).max(120),
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(160),
  operation: z.enum(["UPSERT", "DELETE", "APPEND"]),
  payload: z.record(z.string(), z.unknown()),
  entityVersion: z.number().int().positive().optional(),
});

export const createSubscriptionServiceBodySchema = z.object({
  canonicalKey: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  domains: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  category: z.enum(["MUSIC", "VIDEO", "SOFTWARE", "NEWS", "OTHER"]).default("OTHER"),
  automationSupported: z.boolean().default(false),
});

export const createDealOfferBodySchema = z.object({
  serviceKey: z.string().trim().min(1).max(120),
  serviceId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(240),
  planName: z.string().trim().min(1).max(160),
  eligibility: z.enum(["NEW_ONLY", "RETURNING_ONLY", "STUDENT", "FAMILY", "DEVICE", "PARTNER", "ANY", "UNKNOWN"]).default("UNKNOWN"),
  priceCents: centsSchema,
  renewalPriceCents: centsSchema.optional(),
  trialDays: z.number().int().nonnegative().max(3650).optional(),
  currency: currencySchema,
  sourceName: z.string().trim().min(1).max(160),
  sourceUrl: z.string().url().optional(),
  validFrom: z.coerce.date().optional(),
  validThrough: z.coerce.date().optional(),
  observedAt: z.coerce.date().default(() => new Date()),
  contentHash: z.string().trim().length(64),
  evidenceIds: z.array(z.string()).default([]),
  confidenceBasisPoints: z.number().int().min(0).max(10_000).default(0),
  terms: z.record(z.string(), z.unknown()).optional(),
});

export const resolveDuplicateCandidateBodySchema = z.object({
  status: z.enum(["PENDING_REVIEW", "KEPT"]),
  version: z.number().int().positive(),
});

export const updateAutomationPolicyBodySchema = z.object({
  enabled: z.boolean(),
  autoCancelExactDuplicates: z.boolean(),
  protectedServiceKeys: z.array(z.string().trim().min(1).max(120)).max(100),
  protectedPlanKinds: z.array(z.string().trim().min(1).max(80)).max(50),
  recentlyUsedDays: z.number().int().min(0).max(3650),
  maxMonthlyAmountCents: centsSchema.optional(),
  dailyDealAlerts: z.boolean(),
  renewalAlerts: z.boolean(),
  version: z.number().int().positive().optional(),
});

export const createCancellationRunBodySchema = z.object({
  candidateId: z.string().min(1),
  subscriptionId: z.string().min(1),
  adapterKey: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(500),
});

export const createPointsAccountBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  programKey: z.string().trim().min(1).max(120),
  kind: z.enum(["LOYALTY_POINTS", "POP_PROGRESS"]),
  balance: z.number().int().nonnegative().max(2_000_000_000).default(0),
  expiresAt: z.coerce.date().optional(),
  cashValueCentsPerThousand: centsSchema.optional(),
  travelValueCentsPerThousand: centsSchema.optional(),
});

export const createPointsRegisterEntryBodySchema = z.object({
  accountId: z.string().min(1).optional(),
  balanceKind: z.literal("LOYALTY_POINTS"),
  type: z.enum(["EARNED", "EXPECTED", "REVERSAL", "EXPIRATION", "REDEMPTION", "TRANSFER", "MISSED_ESTIMATE", "CORRECTION"]),
  status: z.enum(["CONFIRMED", "PENDING", "ESTIMATED", "REVERSED"]),
  pointsDelta: z.number().int().min(-2_000_000_000).max(2_000_000_000),
  label: z.string().trim().min(1).max(240),
  merchantName: z.string().trim().max(160).optional(),
  category: z.string().trim().max(80).optional(),
  city: z.string().trim().max(120).optional(),
  coarseArea: z.string().trim().max(80).optional(),
  occurredAt: z.coerce.date(),
  estimatedCashValueCents: z.number().int().min(-2_000_000_000).max(2_000_000_000).optional(),
  estimatedTravelValueCents: z.number().int().min(-2_000_000_000).max(2_000_000_000).optional(),
  evidenceIds: z.array(z.string()).max(100).default([]),
  correctionOfId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const pointsRegisterQuerySchema = z.object({
  days: z.coerce.number().int().refine((value) => [30, 90, 365].includes(value)).default(30),
});

export const createFinancialGoalBodySchema = z.object({
  kind: z.enum(["EMERGENCY_FUND", "DEBT_PAYOFF", "INVESTING", "CASH_SAVINGS", "PLANNED_PURCHASE", "TRAVEL"]),
  name: z.string().trim().min(1).max(160),
  targetCents: centsSchema,
  capturedCents: centsSchema.default(0),
  currency: currencySchema,
});

export const calculateRewardScenarioBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  purchaseCents: centsSchema,
  category: z.string().trim().min(1).max(80),
  goalId: z.string().min(1).optional(),
});

export const gameStopsQuerySchema = z.object({
  area: z.string().trim().max(80).optional(),
  city: z.string().trim().max(120).optional(),
});

export const createGameStopBodySchema = z.object({
  name: z.string().trim().min(1).max(180),
  city: z.string().trim().min(1).max(120),
  coarseArea: z.string().trim().min(1).max(80),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  sourceName: z.string().trim().min(1).max(160),
  sourceUrl: z.string().url().optional(),
  validThrough: z.coerce.date().optional(),
});

export const updateGameStopBodySchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "RETIRED"]).optional(),
  sourceName: z.string().trim().min(1).max(160).optional(),
  sourceUrl: z.string().url().nullable().optional(),
  validThrough: z.coerce.date().nullable().optional(),
  version: z.number().int().positive(),
});

export const createGameStopEventBodySchema = z.object({
  gameStopId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(180),
  taskType: z.enum(["COMPARE_OFFERS", "SELECT_CARD", "CHECK_REWARD_RULE", "FIND_PROMOTION", "SCAN_PRICE", "REVIEW_BENEFIT"]),
  prompt: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(240)).min(2).max(6),
  correctAnswer: z.string().trim().min(1).max(240),
  pointsAward: z.number().int().min(1).max(100),
  atHome: z.boolean().default(false),
  activeFrom: z.coerce.date().default(() => new Date()),
  activeThrough: z.coerce.date().optional(),
  evidenceIds: z.array(z.string()).max(100).default([]),
});

export const updateGameStopEventBodySchema = z.object({
  activeThrough: z.coerce.date().nullable().optional(),
  pointsAward: z.number().int().min(1).max(100).optional(),
  evidenceIds: z.array(z.string()).max(100).optional(),
  version: z.number().int().positive(),
});

export const createGameStopSessionBodySchema = z.object({
  eventId: z.string().min(1),
  coarseArea: z.string().trim().max(80).optional(),
  distanceMeters: z.number().int().nonnegative().max(100_000).optional(),
  accuracyMeters: z.number().int().nonnegative().max(10_000).optional(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(720),
  atHome: z.boolean(),
});

export const completeGameStopSessionBodySchema = z.object({
  answer: z.string().trim().min(1).max(240),
});

export const updatePointsModeBodySchema = z.object({
  enabled: z.boolean(),
  cityWatchEnabled: z.boolean(),
  cityWatchCities: z.array(z.string().trim().min(1).max(120)).max(20),
  version: z.number().int().positive().optional(),
});
