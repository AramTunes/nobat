/**
 * Forwards /api/v1 to the Go booking API. Vite's dev proxy does this on
 * :8080; the Nitro production preview does not, so the built app would 404.
 * The published host has no Go process — a connection failure becomes JSON.
 */
const UPSTREAM = process.env.NOBAT_API_URL || "http://127.0.0.1:8090";

interface ProxyEvent {
  url: URL;
  req: Request;
}

export default async function nobatApiProxy(
  event: ProxyEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const path = event.url.pathname;
  if (path !== "/api/v1" && !path.startsWith("/api/v1/")) return next();

  const method = (event.req.method || "GET").toUpperCase();
  const headers = new Headers(event.req.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("accept-encoding");

  const init: RequestInit = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await event.req.arrayBuffer();
  }

  try {
    const res = await fetch(new URL(path + event.url.search, UPSTREAM), init);
    const out = new Headers(res.headers);
    out.delete("content-encoding");
    out.delete("transfer-encoding");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "ارتباط با سرور برقرار نشد", code: "NETWORK" }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }
}
