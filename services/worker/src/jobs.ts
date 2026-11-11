export const JOBS = {
  fadImport: "pop.fad-import.v1",
  gmailScan: "pop.gmail-scan.v1",
  priceRefresh: "pop.price-refresh.v1",
  recalculate: "pop.recalculate.v1",
  notify: "pop.notify.v1",
  subscriptionDiscovery: "pop.subscription-discovery.v1",
  dealRefresh: "pop.deal-refresh.v1",
  dealEligibilityRecheck: "pop.deal-eligibility-recheck.v1",
  renewalAlert: "pop.renewal-alert.v1",
  duplicateCluster: "pop.duplicate-cluster.v1",
  autoCancel: "pop.auto-cancel.v1",
  cancellationRetry: "pop.cancellation-retry.v1",
  receiptVerify: "pop.receipt-verify.v1",
  pointsRecalculate: "pop.points-recalculate.v1",
  cityPackReview: "pop.city-pack-review.v1",
} as const;

export type FadImportJob = { workspaceId: string; exportPath: string; contentHash: string };
export type GmailScanJob = { workspaceId: string; connectorId: string; dryRun: boolean };
export type PriceRefreshJob = { workspaceId: string; merchantHost: string; productIds: string[] };
export type RecalculateJob = { workspaceId: string; reason: string };
export type NotifyJob = { workspaceId: string; notificationId: string };
export type SubscriptionDiscoveryJob = { workspaceId: string; source: "FAD" | "GMAIL_METADATA" | "CARD_TRANSACTIONS" | "MANUAL" };
export type DealRefreshJob = { workspaceId: string; serviceKeys: string[]; reason: "DAILY" | "RENEWAL" | "ON_DEMAND" };
export type DealEligibilityRecheckJob = { workspaceId: string; dealOfferIds: string[] };
export type RenewalAlertJob = { workspaceId: string; subscriptionIds: string[] };
export type DuplicateClusterJob = { workspaceId: string; subscriptionIds?: string[] };
export type AutoCancelJob = { workspaceId: string; candidateId: string; subscriptionId: string };
export type CancellationRetryJob = { workspaceId: string; runId: string };
export type ReceiptVerifyJob = { workspaceId: string; runId: string };
export type PointsRecalculateJob = { workspaceId: string; reason: "IMPORT" | "REGISTER_APPEND" | "NIGHTLY" };
export type CityPackReviewJob = { workspaceId: string; city?: string; asOf: string };

export const QUEUE_POLICY = {
  retryLimit: 5,
  retryDelay: 30,
  retryBackoff: true,
  expireInSeconds: 15 * 60,
  retentionSeconds: 30 * 24 * 60 * 60,
} as const;
