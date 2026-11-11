const SESSION_COOKIE = "pop_session";
const CSRF_COOKIE = "pop_csrf";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return Response.json({ error: "Authentication required" }, { status: 401 });

  if (MUTATING.has(request.method)) {
    const csrf = cookieValue(request, CSRF_COOKIE);
    if (!csrf || request.headers.get("x-pop-csrf") !== decodeURIComponent(csrf)) {
      return Response.json({ error: "CSRF validation failed" }, { status: 403 });
    }
  }

  const { path } = await context.params;
  const base = (process.env.POP_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
  const sourceUrl = new URL(request.url);
  const upstreamUrl = `${base}/api/v1/${path.map(encodeURIComponent).join("/")}${sourceUrl.search}`;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${decodeURIComponent(token)}`,
    "x-request-id": requestId,
  });
  const contentType = request.headers.get("content-type");
  const idempotencyKey = request.headers.get("idempotency-key");
  const ifMatch = request.headers.get("if-match");
  if (contentType) headers.set("content-type", contentType);
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  if (ifMatch) headers.set("if-match", ifMatch);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    });
    const responseHeaders = new Headers({
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "x-request-id": requestId,
    });
    const etag = upstream.headers.get("etag");
    if (etag) responseHeaders.set("etag", etag);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: "PoP API is unavailable", requestId }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
