const SESSION_COOKIE = "pop_session";
const CSRF_COOKIE = "pop_csrf";

export function sessionCookies(token: string) {
  const csrf = crypto.randomUUID();
  return {
    csrf,
    headers: [
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secureCookie()}`,
      `${CSRF_COOKIE}=${encodeURIComponent(csrf)}; Path=/; SameSite=Strict; Max-Age=28800${secureCookie()}`,
    ],
  };
}

function apiBase() {
  return (process.env.POP_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function secureCookie() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export async function GET(request: Request) {
  return Response.json({ authenticated: Boolean(cookieValue(request, SESSION_COOKIE)) });
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const upstream = await fetch(`${apiBase()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: await request.text(),
  });
  const payload = await upstream.json().catch(() => ({ error: "Authentication failed" }));
  if (!upstream.ok || !payload.token) {
    return Response.json({ error: payload.error ?? "Authentication failed", requestId }, { status: upstream.status });
  }

  const session = sessionCookies(payload.token);
  const { token, ...safePayload } = payload;
  const response = Response.json({ ...safePayload, csrfToken: session.csrf, requestId });
  session.headers.forEach((header) => response.headers.append("set-cookie", header));
  return response;
}

export async function DELETE(request: Request) {
  const csrf = cookieValue(request, CSRF_COOKIE);
  if (!csrf || request.headers.get("x-pop-csrf") !== decodeURIComponent(csrf)) {
    return Response.json({ error: "CSRF validation failed" }, { status: 403 });
  }
  const response = Response.json({ authenticated: false });
  response.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie()}`);
  response.headers.append("set-cookie", `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0${secureCookie()}`);
  return response;
}
