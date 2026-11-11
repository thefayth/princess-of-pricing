"use client";

import type {
  CancellationTask,
  DashboardData,
  Evidence,
  GameStop,
  GameStopEvent,
  GameStopSession,
  Money,
  Recommendation,
} from "@pop/contracts";
import {
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  CircleDot,
  Clock3,
  Coins,
  Eye,
  EyeOff,
  FileCheck2,
  Gauge,
  House,
  Link2,
  ListChecks,
  LocateFixed,
  Landmark,
  MapPin,
  MapPinned,
  Menu,
  Pause,
  Palette,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  Trophy,
  Unplug,
  WalletCards,
  Watch,
  X,
} from "lucide-react";
import { coarseAreaKey, distanceMeters } from "@pop/domain";
import { KingdomHome } from "./kingdom-home.js";
import { POP_THEMES, THEME_STORAGE_KEY, AVATAR_STORAGE_KEY, parsePopTheme, themePortrait, type PopTheme } from "./themes.js";
import { useEffect, useMemo, useState } from "react";

export type PopSection =
  | "home"
  | "watchlist"
  | "subscriptions"
  | "wallet"
  | "nearby"
  | "evidence"
  | "connections"
  | "settings";

type NavItem = {
  id: PopSection;
  label: string;
  href: string;
  icon: typeof Gauge;
};

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Kingdom", href: "/", icon: MapPinned },
  { id: "watchlist", label: "Watchlist", href: "/watchlist", icon: Watch },
  { id: "subscriptions", label: "Subscriptions", href: "/subscriptions", icon: ListChecks },
  { id: "wallet", label: "Points Palace", href: "/wallet", icon: Landmark },
  { id: "nearby", label: "Nearby", href: "/nearby", icon: MapPin },
  { id: "evidence", label: "Evidence", href: "/evidence", icon: FileCheck2 },
  { id: "connections", label: "Connections", href: "/connections", icon: Link2 },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

function formatMoney(value: Money) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: value.currency,
  }).format(value.amountCents / 100);
}

function formatTime(value?: string) {
  if (!value) return "Not known";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function mapStopPosition(stop: GameStop, stops: GameStop[]) {
  const latitudes = stops.map((item) => item.latitude);
  const longitudes = stops.map((item) => item.longitude);
  const minLatitude = Math.min(...latitudes, stop.latitude);
  const maxLatitude = Math.max(...latitudes, stop.latitude);
  const minLongitude = Math.min(...longitudes, stop.longitude);
  const maxLongitude = Math.max(...longitudes, stop.longitude);
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.01);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.01);
  const left = 12 + ((stop.longitude - minLongitude) / longitudeSpan) * 76;
  const top = 18 + (1 - (stop.latitude - minLatitude) / latitudeSpan) * 60;
  return { left: `${Math.min(88, Math.max(12, left))}%`, top: `${Math.min(78, Math.max(18, top))}%` };
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function cookieValue(name: string) {
  if (typeof document === "undefined") return "";
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

async function popMutation<T>(path: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
      "x-pop-csrf": decodeURIComponent(cookieValue("pop_csrf")),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as ({ message?: string; error?: string } & T) | null;
  if (!response.ok) throw new Error(payload?.message ?? payload?.error ?? `Request failed (${response.status})`);
  return payload as T;
}

type EntryMode = "watch" | "subscription" | "card" | "fad";

function cents(value: FormDataEntryValue | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a non-negative dollar amount.");
  return Math.round(amount * 100);
}

function EntryDialog({ mode, workspaceId, onClose }: { mode: EntryMode; workspaceId: string; onClose: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const labels: Record<EntryMode, string> = { watch: "Add price watch", subscription: "Add subscription", card: "Add card", fad: "Import FAD export" };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "watch") await popMutation(`/api/pop/workspaces/${encodeURIComponent(workspaceId)}/pop/watches`, "POST", { title: form.get("title"), merchantName: form.get("merchant"), targetPriceCents: cents(form.get("target")), currentPriceCents: form.get("current") ? cents(form.get("current")) : undefined, currency: "USD" });
      if (mode === "subscription") await popMutation(`/api/pop/workspaces/${encodeURIComponent(workspaceId)}/pop/subscriptions`, "POST", { merchantName: form.get("merchant"), planName: form.get("plan") || undefined, amountCents: cents(form.get("amount")), cadence: form.get("cadence"), nextRenewalAt: form.get("renewal") || undefined, currency: "USD", sourceKind: "MANUAL" });
      if (mode === "card") await popMutation(`/api/pop/workspaces/${encodeURIComponent(workspaceId)}/pop/cards`, "POST", { issuer: form.get("issuer"), productName: form.get("product"), network: form.get("network"), lastFour: form.get("lastFour") || undefined, annualFeeCents: form.get("annualFee") ? cents(form.get("annualFee")) : 0, currency: "USD", rewardRules: form.get("rate") ? [{ category: form.get("category") || "*", rateBasisPoints: Math.round(Number(form.get("rate")) * 100) }] : [] });
      if (mode === "fad") await popMutation(`/api/pop/workspaces/${encodeURIComponent(workspaceId)}/pop/imports/fad`, "POST", { payload: JSON.parse(String(form.get("payload"))) });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PoP could not save that record.");
      setSaving(false);
    }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="detail-dialog entry-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-dialog-title"><button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button><h2 id="entry-dialog-title">{labels[mode]}</h2><form className="entry-form" onSubmit={submit}>
    {mode === "watch" ? <><label>Product<input name="title" required maxLength={240} /></label><label>Merchant<input name="merchant" required maxLength={160} /></label><label>Target price<input name="target" inputMode="decimal" required /></label><label>Current observed price<input name="current" inputMode="decimal" /></label></> : null}
    {mode === "subscription" ? <><label>Merchant<input name="merchant" required maxLength={160} /></label><label>Plan<input name="plan" maxLength={160} /></label><label>Charge<input name="amount" inputMode="decimal" required /></label><label>Cadence<select name="cadence" defaultValue="MONTHLY"><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUAL">Annual</option><option value="UNKNOWN">Unknown</option></select></label><label>Next renewal<input name="renewal" type="date" /></label></> : null}
    {mode === "card" ? <><label>Issuer<input name="issuer" required maxLength={160} /></label><label>Card product<input name="product" required maxLength={200} /></label><label>Network<select name="network" defaultValue="VISA"><option>VISA</option><option>MASTERCARD</option><option>AMEX</option><option>DISCOVER</option><option>OTHER</option></select></label><label>Last four digits<input name="lastFour" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} /></label><label>Annual fee<input name="annualFee" inputMode="decimal" /></label><label>Reward category<input name="category" placeholder="Groceries or *" /></label><label>Reward rate %<input name="rate" inputMode="decimal" /></label></> : null}
    {mode === "fad" ? <><p>Paste a normalized <code>pop-fad-export/v1</code> export. PoP imports subscription metadata only, then keeps the import receipt in Evidence.</p><label>Export JSON<textarea name="payload" required rows={12} spellCheck={false} /></label></> : null}
    {error ? <p className="live-error" role="alert">{error}</p> : null}<div className="entry-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving" : "Save"}</button></div>
  </form></section></div>;
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.85) return "High confidence";
  if (confidence >= 0.65) return "Medium confidence";
  return "Needs review";
}

function EvidenceLinks({ ids, evidence }: { ids: string[]; evidence: Evidence[] }) {
  const matched = evidence.filter((item) => ids.includes(item.id));
  if (matched.length === 0) return <span className="muted">No linked evidence</span>;
  return (
    <span className="evidence-links">
      <FileCheck2 size={14} aria-hidden="true" />
      {matched.length} verified {matched.length === 1 ? "source" : "sources"}
    </span>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function RecommendationRow({
  recommendation,
  evidence,
  onOpen,
}: {
  recommendation: Recommendation;
  evidence: Evidence[];
  onOpen: (recommendation: Recommendation) => void;
}) {
  return (
    <button className="recommendation-row" type="button" onClick={() => onOpen(recommendation)}>
      <span className="recommendation-icon" aria-hidden="true">
        <Sparkles size={18} />
      </span>
      <span className="recommendation-copy">
        <strong>{recommendation.title}</strong>
        <span>{recommendation.explanation}</span>
        <span className="row-meta">
          <EvidenceLinks ids={recommendation.evidenceIds} evidence={evidence} />
          <span>{confidenceLabel(recommendation.confidence)}</span>
        </span>
      </span>
      <span className="recommendation-value">
        <strong>{formatMoney(recommendation.estimatedSavings)}</strong>
        <span>possible savings</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

function HomeView({ data, onOpen, assetBase }: { data: DashboardData; onOpen: (item: Recommendation) => void; assetBase: string }) {
  const nextMove = data.recommendations[0];
  const totalSavings = data.recommendations.reduce(
    (total, item) => total + item.estimatedSavings.amountCents,
    0,
  );

  return (
    <>
      {nextMove ? (
        <section className="next-move" aria-labelledby="next-move-title">
          <div className="next-move-copy">
            <div className="section-kicker"><Sparkles size={16} /> Next best money move</div>
            <h1 id="next-move-title">{nextMove.title}</h1>
            <p>{nextMove.explanation}</p>
            <div className="next-move-meta">
              <StatusPill tone="teal">{confidenceLabel(nextMove.confidence)}</StatusPill>
              <EvidenceLinks ids={nextMove.evidenceIds} evidence={data.evidence} />
              {nextMove.expiresAt ? <span>Act before {formatTime(nextMove.expiresAt)}</span> : null}
            </div>
            <button className="primary-button" type="button" onClick={() => onOpen(nextMove)}>
              {nextMove.actionLabel}<ChevronRight size={17} />
            </button>
          </div>
          <div className="next-move-figure">
            <img src={`${assetBase}/pop-avatar.png`} alt="PoP, the savings strategist, checking a verified price alert" />
            <div className="savings-stamp">
              <span>Potential annual savings</span>
              <strong>{formatMoney({ amountCents: totalSavings, currency: "USD" })}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <section className="metric-band" aria-label="Savings overview">
        <div><span>Watched prices</span><strong>{data.watches.length}</strong></div>
        <div><span>Target prices hit</span><strong>{data.watches.filter((item) => item.status === "TARGET_HIT").length}</strong></div>
        <div><span>Active subscriptions</span><strong>{data.subscriptions.filter((item) => item.status === "ACTIVE").length}</strong></div>
        <div><span>Points Palace</span><strong>Level {data.pointsPalace.progress.level}</strong></div>
      </section>

      <nav className="district-strip" aria-label="Savings Kingdom districts">
        <a href="/watchlist"><Watch size={18} /><span><strong>Price Watch Market</strong><small>{data.watches.length} active watches</small></span></a>
        <a href="/subscriptions"><ListChecks size={18} /><span><strong>Subscription Station</strong><small>{data.subscriptions.length} recurring services</small></span></a>
        <a href="/wallet" className="district-featured"><Landmark size={18} /><span><strong>Points Palace</strong><small>{formatPoints(data.pointsPalace.progress.totalPoints)} progress saved</small></span></a>
        <a href="/nearby"><MapPinned size={18} /><span><strong>PoP Game Stops</strong><small>{data.pointsPalace.gameStops.length} available nearby</small></span></a>
      </nav>

      <section className="content-section" aria-labelledby="moves-title">
        <div className="section-heading">
          <div><span className="section-kicker">Today</span><h2 id="moves-title">Money moves worth your attention</h2></div>
          <a href="/evidence" className="text-link">Open evidence ledger <ChevronRight size={16} /></a>
        </div>
        <div className="recommendation-list">
          {data.recommendations.slice(1, 4).map((item) => (
            <RecommendationRow key={item.id} recommendation={item} evidence={data.evidence} onOpen={onOpen} />
          ))}
        </div>
      </section>

      <section className="split-section">
        <div className="content-section compact-section">
          <div className="section-heading"><div><span className="section-kicker">Expiring</span><h2>Deals with a clock</h2></div></div>
          <div className="compact-list">
            {data.offers.filter((offer) => offer.validThrough).slice(0, 3).map((offer) => (
              <div className="compact-row" key={offer.id}>
                <span className="merchant-mark"><Tag size={17} /></span>
                <div><strong>{offer.title}</strong><span>{offer.merchant.name} · ends {formatTime(offer.validThrough)}</span></div>
                <strong>{formatMoney(offer.currentPrice)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="content-section compact-section">
          <div className="section-heading"><div><span className="section-kicker">Renewals</span><h2>Subscriptions approaching</h2></div></div>
          <div className="compact-list">
            {data.subscriptions.slice(0, 3).map((subscription) => (
              <div className="compact-row" key={subscription.id}>
                <span className="merchant-mark"><ReceiptText size={17} /></span>
                <div><strong>{subscription.merchantName}</strong><span>renews {formatTime(subscription.nextRenewalAt)}</span></div>
                <strong>{formatMoney(subscription.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function WatchlistView({ data, onAdd }: { data: DashboardData; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const watches = data.watches.filter((item) =>
    `${item.title} ${item.merchantName}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="content-section page-section">
      <div className="page-title-row">
        <div><span className="section-kicker">Price truth</span><h1>Watchlist</h1><p>Only verified observations move these prices.</p></div>
        <button className="primary-button" type="button" onClick={onAdd}><Plus size={17} /> Add a watch</button>
      </div>
      <label className="search-field"><Search size={17} /><span className="sr-only">Search watches</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or merchants" /></label>
      <div className="data-table" role="table" aria-label="Price watches">
        <div className="table-row table-head" role="row"><span>Watch</span><span>Target</span><span>Current</span><span>Status</span><span>Checked</span></div>
        {watches.map((watch) => (
          <div className="table-row" role="row" key={watch.id}>
            <span><strong>{watch.title}</strong><small>{watch.merchantName}</small></span>
            <span>{formatMoney(watch.targetPrice)}</span>
            <span>{watch.currentPrice ? formatMoney(watch.currentPrice) : "Waiting"}</span>
            <span><StatusPill tone={watch.status === "TARGET_HIT" ? "teal" : "neutral"}>{watch.status === "TARGET_HIT" ? "Target hit" : "Watching"}</StatusPill></span>
            <span>{formatTime(watch.lastCheckedAt)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SubscriptionsView({ data, onTask, onAdd, onImport }: { data: DashboardData; onTask: (task: CancellationTask) => void; onAdd: () => void; onImport: () => void }) {
  const radar = data.subscriptionRadar;
  return (
    <section className="content-section page-section">
      <div className="page-title-row"><div><span className="section-kicker">Subscription escape</span><h1>Subscriptions</h1><p>Review recurring charges, current deals, and duplicate services before money leaves.</p></div><div className="entry-toolbar"><button className="secondary-button" type="button" onClick={onImport}>Import FAD</button><button className="primary-button" type="button" onClick={onAdd}><Plus size={17} /> Add subscription</button></div></div>
      {radar ? (
        <>
          <div className="radar-summary" aria-label="Subscription radar summary">
            <div><span>Deal alerts</span><strong>{radar.dealOffers.length}</strong><small>current observations</small></div>
            <div><span>Duplicate candidates</span><strong>{radar.duplicateCandidates.filter((item) => item.status !== "KEPT" && item.status !== "CANCELLED").length}</strong><small>need a decision</small></div>
            <div><span>Automation</span><strong>{radar.automationPolicy?.autoCancelExactDuplicates ? "Exact only" : "Off"}</strong><small>{radar.automationPolicy?.enabled ? "policy enabled" : "review first"}</small></div>
          </div>
          <div className="subscription-radar-grid">
            <div className="radar-panel">
              <div className="section-heading"><div><span className="section-kicker">Music & services</span><h2>Better ways to renew</h2></div><span className="muted">Daily refresh</span></div>
              <div className="radar-offer-list">
                {radar.dealOffers.map((offer) => (
                  <article className="radar-offer" key={offer.id}>
                    <div className="radar-offer-top"><strong>{offer.serviceName}</strong><StatusPill tone={offer.eligibility === "RETURNING_ONLY" ? "teal" : "saffron"}>{offer.eligibility.replace(/_/g, " ")}</StatusPill></div>
                    <h3>{offer.title}</h3>
                    <p>{offer.planName} · {offer.trialDays ? `${Math.round(offer.trialDays / 30)} month trial` : `${formatMoney(offer.price)} upfront`} · {offer.verification === "ELIGIBILITY_UNCONFIRMED" ? "eligibility still needs checking" : "source checked"}</p>
                    <div className="radar-offer-bottom"><span><EvidenceLinks ids={offer.evidenceIds} evidence={data.evidence} /></span><a href={offer.sourceUrl} target="_blank" rel="noreferrer">Open source <ChevronRight size={14} /></a></div>
                  </article>
                ))}
              </div>
            </div>
            <div className="radar-panel">
              <div className="section-heading"><div><span className="section-kicker">Duplicate watch</span><h2>Subscriptions PoP can remove</h2></div></div>
              <div className="duplicate-list">
                {radar.duplicateCandidates.map((candidate) => (
                  <div className="duplicate-row" key={candidate.id}><span className="merchant-mark"><Unplug size={17} /></span><div><strong>{candidate.serviceKey}</strong><span>{candidate.reasons[0]}</span></div><StatusPill tone={candidate.status === "AUTO_CANCEL_ELIGIBLE" ? "teal" : "saffron"}>{candidate.status.replace(/_/g, " ")}</StatusPill></div>
                ))}
              </div>
              <div className="policy-strip"><ShieldCheck size={17} /><div><strong>{radar.automationPolicy?.autoCancelExactDuplicates ? "Exact duplicates can be cancelled automatically" : "Automatic cancellation is off"}</strong><span>Family, bundle, annual, prepaid, and recently used services stay protected.</span></div><button className="table-action" type="button">Edit policy <ChevronRight size={15} /></button></div>
            </div>
          </div>
        </>
      ) : null}
      <div className="data-table subscriptions-table" role="table" aria-label="Subscriptions">
        <div className="table-row table-head" role="row"><span>Merchant</span><span>Charge</span><span>Renewal</span><span>Evidence</span><span>Action</span></div>
        {data.subscriptions.map((subscription) => {
          const task = data.cancellationTasks.find((candidate) => candidate.subscriptionId === subscription.id);
          return (
            <div className="table-row" role="row" key={subscription.id}>
              <span><strong>{subscription.merchantName}</strong><small>{subscription.cadence.toLowerCase()}</small></span>
              <span>{formatMoney(subscription.amount)}</span>
              <span>{formatTime(subscription.nextRenewalAt)}</span>
              <span><EvidenceLinks ids={subscription.evidenceIds} evidence={data.evidence} /></span>
              <span>{task ? <button className="table-action" type="button" onClick={() => onTask(task)}>Review <ChevronRight size={15} /></button> : <button className="table-action" type="button">Create task</button>}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WalletView({ data, onAddCard }: { data: DashboardData; onAddCard: () => void }) {
  const palace = data.pointsPalace;
  const [tab, setTab] = useState<"register" | "cards" | "goals">("register");
  const [windowDays, setWindowDays] = useState<30 | 90 | 365>(30);
  const windowStart = Date.now() - windowDays * 86_400_000;
  const register = palace.register.filter((entry) => Date.parse(entry.occurredAt) >= windowStart);
  const loyaltyAccounts = palace.accounts.filter((account) => account.kind === "LOYALTY_POINTS");
  const levelFloor = (palace.progress.level - 1) * 250;
  const levelProgress = Math.max(0, Math.min(100, ((palace.progress.totalPoints - levelFloor) / Math.max(1, palace.progress.nextLevelPoints - levelFloor)) * 100));

  return (
    <section className="content-section page-section palace-page">
      <div className="page-title-row"><div><span className="section-kicker"><Landmark size={15} /> Savings Kingdom</span><h1>Points Palace</h1><p>Match the spending you already do to verified rewards, then preserve every result in the register.</p></div><button className="primary-button" type="button" onClick={onAddCard}><Plus size={17} /> Add card</button></div>

      <div className="palace-hero">
        <div className="palace-level"><Trophy size={26} /><span>Palace level</span><strong>{palace.progress.level}</strong></div>
        <div className="palace-progress"><div><span>PoP progress</span><strong>{formatPoints(palace.progress.totalPoints)} / {formatPoints(palace.progress.nextLevelPoints)}</strong></div><progress max="100" value={levelProgress} aria-label={`${Math.round(levelProgress)} percent toward the next Points Palace level`} /><small>Progress comes from confirmed learning and savings actions, never spending volume.</small></div>
        <div className="palace-value"><span>Conservative point value</span><strong>{formatMoney(palace.progress.estimatedCashValue)}</strong><small>{formatPoints(palace.progress.confirmedLoyaltyPoints)} real loyalty points tracked separately</small></div>
      </div>

      <div className="points-separation"><ShieldCheck size={18} /><div><strong>Two ledgers, no blurred value</strong><span>Real loyalty balances can be valued. PoP progress has no cash value and cannot be transferred or redeemed.</span></div></div>

      <div className="palace-tabs" role="tablist" aria-label="Points Palace views">
        <button type="button" role="tab" aria-selected={tab === "register"} onClick={() => setTab("register")}><ReceiptText size={16} /> Register</button>
        <button type="button" role="tab" aria-selected={tab === "cards"} onClick={() => setTab("cards")}><WalletCards size={16} /> Best card</button>
        <button type="button" role="tab" aria-selected={tab === "goals"} onClick={() => setTab("goals")}><Target size={16} /> Goals</button>
      </div>

      {tab === "register" ? <>
        <div className="points-account-grid">
          {loyaltyAccounts.map((account) => (
            <article className="points-account" key={account.id}><div><Coins size={18} /><span>{account.programKey}</span></div><h2>{account.name}</h2><strong>{formatPoints(account.balance)}</strong><small>{account.lastEarnedAt ? `Last earned ${formatTime(account.lastEarnedAt)}` : "No confirmed earning yet"}</small></article>
          ))}
        </div>
        <div className="register-toolbar"><div><span className="section-kicker">Saved progress</span><h2>Points Register</h2></div><div className="segmented-control" aria-label="Register window">{([30, 90, 365] as const).map((days) => <button type="button" key={days} aria-pressed={windowDays === days} onClick={() => setWindowDays(days)}>{days === 365 ? "1 year" : `${days} days`}</button>)}</div></div>
        <div className="points-register" role="table" aria-label="Points Register">
          <div className="points-register-row points-register-head" role="row"><span>Activity</span><span>Points</span><span>Status</span><span>When</span></div>
          {register.map((entry) => <div className="points-register-row" role="row" key={entry.id}>
            <span><strong>{entry.label}</strong><small>{[entry.merchantName, entry.category, entry.city].filter(Boolean).join(" · ") || (entry.balanceKind === "POP_PROGRESS" ? "PoP progress" : "Loyalty activity")}</small></span>
            <span className={entry.pointsDelta < 0 ? "points-negative" : "points-positive"}>{entry.pointsDelta > 0 ? "+" : ""}{formatPoints(entry.pointsDelta)}<small>{entry.balanceKind === "POP_PROGRESS" ? "PoP progress" : "loyalty points"}</small></span>
            <span><StatusPill tone={entry.status === "CONFIRMED" ? "teal" : entry.status === "ESTIMATED" ? "saffron" : "neutral"}>{entry.type === "MISSED_ESTIMATE" ? "Possible missed" : entry.status}</StatusPill></span>
            <span>{formatTime(entry.occurredAt)}</span>
          </div>)}
          {register.length === 0 ? <p className="empty-state">No register activity falls inside this window.</p> : null}
        </div>
        <div className="recency-section"><div className="section-heading"><div><span className="section-kicker">Earning rhythm</span><h2>Where points have been active</h2></div></div><div className="recency-grid">{palace.recency.slice(0, 9).map((item) => <div key={item.key} className={`recency-item recency-${item.status.toLowerCase()}`}><CircleDot size={16} /><span><strong>{item.label}</strong><small>{item.status === "RECENT" ? `Earned ${item.daysSince} days ago` : `Quiet for ${item.daysSince} days`}</small></span></div>)}</div></div>
      </> : null}

      {tab === "cards" ? <>
        <div className="card-grid">
          {data.cards.map((card, index) => (
            <article className={`wallet-card wallet-card-${index % 3}`} key={card.id}><div className="wallet-card-top"><WalletCards size={24} /><span>{card.network}</span></div><div><span>{card.issuer}</span><h2>{card.productName}</h2></div><div className="wallet-card-bottom"><span>•••• {card.lastFour ?? "not stored"}</span><span>{Math.max(0, ...card.rewardRules.map((rule) => rule.rateBasisPoints)) / 100}% max</span></div></article>
          ))}
        </div>
        <div className="rule-list"><div className="section-heading"><div><span className="section-kicker">Verified rules</span><h2>Current reward opportunities</h2></div></div>{data.cards.flatMap((card) => card.rewardRules.map((rule) => ({ card, rule }))).map(({ card, rule }) => <div className="rule-row" key={rule.id}><span className="merchant-mark"><CircleDollarSign size={17} /></span><div><strong>{card.productName}</strong><span>{rule.category === "*" ? "All purchases" : rule.category}</span></div><strong>{rule.rateBasisPoints / 100}%</strong><EvidenceLinks ids={rule.evidenceIds} evidence={data.evidence} /></div>)}</div>
      </> : null}

      {tab === "goals" ? <div className="goal-list">{palace.goals.map((goal) => { const percent = Math.min(100, goal.target.amountCents ? goal.captured.amountCents / goal.target.amountCents * 100 : 0); return <article className="goal-row" key={goal.id}><Target size={21} /><div><span>{goal.kind.replaceAll("_", " ")}</span><h2>{goal.name}</h2><progress max="100" value={percent} /><small>{formatMoney(goal.captured)} captured toward {formatMoney(goal.target)}</small></div><StatusPill tone={goal.status === "ACTIVE" ? "teal" : "neutral"}>{goal.status}</StatusPill></article>; })}{palace.goals.length === 0 ? <p className="empty-state">Add a goal to tell PoP whether cash value, debt reduction, investing, a purchase, or travel matters most.</p> : null}</div> : null}
    </section>
  );
}

function NearbyView({ data }: { data: DashboardData }) {
  const palace = data.pointsPalace;
  const [locationState, setLocationState] = useState<"idle" | "loading" | "ready" | "denied" | "error">(palace.pointsMode.activeUntil ? "ready" : "idle");
  const [locationFix, setLocationFix] = useState<{ latitude: number; longitude: number; accuracy: number; area: string } | null>(null);
  const [activeUntil, setActiveUntil] = useState(palace.pointsMode.activeUntil);
  const [stops, setStops] = useState<GameStop[]>(palace.gameStops);
  const [atHomeEvents, setAtHomeEvents] = useState<GameStopEvent[]>(palace.atHomeEvents);
  const [session, setSession] = useState<GameStopSession | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(stops[0]?.id ?? null);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!activeUntil) { setRemainingSeconds(0); return; }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(activeUntil) - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) setLocationState("idle");
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [activeUntil]);

  async function activatePointsMode() {
    if (!navigator.geolocation) { setLocationState("denied"); return; }
    setLocationState("loading");
    setNotice("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const fix = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy), area: coarseAreaKey(position.coords.latitude, position.coords.longitude) };
      try {
        const result = await popMutation<{ pointsMode: DashboardData["pointsPalace"]["pointsMode"] }>(`/api/pop/workspaces/${encodeURIComponent(data.workspace.id)}/pop/points-mode`, "PUT", { enabled: true, cityWatchEnabled: palace.pointsMode.cityWatchEnabled, cityWatchCities: palace.pointsMode.cityWatchCities, version: palace.pointsMode.version });
        const response = await fetch(`/api/pop/workspaces/${encodeURIComponent(data.workspace.id)}/pop/game-stops?area=${encodeURIComponent(fix.area)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { stops?: GameStop[]; atHomeEvents?: GameStopEvent[]; message?: string } | null;
        if (!response.ok) throw new Error(payload?.message ?? "Nearby Game Stops could not be loaded");
        setLocationFix(fix);
        setStops(payload?.stops ?? []);
        setSelectedStopId(payload?.stops?.[0]?.id ?? null);
        setAtHomeEvents(payload?.atHomeEvents ?? palace.atHomeEvents);
        setActiveUntil(result.pointsMode.activeUntil);
        setLocationState("ready");
        setNotice((payload?.stops?.length ?? 0) > 0 ? "PoP found a Game Stop inside your temporary area." : "No physical Game Stop is active in this area. The at-home event is available.");
      } catch (error) {
        setLocationState("error");
        setNotice(error instanceof Error ? error.message : "Points Mode could not start");
      }
    }, () => setLocationState("denied"), { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });
  }

  async function deactivatePointsMode() {
    try {
      await popMutation(`/api/pop/workspaces/${encodeURIComponent(data.workspace.id)}/pop/points-mode`, "PUT", { enabled: false, cityWatchEnabled: palace.pointsMode.cityWatchEnabled, cityWatchCities: palace.pointsMode.cityWatchCities });
    } finally {
      setLocationFix(null);
      setActiveUntil(undefined);
      setLocationState("idle");
      setSession(null);
    }
  }

  async function startEvent(event: GameStopEvent, stop?: GameStop) {
    setNotice("");
    const atHome = event.atHome;
    if (!atHome && (!locationFix || !stop)) { setNotice("Turn on Points Mode near this stop before starting."); return; }
    const measuredDistance = !atHome && locationFix && stop ? distanceMeters(locationFix, stop) : undefined;
    try {
      const result = await popMutation<{ session: GameStopSession }>(`/api/pop/workspaces/${encodeURIComponent(data.workspace.id)}/pop/game-stops/${encodeURIComponent(stop?.id ?? "at-home")}/sessions`, "POST", { eventId: event.id, coarseArea: locationFix?.area, distanceMeters: measuredDistance, accuracyMeters: locationFix?.accuracy, timezoneOffsetMinutes: new Date().getTimezoneOffset(), atHome });
      setSession(result.session);
      setAnswer("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Game Stop event could not start");
    }
  }

  async function completeEvent() {
    if (!session || !answer) return;
    try {
      const result = await popMutation<{ award: { points: number } }>(`/api/pop/workspaces/${encodeURIComponent(data.workspace.id)}/pop/game-stop-sessions/${encodeURIComponent(session.id)}/complete`, "POST", { answer });
      setNotice(`Saved ${result.award.points} PoP progress points in the Points Register.`);
      setSession(null);
      setAnswer("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The event could not be completed");
    }
  }

  const modeMinutes = Math.ceil(remainingSeconds / 60);
  return (
    <section className="content-section page-section game-stops-page">
      <div className="page-title-row"><div><span className="section-kicker"><MapPinned size={15} /> Foreground only</span><h1>PoP Game Stops</h1><p>Complete quick, non-purchase money challenges nearby or choose the equal-value at-home route.</p></div>{locationState === "ready" && remainingSeconds > 0 ? <button className="secondary-button" type="button" onClick={() => void deactivatePointsMode()}><Pause size={17} /> End Points Mode</button> : <button className="primary-button" type="button" onClick={() => void activatePointsMode()} disabled={locationState === "loading"}><LocateFixed size={17} /> {locationState === "loading" ? "Locating" : "Start Points Mode"}</button>}</div>
      <div className={`location-banner location-${locationState}`} aria-live="polite"><MapPin size={20} /><div><strong>{locationState === "ready" && remainingSeconds > 0 ? `Points Mode active for ${modeMinutes} more ${modeMinutes === 1 ? "minute" : "minutes"}` : locationState === "denied" ? "Location was not shared" : locationState === "error" ? "Points Mode needs attention" : "Location stays off until you ask"}</strong><span>{locationState === "ready" ? "Exact coordinates remain on this device. PoP stores only a completed stop and coarse area." : "The at-home event remains available without location."}</span></div></div>
      {notice ? <div className="points-notice" role="status"><Bell size={17} />{notice}</div> : null}

      <div className="game-stop-summary"><div><MapPinned size={18} /><span><strong>{stops.length}</strong> nearby stops</span></div><div><Clock3 size={18} /><span><strong>10 min</strong> per challenge</span></div><div><Trophy size={18} /><span><strong>3 max</strong> each day</span></div><div><House size={18} /><span><strong>Equal</strong> at-home progress</span></div></div>

      <div className="section-heading"><div><span className="section-kicker">City beacons</span><h2>Available Game Stops</h2></div><span className="muted">One award per stop every seven days</span></div>
      <div className="game-stop-map" aria-label="PoP Game Stops beacon map" role="region">
        <div className="map-grid-lines" aria-hidden="true" />
        <div className="map-road map-road-one" aria-hidden="true" />
        <div className="map-road map-road-two" aria-hidden="true" />
        <div className="map-road map-road-three" aria-hidden="true" />
        <div className="map-zone map-zone-one" aria-hidden="true">PALACE DISTRICT</div>
        <div className="map-zone map-zone-two" aria-hidden="true">POINTS LOOP</div>
        <div className="map-map-label"><MapPinned size={15} /><span>PoP city beacon layer</span><small>{locationState === "ready" ? "Live for this Points Mode session" : "Approved stops in your current preview"}</small></div>
        {stops.map((stop) => {
          const position = mapStopPosition(stop, stops);
          const selected = selectedStopId === stop.id;
          return <button className={`map-beacon ${selected ? "map-beacon-selected" : ""}`} key={stop.id} type="button" style={position} aria-label={`${stop.name}, ${stop.city}. ${stop.status.replaceAll("_", " ")}`} aria-pressed={selected} onClick={() => setSelectedStopId(stop.id)}><span className="map-beacon-pulse" aria-hidden="true" /><MapPin size={19} fill="currentColor" /><span className="map-beacon-label"><strong>{stop.name}</strong><small>{stop.city} · {stop.event ? `+${stop.event.pointsAward}` : "No event"}</small></span></button>;
        })}
        {stops.length === 0 ? <div className="map-empty"><MapPin size={22} /><strong>No active beacons in this area</strong><span>Use the at-home event or try again when a city pack is available.</span></div> : null}
        <div className="map-legend"><span><i className="legend-dot legend-available" /> Available</span><span><i className="legend-dot legend-new" /> New event</span><span><i className="legend-dot legend-completed" /> Completed recently</span></div>
      </div>
      {selectedStopId ? (() => { const selectedStop = stops.find((stop) => stop.id === selectedStopId); return selectedStop ? <div className="map-selection" role="status"><div><span className="section-kicker">Selected beacon</span><strong>{selectedStop.name}</strong><span>{selectedStop.city} · {selectedStop.coarseArea}</span></div><div className="map-selection-action">{selectedStop.event ? <button className="secondary-button" type="button" disabled={selectedStop.status === "COMPLETED_RECENTLY"} onClick={() => void startEvent(selectedStop.event!, selectedStop)}>Start event <ChevronRight size={16} /></button> : <span className="muted">No current event</span>}</div></div> : null; })() : null}
      <div className="game-stop-grid">
        {stops.map((stop) => {
          const measuredDistance = locationFix ? distanceMeters(locationFix, stop) : undefined;
          return <article className={`game-stop-card ${selectedStopId === stop.id ? "game-stop-card-selected" : ""}`} key={stop.id}><div className="game-stop-card-top"><MapPinned size={20} /><StatusPill tone={stop.status === "NEW_EVENT" ? "teal" : stop.status === "COMPLETED_RECENTLY" ? "neutral" : "saffron"}>{stop.status.replaceAll("_", " ")}</StatusPill></div><button className="map-focus-button" type="button" onClick={() => setSelectedStopId(stop.id)}><span>{stop.city}</span><h2>{stop.name}</h2><p>{stop.event?.title ?? "No current event"}</p></button><div className="game-stop-meta"><span>{measuredDistance == null ? "Distance checked on device" : measuredDistance < 1000 ? `${measuredDistance} m away` : `${(measuredDistance / 1000).toFixed(1)} km away`}</span><span>{stop.event ? `+${stop.event.pointsAward} PoP progress` : "Check later"}</span></div>{stop.event ? <button className="primary-button" type="button" disabled={stop.status === "COMPLETED_RECENTLY"} onClick={() => void startEvent(stop.event!, stop)}>Start event <ChevronRight size={16} /></button> : null}</article>;
        })}
        {stops.length === 0 ? <p className="empty-state">No approved Game Stops are active in this temporary area.</p> : null}
      </div>

      <div className="at-home-band"><House size={24} /><div><span className="section-kicker">No travel required</span><h2>At-home Points Palace event</h2><p>Earn the same progress by reviewing a real money decision from where you are.</p></div>{atHomeEvents[0] ? <button className="secondary-button" type="button" onClick={() => void startEvent(atHomeEvents[0])}>Start at home <ChevronRight size={16} /></button> : <span className="muted">No event active</span>}</div>

      {session ? <section className="game-event" aria-labelledby="game-event-title"><div><span className="section-kicker">Quick event · +{session.pointsAward} progress</span><h2 id="game-event-title">{session.prompt}</h2></div><div className="game-event-options">{session.options.map((option) => <label key={option}><input type="radio" name="game-stop-answer" value={option} checked={answer === option} onChange={() => setAnswer(option)} /><span>{option}</span></label>)}</div><div className="game-event-actions"><button className="secondary-button" type="button" onClick={() => setSession(null)}>Cancel</button><button className="primary-button" type="button" disabled={!answer} onClick={() => void completeEvent()}>Complete event <Check size={16} /></button></div></section> : null}

      <div className="section-heading nearby-deals-heading"><div><span className="section-kicker">Verified prices</span><h2>Nearby savings</h2></div></div>
      <div className="offer-grid">
        {data.offers.map((offer) => (
          <article className="offer-card" key={offer.id}><div className="offer-card-top"><StatusPill tone={offer.status === "EXPIRING" ? "saffron" : "teal"}>{offer.status.toLowerCase()}</StatusPill><span>{offer.merchant.name}</span></div><h2>{offer.title}</h2><strong className="offer-price">{formatMoney(offer.currentPrice)}</strong><span>Observed {formatTime(offer.observedAt)}</span><EvidenceLinks ids={offer.evidenceIds} evidence={data.evidence} /></article>
        ))}
      </div>
    </section>
  );
}

function EvidenceView({ data }: { data: DashboardData }) {
  return (
    <section className="content-section page-section">
      <div className="page-title-row"><div><span className="section-kicker">Open evidence layer</span><h1>Evidence ledger</h1><p>Every savings claim points back to what PoP actually observed.</p></div><button className="secondary-button" type="button"><ReceiptText size={17} /> Export ledger</button></div>
      <div className="evidence-list">
        {data.evidence.map((item) => (
          <article className="evidence-row" key={item.id}><span className="evidence-kind"><FileCheck2 size={18} /></span><div><strong>{item.sourceName}</strong><p>{item.summary}</p><span>{item.kind.replaceAll("_", " ")} · observed {formatTime(item.observedAt)}</span></div><code>{item.contentHash.slice(0, 16)}</code></article>
        ))}
      </div>
    </section>
  );
}

function ConnectionsView({ data, onImport }: { data: DashboardData; onImport: () => void }) {
  const [gmailStatus, setGmailStatus] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const gmail = data.connectors.find((connector) => connector.kind === "GMAIL_METADATA");
  async function scanGmail() {
    if (!gmail) return;
    setGmailStatus("Scanning Gmail metadata...");
    try { const result = await popMutation<{ imported: number }>(`/api/pop/workspaces/${encodeURIComponent(data.workspace.id)}/pop/connectors/gmail/scan`, "POST", {}); setGmailStatus(`Recorded ${result.imported} message headers as evidence.`); window.setTimeout(() => window.location.reload(), 700); } catch (error) { setGmailStatus(error instanceof Error ? error.message : "Gmail scan failed."); }
  }
  async function createPairingCode() {
    try { const result = await popMutation<{ code: string; expiresAt: string }>(`/api/pop/workspaces/${encodeURIComponent(data.workspace.id)}/pop/device-pairings`, "POST", { name: "Prince of Pricing for Windows", platform: "windows" }); setPairingCode(`${result.code} · expires ${formatTime(result.expiresAt)}`); } catch (error) { setPairingCode(error instanceof Error ? error.message : "Could not create a pairing code."); }
  }
  return (
    <section className="content-section page-section">
      <div className="page-title-row"><div><span className="section-kicker">Consent controls</span><h1>Connections</h1><p>Each source has a visible purpose, scope, and last activity.</p></div><div className="entry-actions"><button className="secondary-button" type="button" onClick={onImport}>Import FAD export</button>{gmail ? <button className="primary-button" type="button" onClick={() => void scanGmail()}>Scan Gmail metadata</button> : <a className="primary-button" href="/api/pop/gmail/start">Connect Gmail</a>}<button className="secondary-button" type="button" onClick={() => void createPairingCode()}>Pair Windows app</button></div></div>
      {gmailStatus ? <p className="live-error" role="status">{gmailStatus}</p> : null}
      {pairingCode ? <p className="live-error" role="status">{pairingCode}</p> : null}
      <div className="connection-list">
        {data.connectors.map((connector) => (
          <article className="connection-row" key={connector.id}><span className="connection-icon">{connector.status === "CONNECTED" ? <Link2 size={20} /> : <Unplug size={20} />}</span><div><strong>{connector.name}</strong><span>{connector.detail}</span><small>{connector.lastSyncAt ? `Last sync ${formatTime(connector.lastSyncAt)}` : "No private data synced"}</small></div><StatusPill tone={connector.status === "CONNECTED" || connector.status === "READY" ? "teal" : "neutral"}>{connector.status.replaceAll("_", " ").toLowerCase()}</StatusPill><button className="icon-button" type="button" title={`Manage ${connector.name}`} aria-label={`Manage ${connector.name}`}><ChevronRight size={18} /></button></article>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ avatarVisible, onAvatarChange, theme, onThemeChange }: { avatarVisible: boolean; onAvatarChange: () => void; theme: PopTheme; onThemeChange: (theme: PopTheme) => void }) {
  return (
    <section className="content-section page-section">
      <div className="page-title-row"><div><span className="section-kicker">Private by default</span><h1>Settings</h1><p>Choose what leaves this device and what PoP can observe.</p></div></div>
      <div className="settings-list">
        <fieldset className="theme-settings"><legend>Kingdom theme</legend><div>{POP_THEMES.map((item) => <label key={item.id}><input type="radio" name="kingdom-theme" value={item.id} checked={theme === item.id} onChange={() => onThemeChange(item.id)} /><span className="theme-swatch" style={{ background: item.color }} /><span>{item.name}</span></label>)}</div></fieldset>
        <a className="setting-row" href="/connections"><span className="setting-icon"><ShieldCheck size={20} /></span><span><strong>Device connections</strong><small>Review connected devices and workspace sync permissions.</small></span><ChevronRight size={18} /></a>
        <button className="setting-row" type="button" onClick={onAvatarChange}><span className="setting-icon">{avatarVisible ? <Eye size={20} /> : <EyeOff size={20} />}</span><span><strong>PoP character</strong><small>{avatarVisible ? "Visible in the command center." : "Hidden. Recommendations still work the same way."}</small></span><span className="switch-copy">{avatarVisible ? "On" : "Off"}</span></button>
        <button className="setting-row" type="button"><span className="setting-icon"><ReceiptText size={20} /></span><span><strong>Export my records</strong><small>Download a portable JSON evidence and settings bundle.</small></span><ChevronRight size={18} /></button>
      </div>
    </section>
  );
}

export function PopApp({ data, activeSection = "home", assetBase = "", kingdomAssetBase = "/assets/kingdom", kingdomHome = true }: { data: DashboardData; activeSection?: PopSection; assetBase?: string; kingdomAssetBase?: string; kingdomHome?: boolean }) {
  const [navOpen, setNavOpen] = useState(false);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [theme, setTheme] = useState<PopTheme>("royal-atlas");
  useEffect(() => {
    try {
      setTheme(parsePopTheme(localStorage.getItem(THEME_STORAGE_KEY)));
      setAvatarVisible(localStorage.getItem(AVATAR_STORAGE_KEY) !== "hidden");
    } catch { /* Appearance remains usable without device storage. */ }
  }, []);
  const changeTheme = (value: PopTheme) => {
    setTheme(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Session-only preference. */ }
  };
  const toggleAvatar = () => {
    setAvatarVisible(!avatarVisible);
    try { localStorage.setItem(AVATAR_STORAGE_KEY, avatarVisible ? "hidden" : "visible"); } catch { /* Session-only preference. */ }
  };
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [selectedTask, setSelectedTask] = useState<CancellationTask | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unread = data.notifications.filter((notification) => !notification.read).length;
  const evidenceById = useMemo(() => new Map(data.evidence.map((item) => [item.id, item])), [data.evidence]);

  const closeDialog = () => { setSelectedRecommendation(null); setSelectedTask(null); };

  return (
    <div className={`pop-shell ${avatarVisible ? "avatar-visible" : "avatar-hidden"}`} data-theme={theme}>
      <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
        <a className="brand-lockup" href="/" aria-label="Princess of Pricing home"><span className="brand-mark">PoP</span><span><strong>Princess of Pricing</strong><small>Savings intelligence</small></span></a>
        {avatarVisible ? <div className="princess-signature"><img src={themePortrait(theme)} alt="Faith, the Princess of Pricing" /><span>Make your next move count.</span></div> : null}
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => { const Icon = item.icon; return <a key={item.id} href={item.href} className={item.id === activeSection ? "active" : ""} aria-current={item.id === activeSection ? "page" : undefined}><Icon size={18} /><span>{item.label}</span></a>; })}
        </nav>
        <a className="sidebar-plan" href="/plans"><span>Free beta</span><strong>Explore Princess Plus <ChevronRight size={15} /></strong></a><div className="sidebar-trust"><ShieldCheck size={18} /><div><strong>Evidence-first mode</strong><span>No automatic money actions</span></div></div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setNavOpen((value) => !value)} aria-label="Toggle navigation"><Menu size={20} /></button>
          <div className="workspace-control"><span>{data.workspace.name}</span><StatusPill tone={data.workspace.mode === "LIVE" ? "teal" : "saffron"}>{data.workspace.mode.toLowerCase()}</StatusPill></div>
          <label className="theme-control" title="Choose your theme"><Palette size={17} /><span className="sr-only">Theme</span><select aria-label="Theme" value={theme} onChange={(event) => changeTheme(parsePopTheme(event.target.value))}>{POP_THEMES.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <div className="topbar-actions"><span className="freshness"><RefreshCw size={14} /> updated {formatTime(data.generatedAt)}</span><div className="notification-wrap"><button className="icon-button notification-button" type="button" title="Notifications" aria-label={`${unread} unread notifications`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((value) => !value)}><Bell size={19} />{unread > 0 ? <span>{unread}</span> : null}</button>{notificationsOpen ? <div className="notification-panel" role="status"><strong>Recent alerts</strong>{data.notifications.slice(0, 5).map((item) => <div key={item.id}><b>{item.title}</b><span>{item.body}</span></div>)}{data.notifications.length === 0 ? <span>No alerts yet.</span> : null}</div> : null}</div><div className="user-chip" title="Private beta workspace">FC</div></div>
        </header>

        <main className="page-content">
          {activeSection === "home" ? (kingdomHome ? <KingdomHome data={data} onOpen={setSelectedRecommendation} assetBase={kingdomAssetBase} avatarVisible={avatarVisible} theme={theme} /> : <HomeView data={data} onOpen={setSelectedRecommendation} assetBase={assetBase} />) : null}
          {activeSection === "watchlist" ? <WatchlistView data={data} onAdd={() => setEntryMode("watch")} /> : null}
          {activeSection === "subscriptions" ? <SubscriptionsView data={data} onTask={setSelectedTask} onAdd={() => setEntryMode("subscription")} onImport={() => setEntryMode("fad")} /> : null}
          {activeSection === "wallet" ? <WalletView data={data} onAddCard={() => setEntryMode("card")} /> : null}
          {activeSection === "nearby" ? <NearbyView data={data} /> : null}
          {activeSection === "evidence" ? <EvidenceView data={data} /> : null}
          {activeSection === "connections" ? <ConnectionsView data={data} onImport={() => setEntryMode("fad")} /> : null}
          {activeSection === "settings" ? <SettingsView avatarVisible={avatarVisible} onAvatarChange={toggleAvatar} theme={theme} onThemeChange={changeTheme} /> : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.slice(0, 5).map((item) => { const Icon = item.icon; return <a key={item.id} href={item.href} className={item.id === activeSection ? "active" : ""}><Icon size={19} /><span>{item.label}</span></a>; })}
      </nav>

      {(selectedRecommendation || selectedTask) ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDialog(); }}>
          <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <button className="icon-button dialog-close" type="button" onClick={closeDialog} aria-label="Close"><X size={19} /></button>
            {selectedRecommendation ? <><span className="section-kicker"><Sparkles size={15} /> Recommendation receipt</span><h2 id="dialog-title">{selectedRecommendation.title}</h2><p>{selectedRecommendation.explanation}</p><div className="dialog-saving"><span>Estimated savings</span><strong>{formatMoney(selectedRecommendation.estimatedSavings)}</strong></div><h3>Evidence used</h3><div className="dialog-evidence">{selectedRecommendation.evidenceIds.map((id) => { const item = evidenceById.get(id); return item ? <div key={id}><FileCheck2 size={16} /><span><strong>{item.sourceName}</strong><small>{item.summary}</small></span></div> : null; })}</div><h3>Assumptions</h3><ul>{selectedRecommendation.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul><a className="primary-button button-link" href={selectedRecommendation.actionHref ?? "#"}>{selectedRecommendation.actionLabel}<ChevronRight size={17} /></a><small className="confirmation-note"><ShieldCheck size={14} /> You decide and confirm every external action.</small></> : null}
            {selectedTask ? <><span className="section-kicker"><ListChecks size={15} /> Cancellation task</span><h2 id="dialog-title">Review {selectedTask.merchantName}</h2><p>PoP prepared the route. It will not cancel anything without you.</p><ol className="instruction-list">{selectedTask.instructions.map((instruction, index) => <li key={instruction}><span>{index + 1}</span>{instruction}</li>)}</ol>{selectedTask.actionUrl ? <a className="primary-button button-link" href={selectedTask.actionUrl} target="_blank" rel="noreferrer">Open account page <ChevronRight size={17} /></a> : null}<button className="secondary-button full-button" type="button" onClick={closeDialog}><Check size={17} /> I completed this myself</button></> : null}
          </section>
        </div>
      ) : null}
      {entryMode ? <EntryDialog mode={entryMode} workspaceId={data.workspace.id} onClose={() => setEntryMode(null)} /> : null}
    </div>
  );
}
