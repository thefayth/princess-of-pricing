import "dotenv/config";
import { PgBoss } from "pg-boss";
import { contentHash } from "@pop/connectors";
import {
  JOBS,
  QUEUE_POLICY,
  type FadImportJob,
  type AutoCancelJob,
  type CancellationRetryJob,
  type DealEligibilityRecheckJob,
  type DealRefreshJob,
  type DuplicateClusterJob,
  type GmailScanJob,
  type NotifyJob,
  type PriceRefreshJob,
  type RecalculateJob,
  type ReceiptVerifyJob,
  type PointsRecalculateJob,
  type CityPackReviewJob,
  type RenewalAlertJob,
  type SubscriptionDiscoveryJob,
} from "./jobs.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const boss = new PgBoss({ connectionString, application_name: "prince-of-pricing-worker" });

async function registerQueue(name: string) {
  await boss.createQueue(name, {
    retryLimit: QUEUE_POLICY.retryLimit,
    retryDelay: QUEUE_POLICY.retryDelay,
    retryBackoff: QUEUE_POLICY.retryBackoff,
    expireInSeconds: QUEUE_POLICY.expireInSeconds,
    retentionSeconds: QUEUE_POLICY.retentionSeconds,
  });
}

async function main() {
  await boss.start();
  for (const name of Object.values(JOBS) as string[]) await registerQueue(name);

  await boss.work<FadImportJob>(JOBS.fadImport, async ([job]) => {
    if (!job) return;
    const payload = job.data;
    if (contentHash({ workspaceId: payload.workspaceId, exportPath: payload.exportPath }).length !== 64) {
      throw new Error("FAD import fingerprint failed");
    }
    console.info(JSON.stringify({ event: "fad_import_ready", jobId: job.id, workspaceId: payload.workspaceId }));
  });

  await boss.work<GmailScanJob>(JOBS.gmailScan, async ([job]) => {
    if (!job) return;
    const payload = job.data;
    console.info(JSON.stringify({ event: "gmail_metadata_scan_ready", jobId: job.id, workspaceId: payload.workspaceId, dryRun: payload.dryRun }));
  });

  await boss.work<PriceRefreshJob>(JOBS.priceRefresh, { localConcurrency: 2 }, async ([job]) => {
    if (!job) return;
    const payload = job.data;
    console.info(JSON.stringify({ event: "price_refresh_ready", jobId: job.id, workspaceId: payload.workspaceId, host: payload.merchantHost }));
  });

  await boss.work<RecalculateJob>(JOBS.recalculate, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "recommendation_recalculation_ready", jobId: job.id }));
  });

  await boss.work<NotifyJob>(JOBS.notify, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "notification_ready", jobId: job.id }));
  });

  await boss.work<SubscriptionDiscoveryJob>(JOBS.subscriptionDiscovery, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "subscription_discovery_ready", jobId: job.id, workspaceId: job.data.workspaceId, source: job.data.source }));
  });

  await boss.work<DealRefreshJob>(JOBS.dealRefresh, { localConcurrency: 2 }, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "deal_refresh_ready", jobId: job.id, workspaceId: job.data.workspaceId, serviceKeys: job.data.serviceKeys, reason: job.data.reason }));
  });

  await boss.work<DealEligibilityRecheckJob>(JOBS.dealEligibilityRecheck, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "deal_eligibility_recheck_ready", jobId: job.id, workspaceId: job.data.workspaceId, dealOfferIds: job.data.dealOfferIds }));
  });

  await boss.work<RenewalAlertJob>(JOBS.renewalAlert, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "renewal_alert_ready", jobId: job.id, workspaceId: job.data.workspaceId, subscriptionIds: job.data.subscriptionIds }));
  });

  await boss.work<DuplicateClusterJob>(JOBS.duplicateCluster, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "duplicate_cluster_ready", jobId: job.id, workspaceId: job.data.workspaceId, subscriptionIds: job.data.subscriptionIds ?? "all" }));
  });

  await boss.work<AutoCancelJob>(JOBS.autoCancel, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "auto_cancel_ready", jobId: job.id, workspaceId: job.data.workspaceId, candidateId: job.data.candidateId, subscriptionId: job.data.subscriptionId }));
  });

  await boss.work<CancellationRetryJob>(JOBS.cancellationRetry, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "cancellation_retry_ready", jobId: job.id, workspaceId: job.data.workspaceId, runId: job.data.runId }));
  });

  await boss.work<ReceiptVerifyJob>(JOBS.receiptVerify, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "receipt_verify_ready", jobId: job.id, workspaceId: job.data.workspaceId, runId: job.data.runId }));
  });

  await boss.work<PointsRecalculateJob>(JOBS.pointsRecalculate, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "points_recalculation_ready", jobId: job.id, workspaceId: job.data.workspaceId, reason: job.data.reason }));
  });

  await boss.work<CityPackReviewJob>(JOBS.cityPackReview, async ([job]) => {
    if (!job) return;
    console.info(JSON.stringify({ event: "city_pack_review_ready", jobId: job.id, workspaceId: job.data.workspaceId, city: job.data.city ?? "all", asOf: job.data.asOf }));
  });
}

async function shutdown() {
  await boss.stop({ graceful: true, timeout: 30_000 });
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
