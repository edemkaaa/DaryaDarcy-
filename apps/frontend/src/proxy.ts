/** Серверный proxy разделяет маршруты приложения и защищённых ресурсов, добавляя политику документа до рендера страницы. */
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { documentSecurityHeaders } from "./shared/security/document-headers";
import { isRetiredLibraryAsset } from "./shared/security/retired-library-assets";
import { legacyClubImageStatus } from "./shared/security/legacy-club-images";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Сначала закрываем retired/legacy пути, затем разделяем API и документы; nonce переопределяем независимо от входных заголовков клиента. */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const legacyStatus = legacyClubImageStatus(request.nextUrl);
  if (legacyStatus)
    return new NextResponse("Материал недоступен.", {
      status: legacyStatus,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (
    isRetiredLibraryAsset(pathname) ||
    (pathname === "/_next/image" &&
      isRetiredLibraryAsset(request.nextUrl.searchParams.get("url") ?? ""))
  )
    return new NextResponse("Материал недоступен.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  // Static resources keep their existing cache/security headers, without a document nonce.
  if (/^\/(?:assets|_next)\//.test(pathname)) return NextResponse.next();
  if (/^\/(?:api|media)(?:\/|$)/.test(request.nextUrl.pathname))
    return proxyApi(request);

  const nonce = randomBytes(16).toString("base64");
  const security = documentSecurityHeaders(
    nonce,
    process.env.NODE_ENV === "development",
    process.env.NEXT_PUBLIC_API_BASE_URL,
    pathname === "/password" || pathname === "/password/",
  );
  const headers = new Headers(request.headers);
  // Override client-supplied values. Next reads the request CSP to attach this
  // nonce to its framework bundles and inline hydration scripts.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", security["Content-Security-Policy"]);
  const response = NextResponse.next({ request: { headers } });
  for (const [name, value] of Object.entries(security))
    response.headers.set(name, value);
  return response;
}

/** Только локальному dev proxy с HTTPS upstream подменяем Origin после проверки loopback и same-origin; production не переписываем. Cookie и серверные проверки авторизации сохраняются; локальный HTTP API не затрагиваем. */
function proxyApi(request: NextRequest) {
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

/** Отклоняем неподходящий dev-запрос без кеширования отказа. */
function forbidden() {
  return new NextResponse("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: [
    "/assets/:path*",
    "/_next/:path*",
    "/((?!_next(?:/|$)|assets(?:/|$)|fonts(?:/|$)|favicon\\.ico$|manifest\\.webmanifest$).*)",
  ],
};
