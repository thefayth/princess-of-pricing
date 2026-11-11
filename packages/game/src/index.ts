import type { DashboardData } from "@pop/contracts";

export type KingdomDistrictId = "market" | "station" | "arcade" | "palace" | "nearby";

export type KingdomDistrict = {
  id: KingdomDistrictId;
  label: string;
  href: string;
  count: number;
  countLabel: string;
  detail: string;
  status: "active" | "quiet" | "attention";
};

export type KingdomQuest = {
  id: string;
  kind: "renewal" | "offer" | "duplicate" | "promo" | "evidence";
  title: string;
  detail: string;
  href: string;
  priority: number;
  deadline?: string;
};

export type KingdomDeadline = {
  date?: string;
  daysRemaining?: number;
  label: string;
  urgency: "none" | "soon" | "urgent" | "expired";
};

function daysUntil(value: string, now: Date) {
  return Math.ceil((Date.parse(value) - now.getTime()) / 86_400_000);
}

export function deriveKingdomDeadline(
  item: { validThrough?: string; nextRenewalAt?: string; expiresAt?: string },
  now = new Date(),
): KingdomDeadline {
  const date = item.expiresAt ?? item.validThrough ?? item.nextRenewalAt;
  if (!date || !Number.isFinite(Date.parse(date))) return { label: "No deadline", urgency: "none" };
  const daysRemaining = daysUntil(date, now);
  if (Date.parse(date) < now.getTime()) return { date, daysRemaining, label: "Expired", urgency: "expired" };
  if (daysRemaining === 0) return { date, daysRemaining, label: "Today", urgency: "urgent" };
  if (daysRemaining === 1) return { date, daysRemaining, label: "Tomorrow", urgency: "urgent" };
  if (daysRemaining <= 3) return { date, daysRemaining, label: `${daysRemaining} days`, urgency: "soon" };
  return { date, daysRemaining, label: `${daysRemaining} days`, urgency: "none" };
}

export function deriveKingdomDistricts(data: DashboardData): KingdomDistrict[] {
  const activeWatches = data.watches.filter((watch) => watch.status !== "PAUSED");
  const targetHits = data.watches.filter((watch) => watch.status === "TARGET_HIT").length;
  const activeSubscriptions = data.subscriptions.filter((subscription) => subscription.status === "ACTIVE" || subscription.status === "TRIAL");
  const duplicates = data.subscriptionRadar?.duplicateCandidates.filter((candidate) => !["KEPT", "CANCELLED"].includes(candidate.status)).length ?? 0;
  const promoCandidates = (data.subscriptionRadar?.dealOffers.length ?? 0) + data.offers.filter((offer) => offer.status === "ACTIVE" || offer.status === "EXPIRING").length;
  const nearbyOffers = data.offers.filter((offer) => offer.status !== "EXPIRED").length;
  const gameStops = data.pointsPalace.gameStops.filter((stop) => stop.status !== "NO_CURRENT_EVENT").length;

  return [
    {
      id: "market",
      label: "Price Watch Market",
      href: "/watchlist",
      count: activeWatches.length,
      countLabel: activeWatches.length === 1 ? "active watch" : "active watches",
      detail: targetHits > 0 ? `${targetHits} target ${targetHits === 1 ? "hit" : "hits"}` : "Watching for your target",
      status: targetHits > 0 ? "attention" : activeWatches.length > 0 ? "active" : "quiet",
    },
    {
      id: "station",
      label: "Subscription Station",
      href: "/subscriptions",
      count: activeSubscriptions.length,
      countLabel: activeSubscriptions.length === 1 ? "active service" : "active services",
      detail: duplicates > 0 ? `${duplicates} duplicate ${duplicates === 1 ? "candidate" : "candidates"}` : "No duplicate signals",
      status: duplicates > 0 ? "attention" : activeSubscriptions.length > 0 ? "active" : "quiet",
    },
    {
      id: "arcade",
      label: "Promo Code Arcade",
      href: "/subscriptions#promo-code-arcade",
      count: promoCandidates,
      countLabel: promoCandidates === 1 ? "deal candidate" : "deal candidates",
      detail: promoCandidates > 0 ? "Review verified paths" : "No current promo signals",
      status: promoCandidates > 0 ? "active" : "quiet",
    },
    {
      id: "palace",
      label: "Points Palace",
      href: "/wallet",
      count: data.pointsPalace.progress.totalPoints,
      countLabel: "PoP progress points",
      detail: `${data.pointsPalace.accounts.filter((account) => account.kind === "LOYALTY_POINTS").length} loyalty accounts tracked`,
      status: data.pointsPalace.progress.totalPoints > 0 ? "active" : "quiet",
    },
    {
      id: "nearby",
      label: "Nearby Deals",
      href: "/nearby",
      count: nearbyOffers + gameStops,
      countLabel: "nearby signals",
      detail: gameStops > 0 ? `${gameStops} PoP Game Stop ${gameStops === 1 ? "event" : "events"}` : "Foreground location is off",
      status: nearbyOffers + gameStops > 0 ? "active" : "quiet",
    },
  ];
}

export function deriveUrgentQuests(data: DashboardData, now = new Date()): KingdomQuest[] {
  const quests: KingdomQuest[] = [];
  for (const subscription of data.subscriptions) {
    const deadline = deriveKingdomDeadline({ nextRenewalAt: subscription.nextRenewalAt }, now);
    if (deadline.daysRemaining !== undefined && deadline.daysRemaining >= 0 && deadline.daysRemaining <= 3) {
      quests.push({ id: `renewal-${subscription.id}`, kind: "renewal", title: `Review ${subscription.merchantName}`, detail: `Renews ${deadline.label.toLowerCase()} · ${subscription.cadence.toLowerCase()}`, href: "/subscriptions", priority: deadline.daysRemaining, deadline: subscription.nextRenewalAt });
    }
  }
  for (const candidate of data.subscriptionRadar?.duplicateCandidates ?? []) {
    if (!["KEPT", "CANCELLED"].includes(candidate.status)) {
      quests.push({ id: `duplicate-${candidate.id}`, kind: "duplicate", title: `Resolve ${candidate.serviceKey} duplicate`, detail: candidate.reasons[0] ?? "Review the matching charges", href: "/subscriptions", priority: 4 });
    }
  }
  for (const offer of data.offers) {
    const deadline = deriveKingdomDeadline({ validThrough: offer.validThrough }, now);
    if (offer.status === "EXPIRING" || (deadline.daysRemaining !== undefined && deadline.daysRemaining >= 0 && deadline.daysRemaining <= 3)) {
      quests.push({ id: `offer-${offer.id}`, kind: "offer", title: `Check ${offer.title}`, detail: `${offer.merchant.name} · ${deadline.label.toLowerCase()}`, href: "/watchlist", priority: 7 + (deadline.daysRemaining ?? 3), deadline: offer.validThrough });
    }
  }
  for (const offer of data.subscriptionRadar?.dealOffers ?? []) {
    if (offer.status === "ACTIVE" || offer.status === "EXPIRING") {
      quests.push({ id: `promo-${offer.id}`, kind: "promo", title: `Review ${offer.serviceName} offer`, detail: `${offer.eligibility.replaceAll("_", " ").toLowerCase()} · evidence-backed`, href: "/subscriptions#promo-code-arcade", priority: offer.status === "EXPIRING" ? 6 : 9, deadline: offer.validThrough });
    }
  }
  const unreadEvidence = data.notifications.filter((notification) => !notification.read && (notification.severity === "URGENT" || notification.severity === "OPPORTUNITY"));
  if (unreadEvidence.length > 0) {
    quests.push({ id: "evidence-review", kind: "evidence", title: "Review new evidence", detail: `${unreadEvidence.length} ${unreadEvidence.length === 1 ? "signal" : "signals"} are waiting`, href: "/evidence", priority: 5 });
  }
  return quests.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title)).slice(0, 6);
}

export function deriveKingdomProgress(data: DashboardData) {
  const { level, totalPoints, nextLevelPoints } = data.pointsPalace.progress;
  const floor = Math.max(0, nextLevelPoints - 250);
  const percent = Math.max(0, Math.min(100, ((totalPoints - floor) / Math.max(1, nextLevelPoints - floor)) * 100));
  return { level, totalPoints, nextLevelPoints, percent, label: `Level ${level}` };
}
