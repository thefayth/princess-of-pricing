import type {
  DashboardData,
  PointsAccount,
  PointsPalaceData,
  PointsRecency,
  PointsRegisterEntry,
} from "@pop/contracts";
import { buildRecommendations } from "@pop/recommendations";

const SERVICE_ALIASES: Record<string, { key: string; displayName: string; category: "MUSIC" | "VIDEO" | "SOFTWARE" | "NEWS" | "OTHER" }> = {
  apple: { key: "apple-music", displayName: "Apple Music", category: "MUSIC" },
  "apple music": { key: "apple-music", displayName: "Apple Music", category: "MUSIC" },
  "apple music subscription": { key: "apple-music", displayName: "Apple Music", category: "MUSIC" },
  spotify: { key: "spotify", displayName: "Spotify", category: "MUSIC" },
  "spotify premium": { key: "spotify", displayName: "Spotify", category: "MUSIC" },
};

export type SubscriptionIdentity = {
  serviceKey: string;
  planName?: string;
  cadence: string;
  amountCents: number;
  currency: string;
  billingChannel?: string;
  accountHint?: string;
  isBundle?: boolean;
  isFamilyOrHousehold?: boolean;
  lastUsedAt?: string;
};

export function canonicalizeSubscriptionService(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return SERVICE_ALIASES[normalized] ?? {
    key: normalized.replace(/\s+/g, "-") || "unknown-service",
    displayName: value.trim() || "Unknown service",
    category: "OTHER" as const,
  };
}

export function subscriptionIdentityFingerprint(input: SubscriptionIdentity) {
  const service = canonicalizeSubscriptionService(input.serviceKey).key;
  return [
    service,
    (input.planName ?? "").trim().toLowerCase(),
    input.cadence,
    input.amountCents,
    input.currency.toUpperCase(),
    (input.billingChannel ?? "").trim().toLowerCase(),
    (input.accountHint ?? "").trim().toLowerCase(),
  ].join("|");
}

export function isExactDuplicate(a: SubscriptionIdentity, b: SubscriptionIdentity) {
  if (a.isBundle || b.isBundle || a.isFamilyOrHousehold || b.isFamilyOrHousehold) return false;
  return canonicalizeSubscriptionService(a.serviceKey).key === canonicalizeSubscriptionService(b.serviceKey).key
    && a.planName?.trim().toLowerCase() === b.planName?.trim().toLowerCase()
    && a.cadence === b.cadence
    && a.amountCents === b.amountCents
    && a.currency.toUpperCase() === b.currency.toUpperCase();
}

export type AutomationDecision = "AUTO_CANCEL" | "REVIEW" | "KEEP";

export function evaluateDuplicateAutomation(
  candidate: { serviceKey: string; monthlyAmountCents: number; exact: boolean; planName?: string; isBundle?: boolean; isFamilyOrHousehold?: boolean; lastUsedAt?: string },
  policy: { enabled: boolean; autoCancelExactDuplicates: boolean; protectedServiceKeys: string[]; protectedPlanKinds: string[]; recentlyUsedDays: number; maxMonthlyAmountCents?: number },
  now = Date.now(),
): { decision: AutomationDecision; reasons: string[] } {
  const serviceKey = canonicalizeSubscriptionService(candidate.serviceKey).key;
  const reasons: string[] = [];
  if (!policy.enabled || !policy.autoCancelExactDuplicates) return { decision: "REVIEW", reasons: ["Automatic cancellation is not enabled"] };
  if (!candidate.exact) return { decision: "REVIEW", reasons: ["The duplicate match is not exact"] };
  if (candidate.isBundle || candidate.isFamilyOrHousehold) return { decision: "KEEP", reasons: ["Bundles and household plans are protected"] };
  if (policy.protectedServiceKeys.includes(serviceKey)) return { decision: "KEEP", reasons: ["This service is protected"] };
  const planKind = (candidate.planName ?? "").toLowerCase();
  if (policy.protectedPlanKinds.some((kind) => planKind.includes(kind.toLowerCase()))) return { decision: "KEEP", reasons: ["This plan type is protected"] };
  if (policy.maxMonthlyAmountCents != null && candidate.monthlyAmountCents > policy.maxMonthlyAmountCents) return { decision: "REVIEW", reasons: ["The amount exceeds the policy limit"] };
  if (candidate.lastUsedAt) {
    const ageDays = (now - new Date(candidate.lastUsedAt).getTime()) / 86_400_000;
    if (ageDays < policy.recentlyUsedDays) return { decision: "REVIEW", reasons: ["The service was used recently"] };
  }
  reasons.push("Exact duplicate matches the saved cancellation policy");
  return { decision: "AUTO_CANCEL", reasons };
}

export function offerEligibilityLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

const DAY_MS = 86_400_000;
const POINTS_PER_LEVEL = 250;

export function derivePointsRecency(
  entries: PointsRegisterEntry[],
  accounts: PointsAccount[],
  now = new Date(),
  quietAfterDays = 30,
): PointsRecency[] {
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const latest = new Map<string, { label: string; scope: PointsRecency["scope"]; occurredAt: string }>();

  for (const entry of entries) {
    if (entry.balanceKind !== "LOYALTY_POINTS" || entry.status !== "CONFIRMED" || entry.type !== "EARNED") continue;
    const dimensions: Array<[string, string, PointsRecency["scope"]]> = [];
    if (entry.merchantName) dimensions.push([`merchant:${entry.merchantName.toLowerCase()}`, entry.merchantName, "MERCHANT"]);
    if (entry.category) dimensions.push([`category:${entry.category.toLowerCase()}`, entry.category, "CATEGORY"]);
    const programName = entry.accountId ? accountNames.get(entry.accountId) : undefined;
    if (programName) dimensions.push([`program:${entry.accountId}`, programName, "PROGRAM"]);

    for (const [key, label, scope] of dimensions) {
      const current = latest.get(key);
      if (!current || Date.parse(entry.occurredAt) > Date.parse(current.occurredAt)) {
        latest.set(key, { label, scope, occurredAt: entry.occurredAt });
      }
    }
  }

  return [...latest.entries()]
    .map(([key, value]) => {
      const daysSince = Math.max(0, Math.floor((now.getTime() - Date.parse(value.occurredAt)) / DAY_MS));
      return {
        key,
        label: value.label,
        scope: value.scope,
        status: daysSince <= quietAfterDays ? "RECENT" as const : "QUIET" as const,
        lastEarnedAt: value.occurredAt,
        daysSince,
      };
    })
    .sort((left, right) => (left.daysSince ?? 0) - (right.daysSince ?? 0));
}

export function derivePalaceProgress(accounts: PointsAccount[], entries: PointsRegisterEntry[]) {
  const totalPoints = entries
    .filter((entry) => entry.balanceKind === "POP_PROGRESS" && entry.status === "CONFIRMED")
    .reduce((total, entry) => total + entry.pointsDelta, 0);
  const confirmedLoyaltyPoints = accounts
    .filter((account) => account.kind === "LOYALTY_POINTS")
    .reduce((total, account) => total + account.balance, 0);
  const estimatedCashValueCents = accounts
    .filter((account) => account.kind === "LOYALTY_POINTS" && account.cashValueCentsPerThousand)
    .reduce((total, account) => total + Math.floor((account.balance * (account.cashValueCentsPerThousand ?? 0)) / 1_000), 0);
  const safeTotal = Math.max(0, totalPoints);
  const level = Math.floor(safeTotal / POINTS_PER_LEVEL) + 1;
  return {
    level,
    totalPoints: safeTotal,
    nextLevelPoints: level * POINTS_PER_LEVEL,
    confirmedLoyaltyPoints,
    estimatedCashValue: { amountCents: estimatedCashValueCents, currency: "USD" as const },
  };
}

export function coarseAreaKey(latitude: number, longitude: number) {
  const coarse = roundToCoarseLocation(latitude, longitude);
  return `${coarse.latitude.toFixed(2)},${coarse.longitude.toFixed(2)}`;
}

export function distanceMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const leftLatitude = radians(from.latitude);
  const rightLatitude = radians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

export function evaluateGameStopCompletion(input: {
  now: Date;
  sessionExpiresAt: string;
  atHome: boolean;
  distanceMeters?: number;
  accuracyMeters?: number;
  dailyCompletionTimes: string[];
  stopCompletionTimes: string[];
}) {
  if (Date.parse(input.sessionExpiresAt) <= input.now.getTime()) return { allowed: false, reason: "SESSION_EXPIRED" as const };
  if (!input.atHome) {
    if (input.distanceMeters == null || input.distanceMeters > 150) return { allowed: false, reason: "OUTSIDE_STOP" as const };
    if (input.accuracyMeters == null || input.accuracyMeters > 200) return { allowed: false, reason: "LOCATION_INACCURATE" as const };
  }
  const dayStart = new Date(input.now);
  dayStart.setHours(0, 0, 0, 0);
  const completedToday = input.dailyCompletionTimes.filter((value) => Date.parse(value) >= dayStart.getTime()).length;
  if (completedToday >= 3) return { allowed: false, reason: "DAILY_LIMIT" as const };
  const sevenDaysAgo = input.now.getTime() - 7 * DAY_MS;
  if (!input.atHome && input.stopCompletionTimes.some((value) => Date.parse(value) >= sevenDaysAgo)) {
    return { allowed: false, reason: "STOP_COOLDOWN" as const };
  }
  return { allowed: true, reason: "ALLOWED" as const };
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function createDemoDashboard(): DashboardData {
  const evidence: DashboardData["evidence"] = [
    {
      id: "ev-sub-stream",
      kind: "EMAIL_METADATA",
      sourceName: "Gmail read-only demo",
      summary: "Renewal metadata indicates a monthly entertainment subscription.",
      observedAt: new Date().toISOString(),
      contentHash: "demo-subscription-stream-v1",
    },
    {
      id: "ev-price-headphones",
      kind: "MERCHANT_PAGE",
      sourceName: "Browser observation demo",
      summary: "Structured offer data changed from $149.99 to $119.99.",
      observedAt: new Date().toISOString(),
      contentHash: "demo-headphones-price-v1",
    },
    {
      id: "ev-card-grocery",
      kind: "CARD_TERMS",
      sourceName: "Issuer terms demo",
      summary: "Published terms list 4% rewards for grocery purchases.",
      observedAt: new Date().toISOString(),
      contentHash: "demo-card-grocery-v1",
    },
    {
      id: "ev-points-register",
      kind: "TRANSACTION",
      sourceName: "Points Register demo",
      summary: "A grocery transaction earned verified card rewards.",
      observedAt: new Date().toISOString(),
      contentHash: "demo-points-register-v1",
    },
  ];

  const subscriptions: DashboardData["subscriptions"] = [
    {
      id: "sub-stream",
      merchantName: "Streamstack",
      amount: { amountCents: 2499, currency: "USD" },
      cadence: "MONTHLY",
      nextRenewalAt: hoursFromNow(72),
      lastUsedAt: new Date(Date.now() - 47 * 24 * 60 * 60 * 1000).toISOString(),
      status: "ACTIVE",
      evidenceIds: ["ev-sub-stream"],
    },
    {
      id: "sub-cloud",
      merchantName: "CloudKeep",
      amount: { amountCents: 299, currency: "USD" },
      cadence: "MONTHLY",
      nextRenewalAt: hoursFromNow(216),
      status: "ACTIVE",
      evidenceIds: ["ev-sub-stream"],
    },
  ];

  const subscriptionRadar: NonNullable<DashboardData["subscriptionRadar"]> = {
    services: [
      { id: "service-spotify", canonicalKey: "spotify", displayName: "Spotify", aliases: ["Spotify Premium"], domains: ["spotify.com"], category: "MUSIC", automationSupported: true },
      { id: "service-apple-music", canonicalKey: "apple-music", displayName: "Apple Music", aliases: ["Apple Music Subscription"], domains: ["apple.com", "music.apple.com"], category: "MUSIC", automationSupported: false },
    ],
    dealOffers: [
      { id: "deal-spotify-intro", serviceKey: "spotify", serviceName: "Spotify", title: "One month free", planName: "Premium Individual", eligibility: "NEW_ONLY", price: { amountCents: 0, currency: "USD" }, renewalPrice: { amountCents: 1299, currency: "USD" }, trialDays: 30, status: "ACTIVE", verification: "CHECKED", sourceName: "Spotify U.S. Premium", sourceUrl: "https://www.spotify.com/us/premium/", observedAt: new Date().toISOString(), evidenceIds: ["ev-sub-stream"], confidence: 0.95 },
      { id: "deal-apple-device", serviceKey: "apple-music", serviceName: "Apple Music", title: "Three months with an eligible device", planName: "Individual", eligibility: "DEVICE", price: { amountCents: 0, currency: "USD" }, trialDays: 90, status: "ACTIVE", verification: "ELIGIBILITY_UNCONFIRMED", sourceName: "Apple Music U.S.", sourceUrl: "https://www.apple.com/apple-music/", observedAt: new Date().toISOString(), evidenceIds: ["ev-sub-stream"], confidence: 0.8 },
    ],
    duplicateCandidates: [
      { id: "duplicate-streamstack", type: "ACTIVE_SERVICE_DUPLICATE", subscriptionIds: ["sub-stream", "sub-stream-duplicate"], serviceKey: "streamstack", confidence: 0.91, status: "PENDING_REVIEW", reasons: ["Same service and monthly amount observed twice", "Account identity is not verified"], evidenceIds: ["ev-sub-stream"], version: 1 },
    ],
    automationPolicy: { id: "policy-demo", enabled: true, autoCancelExactDuplicates: true, protectedServiceKeys: ["apple-music"], protectedPlanKinds: ["family", "bundle", "annual", "prepaid", "contract"], recentlyUsedDays: 30, dailyDealAlerts: true, renewalAlerts: true, version: 1 },
    cancellationRuns: [],
  };

  const cards: DashboardData["cards"] = [
    {
      id: "card-everyday",
      productName: "Everyday 2%",
      issuer: "User-entered demo card",
      network: "VISA",
      lastFour: "2048",
      rewardRules: [
        { id: "rule-everyday", category: "*", rateBasisPoints: 200, evidenceIds: ["ev-card-grocery"] },
      ],
    },
    {
      id: "card-grocery",
      productName: "Grocery 4%",
      issuer: "User-entered demo card",
      network: "MASTERCARD",
      lastFour: "4112",
      rewardRules: [
        { id: "rule-grocery", category: "groceries", rateBasisPoints: 400, evidenceIds: ["ev-card-grocery"] },
        { id: "rule-grocery-base", category: "*", rateBasisPoints: 100, evidenceIds: ["ev-card-grocery"] },
      ],
    },
  ];

  const offers: DashboardData["offers"] = [
    {
      id: "offer-headphones",
      merchant: { id: "merchant-audio", name: "Audio Market", category: "electronics" },
      title: "QuietTone wireless headphones",
      currentPrice: { amountCents: 11_999, currency: "USD" },
      previousPrice: { amountCents: 14_999, currency: "USD" },
      validThrough: hoursFromNow(18),
      observedAt: new Date().toISOString(),
      evidenceIds: ["ev-price-headphones"],
      status: "EXPIRING",
    },
    {
      id: "offer-market",
      merchant: { id: "merchant-market", name: "Neighborhood Market", category: "groceries" },
      title: "Saved grocery basket",
      currentPrice: { amountCents: 6_420, currency: "USD" },
      previousPrice: { amountCents: 7_118, currency: "USD" },
      validThrough: hoursFromNow(30),
      observedAt: new Date().toISOString(),
      evidenceIds: ["ev-price-headphones"],
      status: "ACTIVE",
    },
  ];

  const pointsAccounts: PointsAccount[] = [
    { id: "points-everyday", name: "Everyday rewards", programKey: "everyday-cash", kind: "LOYALTY_POINTS", balance: 12_480, lastEarnedAt: new Date(Date.now() - 4 * DAY_MS).toISOString(), cashValueCentsPerThousand: 1000, travelValueCentsPerThousand: 1000 },
    { id: "points-travel", name: "Travel points", programKey: "travel-demo", kind: "LOYALTY_POINTS", balance: 38_200, lastEarnedAt: new Date(Date.now() - 48 * DAY_MS).toISOString(), cashValueCentsPerThousand: 1000, travelValueCentsPerThousand: 1650 },
    { id: "points-pop", name: "PoP progress", programKey: "pop-progress", kind: "POP_PROGRESS", balance: 190, lastEarnedAt: new Date(Date.now() - 2 * DAY_MS).toISOString() },
  ];
  const pointsRegister: PointsRegisterEntry[] = [
    { id: "register-grocery", accountId: "points-everyday", balanceKind: "LOYALTY_POINTS", type: "EARNED", status: "CONFIRMED", pointsDelta: 256, label: "Grocery rewards posted", merchantName: "Neighborhood Market", category: "Groceries", city: "Los Angeles", occurredAt: new Date(Date.now() - 4 * DAY_MS).toISOString(), estimatedCashValue: { amountCents: 256, currency: "USD" }, evidenceIds: ["ev-points-register"] },
    { id: "register-travel", accountId: "points-travel", balanceKind: "LOYALTY_POINTS", type: "EARNED", status: "CONFIRMED", pointsDelta: 1_200, label: "Travel points earned", merchantName: "Travel watch", category: "Travel", city: "Los Angeles", occurredAt: new Date(Date.now() - 48 * DAY_MS).toISOString(), estimatedCashValue: { amountCents: 1_200, currency: "USD" }, estimatedTravelValue: { amountCents: 1_980, currency: "USD" }, evidenceIds: ["ev-points-register"] },
    { id: "register-expected", accountId: "points-everyday", balanceKind: "LOYALTY_POINTS", type: "EXPECTED", status: "PENDING", pointsDelta: 84, label: "Dining rewards expected", merchantName: "City Cafe", category: "Dining", city: "Los Angeles", occurredAt: new Date(Date.now() - DAY_MS).toISOString(), evidenceIds: ["ev-points-register"] },
    { id: "register-missed", accountId: "points-everyday", balanceKind: "LOYALTY_POINTS", type: "MISSED_ESTIMATE", status: "ESTIMATED", pointsDelta: 120, label: "A different owned card may have earned more", merchantName: "Audio Market", category: "Electronics", occurredAt: new Date(Date.now() - 9 * DAY_MS).toISOString(), estimatedCashValue: { amountCents: 120, currency: "USD" }, evidenceIds: ["ev-card-grocery", "ev-price-headphones"] },
    { id: "register-pop", accountId: "points-pop", balanceKind: "POP_PROGRESS", type: "PROGRESS_AWARD", status: "CONFIRMED", pointsDelta: 190, label: "Points Palace orientation", occurredAt: new Date(Date.now() - 2 * DAY_MS).toISOString(), evidenceIds: ["ev-points-register"] },
  ];
  const gameStopEvent = {
    id: "event-market-card",
    gameStopId: "stop-market",
    title: "Pick the strongest grocery card",
    taskType: "SELECT_CARD" as const,
    prompt: "Which owned card earns the highest verified grocery reward?",
    options: ["Everyday 2%", "Grocery 4%", "Use cash"],
    pointsAward: 40,
    atHome: false,
  };
  const atHomeEvent = {
    id: "event-home-benefit",
    title: "Review an unused benefit",
    taskType: "REVIEW_BENEFIT" as const,
    prompt: "Which action protects value without requiring a purchase?",
    options: ["Review an expiring card credit", "Spend more for points", "Open another card"],
    pointsAward: 40,
    atHome: true,
  };
  const pointsPalace: PointsPalaceData = {
    accounts: pointsAccounts,
    register: pointsRegister,
    recency: derivePointsRecency(pointsRegister, pointsAccounts),
    goals: [{ id: "goal-emergency", kind: "EMERGENCY_FUND", name: "Emergency fund", target: { amountCents: 250_000, currency: "USD" }, captured: { amountCents: 31_400, currency: "USD" }, status: "ACTIVE", version: 1 }],
    gameStops: [{ id: "stop-market", name: "Neighborhood Market", city: "Los Angeles", coarseArea: "34.05,-118.25", latitude: 34.0522, longitude: -118.2437, status: "NEW_EVENT", sourceName: "Synthetic beta city pack", event: gameStopEvent }],
    atHomeEvents: [atHomeEvent],
    pointsMode: { cityWatchEnabled: false, cityWatchCities: [], version: 1 },
    progress: derivePalaceProgress(pointsAccounts, pointsRegister),
  };

  return {
    workspace: { id: "demo-books", name: "PoP private beta demo", mode: "DEMO" },
    generatedAt: new Date().toISOString(),
    recommendations: buildRecommendations({ subscriptions, offers, cards }),
    offers,
    watches: [
      {
        id: "watch-headphones",
        title: "QuietTone wireless headphones",
        merchantName: "Audio Market",
        targetPrice: { amountCents: 12_500, currency: "USD" },
        currentPrice: { amountCents: 11_999, currency: "USD" },
        status: "TARGET_HIT",
        lastCheckedAt: new Date().toISOString(),
      },
      {
        id: "watch-flight",
        title: "LAX to Atlanta round trip",
        merchantName: "Travel watch",
        targetPrice: { amountCents: 28_000, currency: "USD" },
        currentPrice: { amountCents: 34_600, currency: "USD" },
        status: "WATCHING",
        lastCheckedAt: new Date().toISOString(),
      },
    ],
    subscriptions,
    cancellationTasks: [
      {
        id: "task-stream",
        subscriptionId: "sub-stream",
        merchantName: "Streamstack",
        status: "PLANNED",
        method: "ACCOUNT_PAGE",
        actionUrl: "https://example.com/account",
        instructions: ["Open billing settings", "Review the renewal date", "Confirm cancellation yourself"],
        version: 1,
      },
    ],
    cards,
    evidence,
    connectors: [
      { id: "connector-fad", name: "Faith Accounting export", kind: "FAD_EXPORT", status: "READY", detail: "One-way metadata import is ready." },
      { id: "connector-gmail", name: "Gmail read-only", kind: "GMAIL_METADATA", status: "DISCONNECTED", detail: "Connect only when you want PoP to scan renewal metadata." },
      { id: "connector-browser", name: "PoP browser companion", kind: "BROWSER_EXTENSION", status: "READY", detail: "Observes a product only after you activate it." },
    ],
    notifications: [
      { id: "notice-renewal", title: "Renewal in 3 days", body: "Streamstack is scheduled to renew for $24.99.", severity: "URGENT", createdAt: new Date().toISOString(), read: false },
      { id: "notice-price", title: "Target price reached", body: "QuietTone headphones are now below your $125 target.", severity: "OPPORTUNITY", createdAt: new Date().toISOString(), read: false },
    ],
    subscriptionRadar,
    pointsPalace,
  };
}

export function roundToCoarseLocation(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Location coordinates must be finite numbers");
  }
  return {
    latitude: Math.round(latitude * 20) / 20,
    longitude: Math.round(longitude * 20) / 20,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}
