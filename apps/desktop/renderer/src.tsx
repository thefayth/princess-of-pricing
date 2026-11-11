import React from "react";
import { createRoot } from "react-dom/client";
import { createDemoDashboard } from "@pop/domain";
import { PopApp } from "@pop/ui";
import "@pop/ui/styles.css";
import "./desktop.css";

declare global { interface Window { popDesktop: { vaultStatus(): Promise<{ paired: boolean }>; pair(code: string): Promise<unknown>; sync(): Promise<{ synced: number }>; }; } }

function DesktopControls() {
  const [status, setStatus] = React.useState("This vault is local until you pair it.");
  const pair = async () => {
    const code = window.prompt("Enter the short pairing code from PoP Connections.");
    if (!code) return;
    try { await window.popDesktop.pair(code); setStatus("Desktop paired. Your encrypted vault can sync selected observations."); } catch (error) { setStatus(error instanceof Error ? error.message : "Pairing failed."); }
  };
  const sync = async () => { try { const result = await window.popDesktop.sync(); setStatus(`Synced ${result.synced} selected record${result.synced === 1 ? "" : "s"}.`); } catch (error) { setStatus(error instanceof Error ? error.message : "Sync failed."); } };
  return <div className="desktop-controls"><button type="button" onClick={() => void pair()}>Pair desktop</button><button type="button" onClick={() => void sync()}>Sync selected records</button><span role="status">{status}</span></div>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <><DesktopControls /><PopApp data={{ ...createDemoDashboard(), workspace: { id: "local", name: "Local encrypted vault", mode: "LOCAL" } }} assetBase="." /></>
  </React.StrictMode>,
);
