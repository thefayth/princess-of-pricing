const STATE_COOKIE = "pop_gmail_oauth_state";
const SESSION_COOKIE = "pop_session";

function apiBase() { return (process.env.POP_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, ""); }
function publicOrigin(request: Request) { const url = new URL(request.url); return `${request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "")}://${url.host}`; }
function cookieValue(request: Request, name: string) { return (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1); }
function redirect(request: Request, status: string) { return new Response(null, { status: 302, headers: { location: new URL(`/connections?gmail=${status}`, `${publicOrigin(request)}/`).toString() } }); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = cookieValue(request, STATE_COOKIE);
  const session = cookieValue(request, SESSION_COOKIE);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!code || !state || !expected || state !== decodeURIComponent(expected) || !session || !clientId || !clientSecret) return redirect(request, "failed");
  const callback = new URL("/api/pop/gmail/callback", `${publicOrigin(request)}/`).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callback, grant_type: "authorization_code" }) });
  const token = await tokenResponse.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number } | null;
  if (!tokenResponse.ok || !token?.access_token || !token.refresh_token) return redirect(request, "failed");
  const identityResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
  const identity = await identityResponse.json().catch(() => null) as { email?: string } | null;
  const meResponse = await fetch(`${apiBase()}/api/v1/me`, { headers: { authorization: `Bearer ${decodeURIComponent(session)}` } });
  const me = await meResponse.json().catch(() => null) as { workspaces?: Array<{ workspace: { id: string } }> } | null;
  const workspaceId = me?.workspaces?.[0]?.workspace.id;
  if (!identityResponse.ok || !identity?.email || !workspaceId) return redirect(request, "failed");
  const saved = await fetch(`${apiBase()}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/pop/connectors/gmail`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${decodeURIComponent(session)}`, "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ email: identity.email, accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString() }) });
  if (!saved.ok) return redirect(request, "failed");
  const response = redirect(request, "connected");
  response.headers.append("set-cookie", `${STATE_COOKIE}=; Path=/api/pop/gmail; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
  return response;
}
