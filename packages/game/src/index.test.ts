import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDemoDashboard } from "@pop/domain";
import { deriveKingdomDeadline, deriveKingdomDistricts, deriveKingdomProgress, deriveUrgentQuests } from "./index";

const now = new Date("2026-08-12T12:00:00.000Z");

describe("kingdom view model", () => {
  it("maps live dashboard signals to quiet or active districts", () => {
    const data = createDemoDashboard();
    const districts = deriveKingdomDistricts(data);
    assert.deepEqual(districts.map((district) => district.label), ["Price Watch Market", "Subscription Station", "Promo Code Arcade", "Points Palace", "Nearby Deals"]);
    assert.equal(districts.find((district) => district.id === "market")?.status, "attention");
    assert.ok((districts.find((district) => district.id === "palace")?.count ?? 0) > 0);
  });

  it("orders renewals and duplicates before regular offer review", () => {
    const data = createDemoDashboard();
    data.subscriptions[0].nextRenewalAt = "2026-08-15T12:00:00.000Z";
    const quests = deriveUrgentQuests(data, now);
    assert.equal(quests[0]?.kind, "renewal");
    assert.ok(quests.some((quest) => quest.kind === "duplicate"));
    assert.ok(quests.some((quest) => quest.kind === "promo"));
  });

  it("formats deadline urgency without depending on the current clock", () => {
    assert.deepEqual(deriveKingdomDeadline({ expiresAt: "2026-08-12T12:00:00.000Z" }, now).label, "Today");
    assert.equal(deriveKingdomDeadline({ expiresAt: "2026-08-15T12:00:00.000Z" }, now).urgency, "soon");
    assert.equal(deriveKingdomDeadline({ expiresAt: "2026-08-11T12:00:00.000Z" }, now).urgency, "expired");
    assert.equal(deriveKingdomDeadline({ expiresAt: "2026-08-12T11:59:59.000Z" }, now).urgency, "expired");
    assert.equal(deriveKingdomDeadline({ expiresAt: "invalid" }, now).urgency, "none");
  });

  it("keeps Palace progress deterministic", () => {
    const progress = deriveKingdomProgress(createDemoDashboard());
    assert.equal(progress.level, 1);
    assert.ok(progress.percent >= 0 && progress.percent <= 100);
  });
});
