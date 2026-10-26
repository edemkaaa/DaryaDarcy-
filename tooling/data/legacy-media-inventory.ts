import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const reference = z
  .object({
    kind: z.enum([
      "postPhoto",
      "postMedia",
      "postPoster",
      "commentPhoto",
      "articleMedia",
      "publicReference",
    ]),
    id: z.number().int().positive(),
    slot: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-zA-Z0-9._-]+$/),
    access: z.enum(["public", "restricted", "unpublished", "unknown"]),
    url: z.string().min(1).max(8192),
  })
  .strict();
const snapshotSchema = z
  .object({
    version: z.literal(1),
    coverage: z.array(z.string().min(1).max(128)).min(1).max(64),
    references: z.array(reference).max(100_000),
  })
  .strict();

function identify(value: string) {
  const fingerprint = createHash("sha256").update(value).digest("hex");
  // A protected reference is not evidence that its DB binding/object is ready.
  if (
    /^\/api\/media\/(?:content-files|post-attachments|library-files)\/[a-zA-Z0-9/_-]+$/.test(
      value,
    )
  )
    return { fingerprint, location: value, kind: "protected" };
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      /[\s\\]/.test(value) ||
      /%/i.test(url.pathname)
    )
      return { fingerprint, kind: "ambiguous" };
    if (
      url.protocol !== "https:" ||
      url.host !== "s3.twcstorage.ru" ||
      !url.pathname.startsWith("/daryadarcy-s3/")
    )
      return { fingerprint, kind: "external" };
    const key = url.pathname.slice("/daryadarcy-s3/".length);
    if (
      !key ||
      /(?:^|\/)private(?:[-/]|$)/i.test(key) ||
      /\/\//.test(key) ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)
    )
      return { fingerprint, kind: "ambiguous" };
    // Host casing and an explicit :443 must not conceal shared public use.
    return {
      fingerprint: createHash("sha256").update(url.href).digest("hex"),
      location: url.href,
      kind: "legacy-s3",
    };
  } catch {
    return { fingerprint, kind: "ambiguous" };
  }
}

/** Metadata only: no DB/S3 client, network requests, mutation mode or deletion approval. */
export function inventoryLegacyMedia(input: unknown) {
  const snapshot = snapshotSchema.parse(input);
  const slots = new Set<string>();
  const groups = new Map<
    string,
    {
      asset: ReturnType<typeof identify>;
      references: Omit<z.infer<typeof reference>, "url">[];
    }
  >();
  for (const { url, ...ref } of snapshot.references) {
    const slot = `${ref.kind}:${ref.id}:${ref.slot}`;
    if (slots.has(slot)) throw new Error("Duplicate reference slot");
    slots.add(slot);
    const asset = identify(url);
    const group = groups.get(asset.fingerprint) ?? { asset, references: [] };
    group.references.push(ref);
    groups.set(asset.fingerprint, group);
  }
  return {
    version: 1,
    coverage: [...new Set(snapshot.coverage)].sort(),
    referenceCount: snapshot.references.length,
    scope:
      "metadata-only; coverage is declared by the exporter, not verified; no retirement authorized",
    groups: [...groups.values()]
      .map(({ asset, references }) => {
        const accesses = new Set(references.map((ref) => ref.access));
        const classification =
          asset.kind === "protected"
            ? "protected-reference"
            : asset.kind !== "legacy-s3" || accesses.has("unknown")
              ? "manual-review"
              : accesses.has("public") && accesses.has("restricted")
                ? "shared-public"
                : accesses.has("public")
                  ? "public-only"
                  : accesses.has("restricted")
                    ? "restricted-candidate"
                    : "unpublished-only";
        return {
          ...asset,
          classification,
          retirementAllowed: false,
          references: references.sort((a, b) =>
            `${a.kind}:${a.id}:${a.slot}`.localeCompare(
              `${b.kind}:${b.id}:${b.slot}`,
            ),
          ),
        };
      })
      .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)),
  };
}

async function main(args: string[]) {
  if (
    args.length !== 4 ||
    args[0] !== "--input" ||
    args[2] !== "--output" ||
    !args[1] ||
    !args[3]
  )
    throw new Error("Expected --input metadata.json --output new-report.json");
  const input = await open(resolve(args[1]), "r");
  let bytes: Buffer;
  try {
    // Read at most the bound even if the input grows after stat(). No following output symlinks.
    if (!(await input.stat()).isFile())
      throw new Error("Input must be a regular file");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of input.createReadStream()) {
      total += chunk.length;
      if (total > 32 * 1024 * 1024) throw new Error("Metadata exceeds 32 MiB");
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
  } finally {
    await input.close();
  }
  const report = inventoryLegacyMedia(JSON.parse(bytes.toString("utf8")));
  const output = await open(resolve(args[3]), "wx", 0o600);
  try {
    await output.writeFile(JSON.stringify(report, null, 2) + "\n");
  } finally {
    await output.close();
  }
  console.log(
    JSON.stringify({
      mode: "inventory",
      references: report.referenceCount,
      groups: report.groups.length,
      retirementAllowed: false,
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch(() => {
    console.error(
      "Inventory rejected: check metadata contract, input limit and unused output path; nothing applied.",
    );
    process.exitCode = 1;
  });
