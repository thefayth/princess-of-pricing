import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeSubscriptionService, evaluateDuplicateAutomation, isExactDuplicate } from "./index";

test("canonicalizes music service aliases", () => {
  assert.equal(canonicalizeSubscriptionService("Spotify Premium").key, "spotify");
  assert.equal(canonicalizeSubscriptionService("Apple Music Subscription").key, "apple-music");
});

test("protects family and bundle plans from duplicate cancellation", () => {
  const base = { serviceKey: "spotify", planName: "Premium Family", cadence: "MONTHLY", amountCents: 2199, currency: "USD" };
  assert.equal(isExactDuplicate({ ...base, isFamilyOrHousehold: true }, { ...base, isFamilyOrHousehold: false }), false);
  assert.equal(isExactDuplicate({ ...base, isBundle: true }, { ...base, isBundle: false }), false);
});

test("requires exact matches before automatic cancellation", () => {
  const policy = {
    enabled: true,
    autoCancelExactDuplicates: true,
    protectedServiceKeys: [],
    protectedPlanKinds: ["family", "bundle", "annual", "prepaid"],
    recentlyUsedDays: 30,
  };
  const result = evaluateDuplicateAutomation({ serviceKey: "Spotify Premium", monthlyAmountCents: 1299, exact: true, planName: "Individual", lastUsedAt: "2025-01-01T00:00:00.000Z" }, policy, Date.parse("2025-03-01T00:00:00.000Z"));
  assert.equal(result.decision, "AUTO_CANCEL");
  assert.equal(evaluateDuplicateAutomation({ serviceKey: "Spotify", monthlyAmountCents: 1299, exact: false }, policy).decision, "REVIEW");
});
