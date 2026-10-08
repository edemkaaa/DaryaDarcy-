export function asProdamusRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function nestPhpParams(flat: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = Object.create(null);
  for (const [rawKey, value] of Object.entries(flat)) {
    const keys = rawKey.replace(/\]/g, "").split("[");
    // Parsing happens before authentication; never traverse inherited objects.
    if (
      keys.some((key) =>
        ["__proto__", "constructor", "prototype"].includes(key),
      )
    )
      continue;
    let current: Record<string, unknown> = root;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (i === keys.length - 1) {
        current[key] = value;
        break;
      }
      const next = current[key];
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        current[key] = Object.create(null);
      }
      current = current[key] as Record<string, unknown>;
    }
  }
  return root;
}

function flattenQuery(query: Record<string, unknown>): Record<string, string> {
  const flat: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string")
      flat[key] = value[0];
  }
  return flat;
}

export function parseProdamusPayload(
  query: Record<string, unknown>,
  body: unknown,
): Record<string, unknown> {
  const fromQuery = nestPhpParams(flattenQuery(query));
  let raw = "";
  if (Buffer.isBuffer(body)) raw = body.toString("utf8");
  else if (typeof body === "string") raw = body;
  else if (body && typeof body === "object" && !Array.isArray(body)) {
    return { ...fromQuery, ...asProdamusRecord(body) };
  }
  if (!raw.trim()) return fromQuery;
  try {
    return { ...fromQuery, ...asProdamusRecord(JSON.parse(raw)) };
  } catch {
    return {
      ...fromQuery,
      ...nestPhpParams(Object.fromEntries(new URLSearchParams(raw))),
    };
  }
}
