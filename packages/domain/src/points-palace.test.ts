import assert from "node:assert/strict";
import test from "node:test";
import type { PointsAccount, PointsRegisterEntry } from "@pop/contracts";
import {
  coarseAreaKey,
  derivePalaceProgress,
  derivePointsRecency,
  distanceMeters,
  evaluateGameStopCompletion,
} from "./index";

const accounts: PointsAccount[] = [
  { id: "loyalty", name: "Travel points", programKey: "travel", kind: "LOYALTY_POINTS", balance: 10_000, cashValueCentsPerThousand: 1000 },
  { id: "progress", name: "PoP progress", programKey: "pop", kind: "POP_PROGRESS", balance: 80 },
];

const entries: PointsRegisterEntry[] = [
  { id: "earned", accountId: "loyalty", balanceKind: "LOYALTY_POINTS", type: "EARNED", status: "CONFIRMED", pointsDelta: 500, label: "Groceries", merchantName: "Market", category: "Groceries", occurredAt: "2026-08-01T12:00:00.000Z", evidenceIds: [] },
  { id: "estimated", accountId: "loyalty", balanceKind: "LOYALTY_POINTS", type: "MISSED_ESTIMATE", status: "ESTIMATED", pointsDelta: 900, label: "Possible miss", occurredAt: "2026-08-02T12:00:00.000Z", evidenceIds: [] },
  { id: "progress", accountId: "progress", balanceKind: "POP_PROGRESS", type: "PROGRESS_AWARD", status: "CONFIRMED", pointsDelta: 80, label: "Game Stop", occurredAt: "2026-08-03T12:00:00.000Z", evidenceIds: [] },
];

test("keeps loyalty balances separate from PoP progress", () => {
  const progress = derivePalaceProgress(accounts, entries);
  assert.equal(progress.confirmedLoyaltyPoints, 10_000);
  assert.equal(progress.totalPoints, 80);
  assert.equal(progress.estimatedCashValue.amountCents, 10_000);
});

test("derives recent and quiet earning activity only from confirmed earnings", () => {
  const recency = derivePointsRecency(entries, accounts, new Date("2026-09-15T12:00:00.000Z"));
  assert.equal(recency.find((item) => item.key === "category:groceries")?.status, "QUIET");
  assert.equal(recency.some((item) => item.label === "Possible miss"), false);
});

test("enforces proximity, accuracy, daily limits, and weekly stop cooldown", () => {
  const base = {
    now: new Date("2026-08-10T12:00:00.000Z"),
    sessionExpiresAt: "2026-08-10T12:05:00.000Z",
    atHome: false,
    distanceMeters: 90,
    accuracyMeters: 35,
    dailyCompletionTimes: [] as string[],
    stopCompletionTimes: [] as string[],
  };
  assert.equal(evaluateGameStopCompletion(base).allowed, true);
  assert.equal(evaluateGameStopCompletion({ ...base, distanceMeters: 151 }).reason, "OUTSIDE_STOP");
  assert.equal(evaluateGameStopCompletion({ ...base, accuracyMeters: 201 }).reason, "LOCATION_INACCURATE");
  assert.equal(evaluateGameStopCompletion({ ...base, dailyCompletionTimes: ["2026-08-10T08:00:00.000Z", "2026-08-10T09:00:00.000Z", "2026-08-10T10:00:00.000Z"] }).reason, "DAILY_LIMIT");
  assert.equal(evaluateGameStopCompletion({ ...base, stopCompletionTimes: ["2026-08-08T10:00:00.000Z"] }).reason, "STOP_COOLDOWN");
  assert.equal(evaluateGameStopCompletion({ ...base, atHome: true, distanceMeters: undefined, accuracyMeters: undefined }).allowed, true);
});

test("rounds discovery areas and calculates distance on device", () => {
  assert.equal(coarseAreaKey(34.0522, -118.2437), "34.05,-118.25");
  assert.ok(distanceMeters({ latitude: 34.0522, longitude: -118.2437 }, { latitude: 34.0523, longitude: -118.2438 }) < 20);
});
