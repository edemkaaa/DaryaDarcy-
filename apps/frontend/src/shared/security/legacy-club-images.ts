/** Манифест старых клубных изображений читается на сервере; клиентская сборка не должна включать доступ к файловой системе. */
// Server configuration only. Node filesystem access deliberately prevents client use.
import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { createHash } from "node:crypto";

type Manifest = {
  version: 1;
  endpoint: string;
  bucket: string;
  denyKeys: string[];
  preservedKeys: string[];
};
type Rules = { origin: string; bucket: string; denied: Set<string> };
let cached: { identity: string; rules: Rules } | undefined;

function validKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= 2048 &&
    !/[\x00-\x1f\x7f\\%]/.test(key) &&
    !key.startsWith("/") &&
    !key.split("/").some((part) => !part || part === "." || part === "..")
  );
}

function loadRules(path: string, digest: string): Rules {
  const identity = `${path}:${digest}`;
  if (cached?.identity === identity) return cached.rules;
  if (
    !isAbsolute(path) ||
    !/^[a-f0-9]{64}$/.test(digest) ||
    statSync(path).size > 256 * 1024
  )
    throw new Error("Invalid legacy image configuration");
  const bytes = readFileSync(path);
  if (createHash("sha256").update(bytes).digest("hex") !== digest)
    throw new Error("Legacy image manifest mismatch");
  const data: Manifest = JSON.parse(bytes.toString("utf8"));
  if (
    data?.version !== 1 ||
    data.endpoint !== "https://s3.twcstorage.ru" ||
    data.bucket !== "daryadarcy-s3" ||
    !Array.isArray(data.denyKeys) ||
    !Array.isArray(data.preservedKeys) ||
    !data.denyKeys.length ||
    !data.denyKeys.every(validKey) ||
    !data.preservedKeys.every(validKey)
  )
    throw new Error("Invalid legacy image manifest");
  const denied = new Set(data.denyKeys);
  if (
    denied.size !== data.denyKeys.length ||
    new Set(data.preservedKeys).size !== data.preservedKeys.length ||
    data.preservedKeys.some((key) => denied.has(key))
  )
    throw new Error("Conflicting legacy image keys");
  const rules = { origin: data.endpoint, bucket: data.bucket, denied };
  cached = { identity, rules };
  return rules;
}

/** Unwrap an encoded URL, then decode its path separately: encoded '?' is part of a key. */
function sourceKey(value: string, rules: Rules): string | null {
  let source = value;
  for (
    let depth = 0;
    !/^(?:https?:\/\/|\/)/i.test(source) && depth < 4;
    depth++
  ) {
    const next = decodeURIComponent(source);
    if (next === source) break;
    source = next;
  }
  if (/[\x00-\x20\x7f\\]/.test(source)) throw new Error("Invalid image URL");
  // Local optimized assets are not legacy S3 objects.
  if (source.startsWith("/") && !source.startsWith("//")) return null;
  // WHATWG URL accepts https:/host and https:////host, but raw path extraction
  // does not. Reject these aliases before Next normalizes them into a cache hit.
  if (!/^https?:\/\/[^/?#]+(?:[/?#]|$)/i.test(source))
    throw new Error("Invalid image URL");
  const url = new URL(source);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Invalid image URL");
  if (url.origin !== rules.origin) return null;
  const rawPath = source.replace(/^https?:\/\/[^/?#]+/i, "").split(/[?#]/)[0];
  const path = decodeURIComponent(rawPath);
  // Reject ambiguous/double path encoding and traversal rather than guessing an object.
  if (
    /[\x00-\x1f\x7f\\%]/.test(path) ||
    path.split("/").some((part) => part === "." || part === "..")
  )
    throw new Error("Ambiguous image path");
  const prefix = `/${rules.bucket}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : null;
}

/** Called before Next's image cache. Disabled by default, including when a manifest exists. */
export function legacyClubImageStatus(url: URL): 400 | 404 | 503 | undefined {
  if (
    process.env.LEGACY_CLUB_IMAGE_GUARD_ENABLED !== "true" ||
    url.pathname !== "/_next/image"
  )
    return undefined;
  let rules: Rules;
  try {
    rules = loadRules(
      process.env.LEGACY_CLUB_IMAGE_MANIFEST_PATH ?? "",
      process.env.LEGACY_CLUB_IMAGE_MANIFEST_SHA256 ?? "",
    );
  } catch {
    // An explicitly enabled guard must not silently serve old cached content on config failure.
    return 503;
  }
  try {
    const sources = url.searchParams.getAll("url");
    if (sources.length !== 1) return 400;
    const key = sourceKey(sources[0], rules);
    return key !== null && rules.denied.has(key) ? 404 : undefined;
  } catch {
    return 400;
  }
}
