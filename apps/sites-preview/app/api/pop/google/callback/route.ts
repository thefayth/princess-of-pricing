import { sessionCookies } from "../../session/route";

const STATE_COOKIE = "pop_google_oauth_state";

function cookieValue(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function apiBase() {
  return (process.env.POP_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  return `${protocol}://${url.host}`;
}

function redirect(request: Request, path: string) {
  return new Response(null, { status: 302, headers: { location: new URL(path, `${publicOrigin(request)}/`).toString() } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const expectedState = cookieValue(request, STATE_COOKIE);
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!state || !expectedState || state !== decodeURIComponent(expectedState) || !code || !clientId || !clientSecret) {
    return redirect(request, "/?google=failed");
  }

  const redirectUri = new URL("/api/pop/google/callback", `${publicOrigin(request)}/`).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const tokenPayload = await tokenResponse.json().catch(() => null) as { id_token?: string } | null;
  if (!tokenResponse.ok || !tokenPayload?.id_token) return redirect(request, "/?google=failed");

  const upstream = await fetch(`${apiBase()}/api/v1/auth/google`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": crypto.randomUUID() },
    body: JSON.stringify({ idToken: tokenPayload.id_token }),
  });
  const payload = await upstream.json().catch(() => null) as { token?: string } | null;
  if (!upstream.ok || !payload?.token) return redirect(request, "/?google=failed");

  const session = sessionCookies(payload.token);
  const response = redirect(request, "/");
  session.headers.forEach((header) => response.headers.append("set-cookie", header));
  response.headers.append("set-cookie", `${STATE_COOKIE}=; Path=/api/pop/google; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
  return response;
}
