import type { DashboardData, Evidence, Recommendation } from "@pop/contracts";
import {
  ArrowUpRight,
  BadgeDollarSign,
  BellRing,
  BookOpenCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  Landmark,
  ListChecks,
  MapPinned,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  Trophy,
  Watch,
} from "lucide-react";
import {
  deriveKingdomDeadline,
  deriveKingdomDistricts,
  deriveKingdomProgress,
  deriveUrgentQuests,
  type KingdomDistrict,
  type KingdomQuest,
} from "@pop/game";
import { themePortrait, type PopTheme } from "./themes.js";

function formatMoney(value: { amountCents: number; currency: "USD" }) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: value.currency }).format(value.amountCents / 100);
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTime(value?: string) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(value));
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.85) return "High confidence";
  if (confidence >= 0.65) return "Medium confidence";
  return "Needs review";
}

function assetPath(base: string, file: string) {
  return `${base.replace(/\/$/, "")}/${file}`;
}

function districtIcon(id: KingdomDistrict["id"]) {
  if (id === "market") return <Watch size={20} aria-hidden="true" />;
  if (id === "station") return <ListChecks size={20} aria-hidden="true" />;
  if (id === "arcade") return <Tag size={20} aria-hidden="true" />;
  if (id === "palace") return <Landmark size={20} aria-hidden="true" />;
  return <MapPinned size={20} aria-hidden="true" />;
}

function questIcon(kind: KingdomQuest["kind"]) {
  if (kind === "renewal") return <ReceiptText size={17} aria-hidden="true" />;
  if (kind === "offer") return <Tag size={17} aria-hidden="true" />;
  if (kind === "duplicate") return <CircleAlert size={17} aria-hidden="true" />;
  if (kind === "promo") return <BadgeDollarSign size={17} aria-hidden="true" />;
  return <FileCheck2 size={17} aria-hidden="true" />;
}

function evidenceCount(ids: string[], evidence: Evidence[]) {
  return ids.filter((id) => evidence.some((item) => item.id === id)).length;
}

export function KingdomDistrictHotspot({ district, className = "" }: { district: KingdomDistrict; className?: string }) {
  return (
    <a className={`kingdom-hotspot kingdom-hotspot-${district.id} kingdom-hotspot-${district.status} ${className}`} href={district.href} aria-label={`${district.label}: ${district.count} ${district.countLabel}. ${district.detail}`}>
      <span className="kingdom-hotspot-icon">{districtIcon(district.id)}</span>
      <span className="kingdom-hotspot-copy"><strong>{district.label}</strong><small>{district.count > 0 ? `${formatPoints(district.count)} ${district.countLabel}` : "Quiet district"}</small><em>{district.detail}</em></span>
      <ChevronRight size={16} aria-hidden="true" />
    </a>
  );
}

export function KingdomMap({ data, districts, assetBase, avatarVisible, theme }: { data: DashboardData; districts: KingdomDistrict[]; assetBase: string; avatarVisible: boolean; theme: PopTheme }) {
  return (
    <section className="kingdom-map-card" aria-labelledby="kingdom-map-title">
      <div className="kingdom-map-heading">
        <div><span className="section-kicker"><MapPinned size={15} /> Your live money map</span><h1 id="kingdom-map-title">Savings Kingdom</h1><p>Every district is a reviewable path through the evidence in your wallet.</p></div>
        <span className={`kingdom-mode-badge ${data.workspace.mode === "LIVE" ? "live" : "preview"}`}>{data.workspace.mode === "DEMO" ? "Synthetic preview" : data.workspace.mode === "LOCAL" ? "Local workspace" : "Workspace live"}</span>
      </div>
      <div className="kingdom-map-stage">
        <img className="kingdom-map-image" src={assetPath(assetBase, "kingdom-environment-v1.png")} alt="Illustrated Savings Kingdom with connected districts" />
        <div className="kingdom-map-shade" aria-hidden="true" />
        {districts.map((district) => <KingdomDistrictHotspot key={district.id} district={district} />)}
        {avatarVisible ? <img className="kingdom-avatar princess-portrait" src={themePortrait(theme)} alt="Faith, the Princess of Pricing" /> : null}
        <div className="kingdom-map-note"><ShieldCheck size={14} /><span>Evidence-backed routes only</span></div>
      </div>
      <nav className="kingdom-mobile-districts" aria-label="Savings Kingdom chapters">{districts.map((district) => <KingdomDistrictHotspot key={district.id} district={district} />)}</nav>
    </section>
  );
}

export function NextMoneyMovePanel({ data, onOpen }: { data: DashboardData; onOpen: (recommendation: Recommendation) => void }) {
  const nextMove = data.recommendations[0];
  if (!nextMove) {
    return <aside className="next-money-panel next-money-panel-empty" aria-labelledby="next-money-title"><span className="section-kicker"><Sparkles size={15} /> Next money move</span><h2 id="next-money-title">Your kingdom is quiet</h2><p>New verified recommendations will appear here when PoP finds a reviewable path.</p><a className="secondary-button button-link" href="/watchlist">Open Watchlist <ArrowUpRight size={16} /></a></aside>;
  }
  const deadline = deriveKingdomDeadline({ expiresAt: nextMove.expiresAt }, new Date(data.generatedAt));
  return (
    <aside className="next-money-panel" aria-labelledby="next-money-title">
      <div className="next-money-panel-top"><span className="section-kicker"><Sparkles size={15} /> Next Money Move</span><span className={`kingdom-confidence kingdom-confidence-${deadline.urgency}`}>{confidenceLabel(nextMove.confidence)}</span></div>
      <h2 id="next-money-title">{nextMove.title}</h2>
      <p>{nextMove.explanation}</p>
      <div className="next-money-savings"><span>Estimated savings</span><strong>{formatMoney(nextMove.estimatedSavings)}</strong></div>
      <div className="next-money-facts">
        <span><FileCheck2 size={14} /> {evidenceCount(nextMove.evidenceIds, data.evidence)} evidence links</span>
        <span><Clock3 size={14} /> {deadline.date ? `${deadline.label} · ${formatTime(deadline.date)}` : "No expiration supplied"}</span>
      </div>
      {nextMove.assumptions.length > 0 ? <details className="next-money-assumptions"><summary>Assumptions</summary><ul>{nextMove.assumptions.slice(0, 3).map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details> : null}
      <button className="primary-button full-button" type="button" onClick={() => onOpen(nextMove)}>Review &amp; Decide <ChevronRight size={17} /></button>
      <small className="kingdom-safety-note"><ShieldCheck size={14} /> Nothing is purchased, cancelled, or applied automatically.</small>
    </aside>
  );
}

export function UrgentQuestDock({ data }: { data: DashboardData }) {
  const quests = deriveUrgentQuests(data, new Date(data.generatedAt));
  return (
    <section className="urgent-quest-dock" aria-labelledby="urgent-quest-title">
      <div className="urgent-quest-heading"><div><span className="section-kicker"><BellRing size={15} /> Quest dock</span><h2 id="urgent-quest-title">Worth a look now</h2></div><span>{quests.length > 0 ? `${quests.length} open` : "All clear"}</span></div>
      {quests.length > 0 ? <div className="urgent-quest-list">{quests.map((quest) => <a className="urgent-quest" key={quest.id} href={quest.href}><span className="urgent-quest-icon">{questIcon(quest.kind)}</span><span><strong>{quest.title}</strong><small>{quest.detail}</small></span><ChevronRight size={16} aria-hidden="true" /></a>)}</div> : <div className="urgent-quest-empty"><Trophy size={19} /><span>No urgent quests. PoP will surface a new one when verified evidence needs your decision.</span></div>}
    </section>
  );
}

export function KingdomProgressCard({ data }: { data: DashboardData }) {
  const progress = deriveKingdomProgress(data);
  return <article className="kingdom-progress-card"><div className="kingdom-progress-icon"><Trophy size={20} /></div><div><span className="section-kicker">Points Palace progress</span><strong>{progress.label}</strong><small>{formatPoints(progress.totalPoints)} / {formatPoints(progress.nextLevelPoints)} PoP progress points</small><progress max="100" value={progress.percent} aria-label={`${Math.round(progress.percent)} percent toward the next Points Palace level`} /></div><a href="/wallet" aria-label="Open Points Palace"><ArrowUpRight size={17} /></a></article>;
}

export function EvidencePrivacyTiles({ data }: { data: DashboardData }) {
  const connectedCount = data.connectors.filter((connector) => connector.status === "CONNECTED" || connector.status === "READY").length;
  return <div className="evidence-privacy-tiles"><a href="/evidence"><FileCheck2 size={18} /><span><strong>{formatPoints(data.evidence.length)} evidence receipts</strong><small>Open the source ledger</small></span><ChevronRight size={15} /></a><a href="/connections"><ShieldCheck size={18} /><span><strong>Protected by default</strong><small>{connectedCount} scoped connection{connectedCount === 1 ? "" : "s"} available</small></span><ChevronRight size={15} /></a><div><BookOpenCheck size={18} /><span><strong>Review-first decisions</strong><small>PoP never changes a financial record automatically</small></span></div></div>;
}

export function PrincessPlusBanner() {
  return <aside className="princess-plus-banner"><div><Landmark size={20} /><span><strong>Princess Plus</strong><small>Proposed: $9/month or $79/year. Billing is not live.</small></span></div><a className="secondary-button button-link" href="/plans">See plans <ChevronRight size={16} /></a></aside>;
}

function PalaceRegisterPreview({ data }: { data: DashboardData }) {
  const entries = [...data.pointsPalace.register].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 4);
  return <section className="palace-register-preview" aria-labelledby="register-preview-title"><div className="section-heading"><h2 id="register-preview-title">Your points register</h2><a href="/wallet" className="text-link">Open register <ArrowUpRight size={16} /></a></div>{entries.length ? <div className="palace-register-rows">{entries.map((entry) => <a href="/wallet" key={entry.id}><span><strong>{entry.label}</strong><small>{entry.merchantName ?? entry.category ?? "Points Palace"} · {formatTime(entry.occurredAt)}</small></span><span><strong>{entry.pointsDelta > 0 ? "+" : ""}{formatPoints(entry.pointsDelta)}</strong><small>{entry.balanceKind === "POP_PROGRESS" ? "PoP progress · no cash value" : "Loyalty points"} · {entry.status.toLowerCase()}</small></span><ChevronRight size={16} /></a>)}</div> : <p className="muted">No points activity recorded yet. Your confirmed and pending activity will appear here.</p>}<p className="register-value-note">Loyalty points, estimated value, and PoP progress are tracked separately.</p></section>;
}

export function KingdomHome({ data, onOpen, assetBase, avatarVisible, theme = "royal-atlas" }: { data: DashboardData; onOpen: (recommendation: Recommendation) => void; assetBase: string; avatarVisible: boolean; theme?: PopTheme }) {
  const districts = deriveKingdomDistricts(data);
  const map = <KingdomMap data={data} districts={districts} assetBase={assetBase} avatarVisible={avatarVisible} theme={theme} />;
  const next = <NextMoneyMovePanel data={data} onOpen={onOpen} />;
  return <div className={`kingdom-home kingdom-layout-${theme}`}>
    {theme === "rose-ledger" ? <><header className="rose-welcome"><div><h1>Your money, with a plan</h1><p>Everyday wins, backed by evidence. You choose the next move.</p></div>{avatarVisible ? <img src={themePortrait(theme)} alt="Faith, the Princess of Pricing" /> : null}</header>{next}<PalaceRegisterPreview data={data} /><PrincessPlusBanner />{map}</> : theme === "emerald-arcade" ? <>{next}<div className="kingdom-main-grid">{map}<div className="arcade-mission"><KingdomProgressCard data={data} /><a className="arcade-loyalty" href="/wallet"><Landmark size={22} /><span><strong>Loyalty accounts</strong><b>{data.pointsPalace.accounts.filter((account) => account.kind === "LOYALTY_POINTS").length}</b><small>Balances stay separate by program</small></span><ChevronRight size={17} /></a><EvidencePrivacyTiles data={data} /><PrincessPlusBanner /></div></div></> : <><div className="kingdom-main-grid">{map}<div className="royal-action-column">{next}<PrincessPlusBanner /></div></div><div className="kingdom-lower-grid"><KingdomProgressCard data={data} /><EvidencePrivacyTiles data={data} /></div></>}
    <UrgentQuestDock data={data} />
    {theme === "rose-ledger" ? <div className="kingdom-lower-grid"><KingdomProgressCard data={data} /><EvidencePrivacyTiles data={data} /></div> : null}
    <p className="partner-disclosure"><Tag size={14} /> Paid plans and clearly disclosed referrals support PoP. Compensation never changes recommendation rankings.</p>
    <a className="text-link" href="https://github.com/thefayth/princess-of-pricing" target="_blank" rel="noreferrer">Open-source code <ArrowUpRight size={14} /></a>
  </div>;
}
