/** Политика HTML задаёт nonce для скриптов и список разрешённых источников; заголовки API формируются отдельно. */
/** Scripts require a per-response nonce; existing React style attributes remain
 * supported. Media may come from HTTPS storage, but executable frames have an
 * explicit provider allowlist. API responses keep their own security policies.
 */
export function documentSecurityHeaders(
  nonce: string,
  development: boolean,
  apiBaseUrl = "",
  passwordPage = false,
): Record<string, string> {
  const connections = ["'self'"];
  if (apiBaseUrl && !passwordPage) {
    const api = new URL(apiBaseUrl);
    if (
      !["https:", "http:"].includes(api.protocol) ||
      api.username ||
      api.password
    )
      throw new Error("Invalid public API origin");
    connections.push(api.origin);
  }
  if (development) connections.push("ws:", "wss:");

  return {
    "Content-Security-Policy": [
      passwordPage ? "default-src 'none'" : "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      passwordPage ? "img-src 'self'" : "img-src 'self' https: data: blob:",
      passwordPage ? "media-src 'none'" : "media-src 'self' https: blob:",
      "font-src 'self' data:",
      `connect-src ${connections.join(" ")}`,
      passwordPage
        ? "frame-src 'none'"
        : "frame-src https://vk.com https://vk.ru https://vkvideo.ru https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'none'",
      passwordPage ? "form-action 'none'" : "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    "X-Frame-Options": "DENY",
    // YouTube embeds need the embedding origin; full paths are not sent abroad.
    "Referrer-Policy": passwordPage
      ? "no-referrer"
      : "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    // A cached document must never be paired with a new response's nonce.
    "Cache-Control": "private, no-store, max-age=0",
  };
}
