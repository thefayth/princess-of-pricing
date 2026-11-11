import assert from "node:assert/strict";
import test from "node:test";
import type { Subscription, UserCard } from "@pop/contracts";
import { annualSubscriptionCost, rankCards } from "./index";

test("annualizes monthly subscription costs in integer cents", () => {
  const subscription: Subscription = {
    id: "sub-1",
    merchantName: "Streambox",
    amount: { amountCents: 1299, currency: "USD" },
    cadence: "MONTHLY",
    status: "ACTIVE",
    evidenceIds: ["ev-1"],
  };

  assert.deepEqual(annualSubscriptionCost(subscription), {
    amountCents: 15_588,
    currency: "USD",
  });
});

test("ranks cards by verified category reward", () => {
  const cards: UserCard[] = [
    {
      id: "card-1",
      productName: "Everyday 2%",
      issuer: "Example",
      network: "VISA",
      rewardRules: [{ id: "r1", category: "*", rateBasisPoints: 200, evidenceIds: [] }],
    },
    {
      id: "card-2",
      productName: "Groceries 4%",
      issuer: "Example",
      network: "MASTERCARD",
      rewardRules: [{ id: "r2", category: "groceries", rateBasisPoints: 400, evidenceIds: [] }],
    },
  ];

  assert.equal(rankCards(cards, 10_000, "groceries")[0]?.card.id, "card-2");
  assert.equal(rankCards(cards, 10_000, "groceries")[0]?.rewardCents, 400);
});
