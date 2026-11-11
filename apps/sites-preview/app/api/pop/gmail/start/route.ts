const STATE_COOKIE = "pop_gmail_oauth_state";
const SESSION_COOKIE = "pop_session";

function publicOrigin(request: Request) { const url = new URL(request.url); return `${request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "")}://${url.host}`; }
function cookieValue(request: Request, name: string) { return (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1); }

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId || !cookieValue(request, SESSION_COOKIE)) return new Response(null, { status: 302, headers: { location: "/connections?gmail=signin" } });
  const state = crypto.randomUUID();
  const callback = new URL("/api/pop/gmail/callback", `${publicOrigin(request)}/`).toString();
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", scope: "openid email https://www.googleapis.com/auth/gmail.metadata", state, access_type: "offline", prompt: "consent" }).toString();
  const response = new Response(null, { status: 302, headers: { location: google.toString() } });
  response.headers.append("set-cookie", `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/api/pop/gmail; HttpOnly; SameSite=Lax; Max-Age=600; Secure`);
  return response;
}
