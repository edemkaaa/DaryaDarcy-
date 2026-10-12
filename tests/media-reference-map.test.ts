import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { collectArticleReferences } from "../tooling/lib/media-reference-map";

const shared = "https://storage.example.test/bucket/feed/photos/shared.webp";
const hash = (url: string) => createHash("sha256").update(url).digest("hex");
const article = (sections: unknown, extra = {}) => ({
  id: 1,
  access: "club",
  published: 1,
  coverUrl: shared,
  sections,
  ...extra,
});

it("groups a public cover and restricted section without using the upload prefix", () => {
  const result = collectArticleReferences([
    article([{ type: "photo", url: shared }]),
  ]);
  expect(result.groups).toEqual([
    {
      urlHash: hash(shared),
      visibility: "shared",
      references: ["articles:1.coverUrl", "articles:1.sections:0.url"],
    },
  ]);
  expect(result.issues).toEqual([]);
  expect(result.scope).toBe("articles-only-no-object-inventory");
});
it("keeps unpublished public article references restricted and identifies legacy and markdown links", () => {
  const result = collectArticleReferences([
    article(
      JSON.stringify([
        { heading: "Legacy", photos: [shared], body: `[Download](${shared})` },
      ]),
      { access: "public", published: 0 },
    ),
  ]);
  expect(result.groups).toEqual([
    {
      urlHash: hash(shared),
      visibility: "restricted",
      references: [
        "articles:1.coverUrl",
        "articles:1.sections:0.photos:0",
        "articles:1.sections:0.body.link:0",
      ],
    },
  ]);
});
it("retains unknown or malformed section diagnostics instead of approving an empty map", () => {
  const result = collectArticleReferences([
    article([
      { type: "video", url: shared },
      { type: "carousel", urls: [shared, 12] },
    ]),
  ]);
  expect(result.issues).toEqual([
    "articles:1.sections:0.unknown-shape",
    "articles:1.sections:1.urls:1.invalid-url",
  ]);
  expect(collectArticleReferences([article("not-json")]).issues).toEqual([
    "articles:1.sections.invalid-json",
  ]);
});

it("reports a non-string block kind without coercing user-provided objects", () => {
  expect(
    collectArticleReferences([
      article([{ type: { toString: "not-callable" }, url: shared }]),
    ]).issues,
  ).toEqual(["articles:1.sections:0.unknown-shape"]);
});

it("diagnoses null URL array elements instead of silently dropping them", () => {
  expect(
    collectArticleReferences([
      article([{ type: "carousel", urls: [shared, null] }]),
    ]).issues,
  ).toEqual(["articles:1.sections:0.urls:1.invalid-url"]);
});
it("rejects unknown visibility metadata without leaking input values", () => {
  expect(() =>
    collectArticleReferences([article([], { access: "PRIVATE_SECRET_VALUE" })]),
  ).toThrow("Invalid article snapshot");
});
it("does not merge query variants or expose signed URL values in its report", () => {
  const signed = shared + "?signature=PRIVATE_FIXTURE_SECRET";
  const result = collectArticleReferences([
    article([{ type: "png", url: signed }]),
  ]);
  expect(result.groups.map((g) => g.urlHash)).toEqual([
    hash(shared),
    hash(signed),
  ]);
  expect(result.issues).toEqual([
    "articles:1.sections:0.url.query-or-fragment-needs-object-resolution",
  ]);
  expect(JSON.stringify(result)).not.toContain("PRIVATE_FIXTURE_SECRET");
  expect(JSON.stringify(result)).not.toContain(shared);
});
it("runs the offline stdin collector without configuration and fails closed on invalid input", () => {
  const bin = "node_modules/tsx/dist/cli.mjs";
  const script = "tooling/scripts/media-reference-map.ts";
  const env = { PATH: process.env.PATH!, NODE_ENV: "test" };
  const output = execFileSync(process.execPath, [bin, script], {
    env,
    input: JSON.stringify({
      articles: [article([{ type: "photo", url: shared }])],
    }),
    encoding: "utf8",
  });
  expect(JSON.parse(output).groups[0].visibility).toBe("shared");
  const failed = spawnSync(process.execPath, [bin, script], {
    env,
    input: "PRIVATE_FIXTURE_SECRET",
    encoding: "utf8",
  });
  expect(failed.status).toBe(1);
  expect(failed.stdout).toBe("");
  expect(failed.stderr).toBe("Invalid media reference snapshot\n");
});

it("rejects a valid JSON snapshot exceeding the stdin byte budget without producing partial output", () => {
  const failed = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "tooling/scripts/media-reference-map.ts"],
    {
      env: { PATH: process.env.PATH!, NODE_ENV: "test" },
      input: JSON.stringify({
        articles: [article([{ type: "text", text: "x".repeat(1024 * 1024) }])],
      }),
      encoding: "utf8",
      timeout: 5000,
    },
  );
  expect(failed.status).toBe(1);
  expect(failed.stdout).toBe("");
  expect(failed.stderr).toBe("Invalid media reference snapshot\n");
});
