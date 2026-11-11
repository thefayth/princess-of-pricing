"use client";

import type { DashboardData } from "@pop/contracts";
import { PopApp, type PopSection } from "@pop/ui";
import { useCallback, useEffect, useState } from "react";

type WorkspaceMembership = {
  workspace: { id: string; name: string };
};

type SessionState = "checking" | "signed-out" | "loading" | "live" | "offline";

async function responseMessage(response: Response) {
  const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
  return payload?.message ?? payload?.error ?? `Request failed (${response.status})`;
}

export function LivePop({ demo, section, kingdomHome = true, googleSignInEnabled = false }: { demo: DashboardData; section: PopSection; kingdomHome?: boolean; googleSignInEnabled?: boolean }) {
  const [data, setData] = useState(demo);
  const [state, setState] = useState<SessionState>("checking");
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (preferredWorkspaceId?: string) => {
    setState("loading");
    setError("");
    try {
      const meResponse = await fetch("/api/pop/me", { cache: "no-store" });
      if (!meResponse.ok) throw new Error(await responseMessage(meResponse));
      const me = await meResponse.json() as { workspaces: WorkspaceMembership[] };
      const savedWorkspaceId = preferredWorkspaceId ?? window.localStorage.getItem("pop_workspace_id") ?? undefined;
      const membership = me.workspaces.find((item) => item.workspace.id === savedWorkspaceId) ?? me.workspaces[0];
      if (!membership) throw new Error("No PoP workspace is available for this account.");
      window.localStorage.setItem("pop_workspace_id", membership.workspace.id);
      const dashboardResponse = await fetch(`/api/pop/workspaces/${encodeURIComponent(membership.workspace.id)}/pop/dashboard`, { cache: "no-store" });
      if (!dashboardResponse.ok) throw new Error(await responseMessage(dashboardResponse));
      setData(await dashboardResponse.json() as DashboardData);
      setState("live");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "PoP could not load the private workspace.");
      setState("offline");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/pop/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ authenticated: boolean }> : { authenticated: false })
      .then((session) => {
        if (!active) return;
        if (session.authenticated) void loadDashboard();
        else setState("signed-out");
      })
      .catch(() => { if (active) setState("offline"); });
    return () => { active = false; };
  }, [loadDashboard]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/pop/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    if (!response.ok) {
      setError(await responseMessage(response));
      setState("signed-out");
      return;
    }
    await loadDashboard();
  }

  return (
    <>
      <PopApp data={data} activeSection={section} kingdomHome={kingdomHome} />
      {state !== "live" ? (
        <div className="live-gate" role="presentation">
          <section className="live-gate-panel" role="dialog" aria-modal="true" aria-labelledby="live-gate-title">
            <span className="live-gate-mark">PoP</span>
            <div>
              <p className="live-gate-kicker">Private beta</p>
              <h1 id="live-gate-title">{state === "loading" || state === "checking" ? "Opening your savings wallet" : state === "offline" ? "Private workspace unavailable" : "Sign in to Princess of Pricing"}</h1>
              {state === "signed-out" ? (
                <>
                  <form className="live-login" onSubmit={signIn}>
                    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
                    <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
                    {error ? <p className="live-error" role="alert">{error}</p> : null}
                    <button type="submit">Sign in</button>
                  </form>
                  {googleSignInEnabled ? <a className="live-google-login" href="/api/pop/google/start">Continue with Google</a> : null}
                  <a className="live-plans-link" href="/plans">Explore PoP and proposed plans</a>
                </>
              ) : null}
              {state === "offline" ? <><p className="live-gate-copy">{error || "The private API is not running. The data behind this panel is a labeled preview."}</p><button className="live-retry" type="button" onClick={() => void loadDashboard()}>Try again</button></> : null}
              {state === "loading" || state === "checking" ? <p className="live-gate-copy" aria-live="polite">Checking the encrypted session and workspace...</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
