export type Money = {
  amountCents: number;
  currency: "USD";
};

export type EvidenceKind =
  | "EMAIL_METADATA"
  | "TRANSACTION"
  | "MERCHANT_PAGE"
  | "CARD_TERMS"
  | "USER_CONFIRMATION"
  | "PUBLIC_FEED";

export type Evidence = {
  id: string;
  kind: EvidenceKind;
  sourceName: string;
  summary: string;
  sourceUrl?: string;
  observedAt: string;
  contentHash: string;
};

export type Merchant = {
  id: string;
  name: string;
  category: string;
  domain?: string;
};

export type Offer = {
  id: string;
  merchant: Merchant;
  title: string;
  currentPrice: Money;
  previousPrice?: Money;
  shipping?: Money;
  validThrough?: string;
  observedAt: string;
  evidenceIds: string[];
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "UNVERIFIED";
};

export type Watch = {
  id: string;
  title: string;
  merchantName: string;
  targetPrice: Money;
  currentPrice?: Money;
  status: "WATCHING" | "TARGET_HIT" | "PAUSED";
  lastCheckedAt?: string;
};

export type Subscription = {
  id: string;
  merchantName: string;
  serviceKey?: string;
  planName?: string;
  billingChannel?: string;
  amount: Money;
  cadence: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "UNKNOWN";
  nextRenewalAt?: string;
  lastUsedAt?: string;
  status: "ACTIVE" | "TRIAL" | "POSSIBLE" | "CANCELLING" | "CANCELLED";
  evidenceIds: string[];
};

export type SubscriptionEligibility =
  | "NEW_ONLY"
  | "RETURNING_ONLY"
  | "STUDENT"
  | "FAMILY"
  | "DEVICE"
  | "PARTNER"
  | "ANY"
  | "UNKNOWN";

export type SubscriptionService = {
  id: string;
  canonicalKey: string;
  displayName: string;
  aliases: string[];
  domains: string[];
  category: "MUSIC" | "VIDEO" | "SOFTWARE" | "NEWS" | "OTHER";
  automationSupported: boolean;
};

export type DealOffer = {
  id: string;
  serviceKey: string;
  serviceName: string;
  title: string;
  planName: string;
  eligibility: SubscriptionEligibility;
  price: Money;
  renewalPrice?: Money;
  trialDays?: number;
  validThrough?: string;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "REJECTED";
  verification: "OBSERVED" | "CHECKED" | "ELIGIBILITY_UNCONFIRMED" | "EXPIRED" | "REJECTED";
  sourceName: string;
  sourceUrl?: string;
  observedAt: string;
  evidenceIds: string[];
  confidence: number;
}

export type DuplicateCandidate = {
  id: string;
  type: "IMPORT_DUPLICATE" | "ACTIVE_SERVICE_DUPLICATE";
  subscriptionIds: string[];
  serviceKey: string;
  confidence: number;
  status: "NEW" | "PENDING_REVIEW" | "AUTO_CANCEL_ELIGIBLE" | "CANCEL_IN_PROGRESS" | "CANCELLED" | "KEPT" | "FAILED" | "CONFLICT";
  reasons: string[];
  evidenceIds: string[];
  version: number;
};

export type AutomationPolicy = {
  id: string;
  enabled: boolean;
  autoCancelExactDuplicates: boolean;
  protectedServiceKeys: string[];
  protectedPlanKinds: string[];
  recentlyUsedDays: number;
  maxMonthlyAmountCents?: number;
  dailyDealAlerts: boolean;
  renewalAlerts: boolean;
  version: number;
};

export type CancellationRun = {
  id: string;
  candidateId: string;
  subscriptionId: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "FAILED";
  adapterKey: string;
  reason: string;
  failureCode?: string;
  startedAt?: string;
  completedAt?: string;
  version: number;
};

export type SubscriptionRadar = {
  services: SubscriptionService[];
  dealOffers: DealOffer[];
  duplicateCandidates: DuplicateCandidate[];
  automationPolicy?: AutomationPolicy;
  cancellationRuns: CancellationRun[];
};

export type CancellationTask = {
  id: string;
  subscriptionId: string;
  merchantName: string;
  status: "PLANNED" | "IN_PROGRESS" | "CONFIRMED" | "BLOCKED";
  method: "ACCOUNT_PAGE" | "EMAIL" | "PHONE" | "CHAT" | "UNKNOWN";
  actionUrl?: string;
  instructions: string[];
  version: number;
};

export type UserCard = {
  id: string;
  productName: string;
  issuer: string;
  network: "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER" | "OTHER";
  lastFour?: string;
  rewardRules: RewardRule[];
};

export type RewardRule = {
  id: string;
  category: string;
  rateBasisPoints: number;
  capCents?: number;
  validThrough?: string;
  evidenceIds: string[];
};

export type PointBalanceKind = "LOYALTY_POINTS" | "POP_PROGRESS";

export type PointsRegisterEntryType =
  | "EARNED"
  | "EXPECTED"
  | "REVERSAL"
  | "EXPIRATION"
  | "REDEMPTION"
  | "TRANSFER"
  | "MISSED_ESTIMATE"
  | "PROGRESS_AWARD"
  | "CORRECTION";

export type PointsAccount = {
  id: string;
  name: string;
  programKey: string;
  kind: PointBalanceKind;
  balance: number;
  expiresAt?: string;
  lastEarnedAt?: string;
  cashValueCentsPerThousand?: number;
  travelValueCentsPerThousand?: number;
};

export type PointsRegisterEntry = {
  id: string;
  accountId?: string;
  balanceKind: PointBalanceKind;
  type: PointsRegisterEntryType;
  status: "CONFIRMED" | "PENDING" | "ESTIMATED" | "REVERSED";
  pointsDelta: number;
  label: string;
  merchantName?: string;
  category?: string;
  city?: string;
  coarseArea?: string;
  occurredAt: string;
  estimatedCashValue?: Money;
  estimatedTravelValue?: Money;
  evidenceIds: string[];
  correctionOfId?: string;
};

export type PointsRecency = {
  key: string;
  label: string;
  scope: "MERCHANT" | "CATEGORY" | "PROGRAM";
  status: "RECENT" | "QUIET" | "NEVER";
  lastEarnedAt?: string;
  daysSince?: number;
};

export type FinancialGoal = {
  id: string;
  kind: "EMERGENCY_FUND" | "DEBT_PAYOFF" | "INVESTING" | "CASH_SAVINGS" | "PLANNED_PURCHASE" | "TRAVEL";
  name: string;
  target: Money;
  captured: Money;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  version: number;
};

export type GameStopEvent = {
  id: string;
  gameStopId?: string;
  title: string;
  taskType: "COMPARE_OFFERS" | "SELECT_CARD" | "CHECK_REWARD_RULE" | "FIND_PROMOTION" | "SCAN_PRICE" | "REVIEW_BENEFIT";
  prompt: string;
  options: string[];
  pointsAward: number;
  atHome: boolean;
  expiresAt?: string;
};

export type GameStop = {
  id: string;
  name: string;
  city: string;
  coarseArea: string;
  latitude: number;
  longitude: number;
  status: "AVAILABLE" | "COMPLETED_RECENTLY" | "NEW_EVENT" | "NO_CURRENT_EVENT";
  sourceName: string;
  sourceUrl?: string;
  event?: GameStopEvent;
  lastCompletedAt?: string;
};

export type GameStopSession = {
  id: string;
  eventId: string;
  gameStopId?: string;
  prompt: string;
  options: string[];
  pointsAward: number;
  atHome: boolean;
  expiresAt: string;
};

export type PointsModePreference = {
  activeUntil?: string;
  cityWatchEnabled: boolean;
  cityWatchCities: string[];
  version: number;
};

export type PointsPalaceData = {
  accounts: PointsAccount[];
  register: PointsRegisterEntry[];
  recency: PointsRecency[];
  goals: FinancialGoal[];
  gameStops: GameStop[];
  atHomeEvents: GameStopEvent[];
  pointsMode: PointsModePreference;
  progress: {
    level: number;
    totalPoints: number;
    nextLevelPoints: number;
    confirmedLoyaltyPoints: number;
    estimatedCashValue: Money;
  };
};

export type RecommendationType =
  | "CANCEL_SUBSCRIPTION"
  | "BUY_NOW"
  | "WAIT_FOR_PRICE"
  | "USE_CARD"
  | "NEARBY_DEAL";

export type Recommendation = {
  id: string;
  type: RecommendationType;
  title: string;
  explanation: string;
  estimatedSavings: Money;
  confidence: number;
  assumptions: string[];
  evidenceIds: string[];
  expiresAt?: string;
  actionLabel: string;
  actionHref?: string;
  userConfirmationRequired: true;
};

export type Connector = {
  id: string;
  name: string;
  kind: "FAD_EXPORT" | "GMAIL_METADATA" | "BROWSER_EXTENSION" | "MERCHANT_PAGE";
  status: "CONNECTED" | "READY" | "NEEDS_ATTENTION" | "DISCONNECTED";
  lastSyncAt?: string;
  detail: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "OPPORTUNITY" | "URGENT";
  createdAt: string;
  read: boolean;
};

export type DashboardData = {
  workspace: {
    id: string;
    name: string;
    mode: "DEMO" | "LIVE" | "LOCAL";
  };
  generatedAt: string;
  recommendations: Recommendation[];
  offers: Offer[];
  watches: Watch[];
  subscriptions: Subscription[];
  cancellationTasks: CancellationTask[];
  cards: UserCard[];
  evidence: Evidence[];
  connectors: Connector[];
  notifications: Notification[];
  subscriptionRadar?: SubscriptionRadar;
  pointsPalace: PointsPalaceData;
};

export type SyncEvent<T = unknown> = {
  id: string;
  workspaceId: string;
  deviceId: string;
  sequence: number;
  entityType: string;
  entityId: string;
  operation: "UPSERT" | "DELETE" | "CONFIRM";
  payload: T;
  occurredAt: string;
  idempotencyKey: string;
};

export type ApiError = {
  error: string;
  message: string;
  requestId?: string;
  details?: unknown;
};
