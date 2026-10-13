async function boundedBody(response, maxBytes) {
  const chunks = [];
  let size = 0;
  try {
    if (!response.ok || !response.body) throw new Error("upstream unavailable");
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > maxBytes) throw new Error("upstream reply too large");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, size);
  } finally {
    if (response.body && !response.body.locked)
      await response.body.cancel().catch(() => {});
  }
}

export async function readPublicCatalog(url, signal) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.any([
      AbortSignal.timeout(5000),
      ...(signal ? [signal] : []),
    ]),
  });
  const payload = JSON.parse(
    (await boundedBody(response, 2 * 1024 ** 2)).toString("utf8"),
  );
  const rows = payload?.result?.data?.json;
  if (
    !Array.isArray(rows) ||
    rows.length > 1000 ||
    rows.some(
      (row) =>
        !row ||
        typeof row.youtubeId !== "string" ||
        !/^[\w-]{11}$/.test(row.youtubeId) ||
        typeof row.published !== "boolean",
    )
  )
    throw new Error("invalid catalog");
  // Legacy authority has no access/provider fields; explicit private or unknown
  // policy must not be erased into a public-looking record by normalization.
  return rows
    .filter(
      (row) =>
        (row.access === undefined || row.access === "public") &&
        (row.provider === undefined || row.provider === "youtube"),
    )
    .map(({ youtubeId, published }) => ({ youtubeId, published }));
}

export async function readThumbnail(id, signal, request = fetch) {
  if (!/^[\w-]{11}$/.test(id)) throw new Error("invalid video id");
  const response = await request(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, {
    redirect: "error",
    signal: AbortSignal.any([
      AbortSignal.timeout(8000),
      ...(signal ? [signal] : []),
    ]),
  });
  const image = await boundedBody(response, 1024 ** 2);
  if (
    response.headers.get("content-type")?.split(";")[0] !== "image/jpeg" ||
    image.length < 3 ||
    image[0] !== 0xff ||
    image[1] !== 0xd8 ||
    image[2] !== 0xff
  )
    throw new Error("invalid thumbnail");
  return image;
}

/** Cache validated public thumbnail bytes only. Publication is still checked
 * by the HTTP handler before AND after every read, including cache hits. */
export function createThumbnailReader({
  load = readThumbnail,
  now = Date.now,
  ttlMs = 60_000,
  maxBytes = 2 * 1024 ** 2,
  maxEntries = 64,
} = {}) {
  const entries = new Map();
  let bytes = 0;
  const remove = (id) => {
    const entry = entries.get(id);
    if (entry) bytes -= entry.image.length;
    entries.delete(id);
  };
  return async (id, signal) => {
    signal?.throwIfAborted();
    if (!/^[\w-]{11}$/.test(id)) throw new Error("invalid video id");
    const cached = entries.get(id);
    if (cached && cached.expiresAt > now()) return cached.image;
    remove(id);
    const image = await load(id, signal);
    signal?.throwIfAborted();
    if (image.length > maxBytes) return image;
    // A concurrent request may have populated this key while we fetched.
    remove(id);
    while (
      entries.size &&
      (entries.size >= maxEntries || bytes + image.length > maxBytes)
    )
      remove(entries.keys().next().value);
    entries.set(id, { image, expiresAt: now() + ttlMs });
    bytes += image.length;
    return image;
  };
}
