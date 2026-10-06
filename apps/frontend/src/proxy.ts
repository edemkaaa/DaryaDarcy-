import { NextResponse, type NextRequest } from "next/server";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Remote development API sees the same Origin as its deployed frontend.
 * Accept only the local frontend's own browser requests; preserve cookies and
 * the upstream's authorization checks. Production and a local HTTP API keep
 * their existing behavior.
 */
export function proxy(request: NextRequest) {
  const target = process.env.API_PROXY_TARGET;
  if (process.env.NODE_ENV !== "development" || !target)
    return NextResponse.next();

  const upstream = new URL(target);
  if (upstream.protocol !== "https:") return NextResponse.next();

  const host = request.headers.get("host") || request.nextUrl.host;
  const local = new URL(`http://${host}`);
  if (
    !loopbackHosts.has(local.hostname) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return forbidden();

  const origin = request.headers.get("origin");
  // Same-origin GETs and CLI diagnostics normally have no Origin header.
  if (!origin) return NextResponse.next();
  if (origin !== local.origin) return forbidden();

  const headers = new Headers(request.headers);
  headers.set("origin", upstream.origin);
  return NextResponse.next({ request: { headers } });
}

function forbidden() {
  return new NextResponse("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config = { matcher: ["/api/:path*", "/media/:path*"] };
