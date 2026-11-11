import type {
  Money,
  Offer,
  Recommendation,
  Subscription,
  UserCard,
} from "@pop/contracts";

const CADENCE_MULTIPLIERS: Record<Subscription["cadence"], number | null> = {
  WEEKLY: 52,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
  UNKNOWN: null,
};

export function assertCents(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Money must be a non-negative integer number of cents");
  }
  return value;
}

export function money(amountCents: number): Money {
  return { amountCents: assertCents(amountCents), currency: "USD" };
}

export function annualSubscriptionCost(subscription: Subscription): Money | null {
  const multiplier = CADENCE_MULTIPLIERS[subscription.cadence];
  if (multiplier === null) return null;
  return money(subscription.amount.amountCents * multiplier);
}

export function priceDropCents(offer: Offer): number {
  if (!offer.previousPrice) return 0;
  return Math.max(0, offer.previousPrice.amountCents - offer.currentPrice.amountCents);
}

export type CardRewardResult = {
  card: UserCard;
  rewardCents: number;
  ruleId: string;
};

export function rankCards(
  cards: UserCard[],
  purchaseCents: number,
  category: string,
  now = new Date(),
): CardRewardResult[] {
  assertCents(purchaseCents);
  const normalizedCategory = category.trim().toLowerCase();

  return cards
    .flatMap((card) =>
      card.rewardRules
        .filter((rule) => {
          const categoryMatches =
            rule.category.toLowerCase() === normalizedCategory || rule.category === "*";
          const isCurrent = !rule.validThrough || new Date(rule.validThrough) >= now;
          return categoryMatches && isCurrent;
        })
        .map((rule) => {
          const uncapped = Math.floor((purchaseCents * rule.rateBasisPoints) / 10_000);
          const rewardCents = rule.capCents ? Math.min(uncapped, rule.capCents) : uncapped;
          return { card, rewardCents, ruleId: rule.id };
        }),
    )
    .sort((left, right) => right.rewardCents - left.rewardCents);
}

export function buildRecommendations(input: {
  subscriptions: Subscription[];
  offers: Offer[];
  cards: UserCard[];
  now?: Date;
}): Recommendation[] {
  const now = input.now ?? new Date();
  const recommendations: Recommendation[] = [];

  for (const subscription of input.subscriptions) {
    if (!['ACTIVE', 'TRIAL', 'POSSIBLE'].includes(subscription.status)) continue;
    const annualCost = annualSubscriptionCost(subscription);
    if (!annualCost) continue;
    recommendations.push({
      id: `cancel-${subscription.id}`,
      type: "CANCEL_SUBSCRIPTION",
      title: `Review ${subscription.merchantName} before the next renewal`,
      explanation: `PoP found a recurring ${subscription.cadence.toLowerCase()} charge. Cancelling would avoid an estimated annual cost of $${(annualCost.amountCents / 100).toFixed(2)}.`,
      estimatedSavings: annualCost,
      confidence: subscription.status === "ACTIVE" ? 0.93 : 0.72,
      assumptions: ["The recurring amount and cadence remain unchanged."],
      evidenceIds: subscription.evidenceIds,
      expiresAt: subscription.nextRenewalAt,
      actionLabel: "Review cancellation",
      actionHref: "/subscriptions",
      userConfirmationRequired: true,
    });
  }

  for (const offer of input.offers) {
    if (offer.status === "EXPIRED") continue;
    const drop = priceDropCents(offer);
    if (drop <= 0) continue;
    const bestCard = rankCards(input.cards, offer.currentPrice.amountCents, offer.merchant.category, now)[0];
    const cardReward = bestCard?.rewardCents ?? 0;
    recommendations.push({
      id: `offer-${offer.id}`,
      type: "BUY_NOW",
      title: `${offer.title} is down $${(drop / 100).toFixed(2)}`,
      explanation: bestCard
        ? `The observed price is lower and ${bestCard.card.productName} adds about $${(cardReward / 100).toFixed(2)} in rewards.`
        : "The current observed price is lower than the previous verified price.",
      estimatedSavings: money(drop + cardReward),
      confidence: offer.evidenceIds.length > 0 ? 0.9 : 0.6,
      assumptions: [
        offer.shipping ? "Known shipping is included." : "Shipping and taxes may change the final total.",
      ],
      evidenceIds: [
        ...offer.evidenceIds,
        ...(bestCard ? bestCard.card.rewardRules.find((rule) => rule.id === bestCard.ruleId)?.evidenceIds ?? [] : []),
      ],
      expiresAt: offer.validThrough,
      actionLabel: "Inspect deal",
      actionHref: "/watchlist",
      userConfirmationRequired: true,
    });
  }

  return recommendations.sort(
    (left, right) => right.estimatedSavings.amountCents - left.estimatedSavings.amountCents,
  );
}
