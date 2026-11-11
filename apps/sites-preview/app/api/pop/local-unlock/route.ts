const SESSION_COOKIE = "pop_session";
const CSRF_COOKIE = "pop_csrf";

function apiBase() {
  return (process.env.POP_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expectedToken = process.env.POP_LOCAL_UNLOCK_TOKEN;
  const password = process.env.POP_LOCAL_OWNER_PASSWORD;

  if (
    process.env.NODE_ENV === "production" ||
    url.hostname !== "127.0.0.1" ||
    !expectedToken ||
    url.searchParams.get("token") !== expectedToken ||
    !password
  ) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(`${apiBase()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner@pop.local", password }),
  });
  const payload = await upstream.json().catch(() => null) as { token?: string } | null;

  process.env.POP_LOCAL_UNLOCK_TOKEN = "";
  process.env.POP_LOCAL_OWNER_PASSWORD = "";

  if (!upstream.ok || !payload?.token) {
    return new Response("Local unlock failed", { status: 401 });
  }

  const csrf = crypto.randomUUID();
  const response = Response.redirect(new URL("/", request.url));
  response.headers.append("set-cookie", `${SESSION_COOKIE}=${encodeURIComponent(payload.token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`);
  response.headers.append("set-cookie", `${CSRF_COOKIE}=${encodeURIComponent(csrf)}; Path=/; SameSite=Strict; Max-Age=28800`);
  return response;
}
