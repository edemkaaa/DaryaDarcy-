import { expect, expectTypeOf, it } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { libraryFileKey, libraryMaterialKey } from "../apps/backend/src/content/library-files";
import { inspectLibraryMigration } from "../apps/backend/src/content/library-migration-manifest";
import { uploadPrivateContentFile } from "../apps/backend/src/content/private-content-uploads";

it("keeps operator-only library usages out of the existing editor upload contract", () => {
  expectTypeOf<Awaited<ReturnType<typeof uploadPrivateContentFile>>["usage"]>().toEqualTypeOf<
    "postPhoto" | "articlePhoto" | "articleDocument" | "commentPhoto"
  >();
});

const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const document = () => {
  const bytes = Buffer.from("synthetic library document");
  return {
    fileKey: "main",
    filename: "fixture.txt",
    mimeType: "text/plain",
    sha256: hash(bytes),
    bytes,
    sortOrder: 0,
    expectedRevision: 0,
  };
};
it("accepts the seven club aesthetic namespaces without broadening free/public namespaces", async () => {
  for(const key of ["castlecore","cottagecore","darkacademia","fairycore","goblincore","lightacademia","witchcore"]){
    const materialKey=`aesthetic-${key}`;
    expect(libraryMaterialKey(materialKey)).toBe(true);
    await expect(inspectLibraryMigration({materialKey,idempotencyKey:"aesthetic-rehearsal-0001",files:[document()]})).resolves.toMatchObject({materialKey,files:1});
  }
  for(const key of ["houses","horse","loshadka","aesthetic-unknown","aesthetic-castlecore/../houses"])
    expect(libraryMaterialKey(key)).toBe(false);
});
it("maps exactly the audited 220 visual slots without key collisions or a hidden second page",async()=>{
  const registry=JSON.parse(await readFile(new URL("../docs/audits/library-source-map-2026-10-20.json",import.meta.url),"utf8"));
  const slots=new Set<string>(),counts=new Map<string,number>();
  for(const file of registry.visuals.files){
    const match=/^\/assets\/results\/([a-z]+)\/(interiors|moodboards|outfits)\/([a-z0-9-]+)(\.lossless)?\.webp$/.exec(file.uri);
    expect(match).not.toBe(null);
    const material=`aesthetic-${match![1]}`,key=`${match![2]}-${match![3]}`;
    expect(libraryMaterialKey(material)).toBe(true);expect(libraryFileKey(key)).toBe(true);
    expect(slots.has(`${material}/${key}`)).toBe(false);slots.add(`${material}/${key}`);
    counts.set(material,(counts.get(material)??0)+1);
  }
  expect(slots.size).toBe(220);expect(counts.size).toBe(7);
  expect([...counts.values()].every(count=>count<=50)).toBe(true);
});
it("dry-runs a verified manifest without database/storage configuration or exposing bytes and names", async () => {
  const report = await inspectLibraryMigration({
    materialKey: "recipes",
    idempotencyKey: "library-rehearsal-0001",
    files: [document()],
  });
  expect(report).toMatchObject({
    materialKey: "recipes",
    files: 1,
    totalBytes: 26,
  });
  expect(JSON.stringify(report)).not.toMatch(
    /synthetic library document|fixture.txt|base64/,
  );
});
it("rejects byte substitution, duplicate slots, unknown materials and path-like names", async () => {
  for (const input of [
    {
      materialKey: "recipes",
      idempotencyKey: "library-rehearsal-0001",
      files: [{ ...document(), sha256: "0".repeat(64) }],
    },
    {
      materialKey: "recipes",
      idempotencyKey: "library-rehearsal-0001",
      files: [document(), document()],
    },
    {
      materialKey: "unknown",
      idempotencyKey: "library-rehearsal-0001",
      files: [document()],
    },
    {
      materialKey: "recipes",
      idempotencyKey: "library-rehearsal-0001",
      files: [{ ...document(), filename: "../fixture.txt" }],
    },
  ])
    await expect(inspectLibraryMigration(input)).rejects.toThrow();
});
it("validates real image bytes without lossy conversion and rejects disguised active content", async () => {
  const bytes = await sharp({
    create: { width: 3, height: 4, channels: 3, background: "red" },
  })
    .webp({ lossless: true })
    .toBuffer();
  const photo = {
    ...document(),
    fileKey: "holly",
    filename: "fixture.webp",
    mimeType: "image/webp",
    bytes,
    sha256: hash(bytes),
  };
  const input = {
    materialKey: "patterns",
    idempotencyKey: "library-image-fixture-0001",
    files: [photo],
  };
  expect(await inspectLibraryMigration(input)).toMatchObject({
    files: 1,
    totalBytes: bytes.length,
  });
  const hostile = Buffer.from("<svg onload='alert(1)'/>");
  await expect(
    inspectLibraryMigration({
      ...input,
      files: [{ ...photo, bytes: hostile, sha256: hash(hostile) }],
    }),
  ).rejects.toThrow();
});
