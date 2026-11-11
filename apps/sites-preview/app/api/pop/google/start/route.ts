const STATE_COOKIE = "pop_google_oauth_state";

function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  return `${protocol}://${url.host}`;
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return Response.json({ error: "Google sign-in is not configured" }, { status: 503 });

  const state = crypto.randomUUID();
  const callback = new URL("/api/pop/google/callback", `${publicOrigin(request)}/`).toString();
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", clientId);
  google.searchParams.set("redirect_uri", callback);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");

  const response = new Response(null, { status: 302, headers: { location: google.toString() } });
  response.headers.append("set-cookie", `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/api/pop/google; HttpOnly; SameSite=Lax; Max-Age=600; Secure`);
  return response;
}
