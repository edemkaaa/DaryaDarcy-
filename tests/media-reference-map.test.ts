import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  collectArticleReferences,
  collectMediaSnapshot,
} from "../tooling/lib/media-reference-map";

// Адреса здесь синтетические: отчёт обязан использовать только хеши и явно отмечать неопределённость, пригодность к закрытию URL этим тестом не утверждается.
const shared = "https://storage.example.test/bucket/feed/photos/shared.webp";
const hash = (url: string) => /* Сопоставляет URL по SHA-256, не включая исходный адрес или подпись в отчёт. */ createHash("sha256").update(url).digest("hex");
const article = (sections: unknown, extra = {}) => /* Строит минимальную клубную статью и позволяет менять только проверяемые поля снимка. */ ({
  id: 1,
  access: "club",
  published: 1,
  coverUrl: shared,
  sections,
  ...extra,
});

it("groups a public cover and restricted section without using the upload prefix", () => {
  // Сценарий: Общая обложка и закрытая секция классифицируются по ссылкам, а не по префиксу загрузки.

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
  // Сценарий: Неопубликованная статья остаётся закрытой; учитываются прежние блоки и Markdown-ссылки.

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
  // Сценарий: Неизвестная форма секции и повреждённый JSON сохраняются как диагностика, а не пустой успешный снимок.

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
  // Сценарий: Объект в type не приводится через пользовательский toString.

  expect(
    collectArticleReferences([
      article([{ type: { toString: "not-callable" }, url: shared }]),
    ]).issues,
  ).toEqual(["articles:1.sections:0.unknown-shape"]);
});

it("diagnoses null URL array elements instead of silently dropping them", () => {
  // Сценарий: Null внутри массива URL не теряется молча.

  expect(
    collectArticleReferences([
      article([{ type: "carousel", urls: [shared, null] }]),
    ]).issues,
  ).toEqual(["articles:1.sections:0.urls:1.invalid-url"]);
});
it("rejects unknown visibility metadata without leaking input values", () => {
  // Сценарий: Неизвестная метка доступа вызывает отказ без раскрытия исходного значения.

  expect(() =>
    collectArticleReferences([article([], { access: "PRIVATE_SECRET_VALUE" })]),
  ).toThrow("Invalid article snapshot");
});
it("does not merge query variants or expose signed URL values in its report", () => {
  // Сценарий: Варианты query не объединяются, подписи URL не выводятся в отчёт.

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
  // Сценарий: CLI читает stdin без секретной конфигурации и прекращает работу на неверном вводе.

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
  // Сценарий: Даже корректный JSON сверх байтового бюджета отклоняется без частичного отчёта.

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

it("runs all selected sources through stdin and reports omitted source coverage", () => {
  // Сценарий: Отчёт явно различает полный выбранный набор полей и неполное покрытие источников.

  const run = (content: unknown, inventory?: unknown) =>
    /* Запускает офлайн-сборщик через stdin с минимальным окружением и возвращает разобранный отчёт. */ JSON.parse(
      execFileSync(
        process.execPath,
        [
          "node_modules/tsx/dist/cli.mjs",
          "tooling/scripts/media-reference-map.ts",
        ],
        {
          env: { PATH: process.env.PATH!, NODE_ENV: "test" },
          timeout: 5000,
          input: JSON.stringify({ content, inventory }),
          encoding: "utf8",
        },
      ),
    );
  const content = {
    articles: [article([])],
    posts: [],
    media: [],
    comments: [],
    decoration: { avatars: [], videos: [], seasons: [] },
  };
  const report = run(content);
  expect(report.snapshotCoverage).toEqual({
    selectedFieldsComplete: true,
    missingFields: [],
  });
  expect(report.scope).toBe("content-references-partial-no-object-inventory");
  expect(report.groups[0].references).toEqual(["articles:1.coverUrl"]);
  expect(
    run(content, {
      objects: [{ objectId: "one", urlHashes: [hash(shared)] }],
      externalUrlHashes: [],
    }).objectMap.objects,
  ).toEqual([
    {
      objectId: "one",
      visibility: "public",
      references: ["articles:1.coverUrl"],
    },
  ]);
  const partial = run({
    posts: [
      { id: 1, published: 1, status: "published", target: "feed", photos: [] },
    ],
    media: [],
  });
  expect(partial.snapshotCoverage).toEqual({
    selectedFieldsComplete: false,
    missingFields: [
      "articles",
      "comments",
      "decoration",
      "posts:1.text",
      "posts:1.richText",
    ],
  });
});

it("retains unresolved parent associations instead of labelling their objects unassociated", () => {
  // Сценарий: Отсутствующий родитель сохраняет неопределённость доступа, не превращая объект в бесхозный.

  const report = collectMediaSnapshot(
    {
      articles: [],
      posts: [],
      media: [{ id: 7, postId: 99, url: shared }],
      comments: [{ id: 8, postId: 99, photos: [shared] }],
      decoration: { avatars: [], videos: [], seasons: [] },
    },
    {
      objects: [{ objectId: "referenced-unknown", urlHashes: [hash(shared)] }],
      externalUrlHashes: [],
    },
  );
  expect(report.objectMap?.objects).toEqual([
    {
      objectId: "referenced-unknown",
      visibility: "unknown",
      references: ["post_media:7.url", "post_comments:8.photos:0"],
    },
  ]);
  expect(report.issues).toEqual([
    "post_media:7.parent-not-in-snapshot",
    "post_comments:8.parent-not-in-snapshot",
  ]);
  expect(report.objectMap?.unresolvedUrlHashes).toEqual([]);
});

it("retains known URL fields in unknown article blocks without guessing their visibility", () => {
  // Сценарий: Из неизвестного блока извлекаются известные поля URL без угадывания видимости.

  const report = collectMediaSnapshot(
    {
      articles: [
        article([
          {
            type: "future-video",
            url: shared,
            urls: [shared],
            photos: [shared],
          },
        ]),
      ],
      posts: [],
      media: [],
      comments: [],
      decoration: { avatars: [], videos: [], seasons: [] },
    },
    {
      objects: [{ objectId: "unknown-block", urlHashes: [hash(shared)] }],
      externalUrlHashes: [],
    },
  );
  expect(report.objectMap?.objects).toEqual([
    {
      objectId: "unknown-block",
      visibility: "unknown",
      references: [
        "articles:1.coverUrl",
        "articles:1.sections:0.url",
        "articles:1.sections:0.urls:0",
        "articles:1.sections:0.photos:0",
      ],
    },
  ]);
  expect(report.issues).toEqual(["articles:1.sections:0.unknown-shape"]);
  expect(JSON.stringify(report)).not.toContain(shared);
});

it("reports malformed unknown-block URL fields but retains valid candidates without a cover", () => {
  // Сценарий: Повреждённые поля неизвестного блока диагностируются, корректные кандидаты сохраняются.

  const report = collectArticleReferences([
    article(
      [
        {
          type: "future-video",
          url: "NOT_A_URL_PRIVATE_VALUE",
          urls: [null, shared],
          photos: "NOT_AN_ARRAY_PRIVATE_VALUE",
        },
      ],
      { coverUrl: null },
    ),
  ]);
  expect(report.groups).toEqual([
    {
      urlHash: hash(shared),
      visibility: "unknown",
      references: ["articles:1.sections:0.urls:1"],
    },
  ]);
  expect(report.issues).toEqual([
    "articles:1.sections:0.unknown-shape",
    "articles:1.sections:0.url.invalid-url",
    "articles:1.sections:0.urls:0.invalid-url",
    "articles:1.sections:0.photos.invalid-array",
  ]);
  expect(JSON.stringify(report)).not.toContain("PRIVATE_VALUE");
  expect(JSON.stringify(report)).not.toContain(shared);
});

it.each([shared, shared + "/public-alias"])(
  "keeps unknown parent evidence unresolved when a public reference uses %s",
  (publicUrl) => {
    // Сценарий: Публичная ссылка не отменяет неопределённость другой ссылки с отсутствующим родителем.

    const content = {
      articles: [article([], { coverUrl: publicUrl })],
      posts: [],
      media: [{ id: 7, postId: 99, url: shared }],
      comments: [],
      decoration: { avatars: [], videos: [], seasons: [] },
    };
    const inventory = {
      objects: [
        {
          objectId: "mixed-evidence",
          urlHashes: [...new Set([hash(shared), hash(publicUrl)])],
        },
      ],
      externalUrlHashes: [],
    };
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "tooling/scripts/media-reference-map.ts",
      ],
      {
        input: JSON.stringify({ content, inventory }),
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout);
    expect(report.objectMap.objects).toEqual([
      {
        objectId: "mixed-evidence",
        visibility: "unknown",
        references:
          publicUrl === shared
            ? ["articles:1.coverUrl", "post_media:7.url"]
            : ["post_media:7.url", "articles:1.coverUrl"],
      },
    ]);
    expect(
      report.groups.find(
        (group: { urlHash: string }) => group.urlHash === hash(shared),
      ).visibility,
    ).toBe("unknown");
    expect(report.issues).toEqual(["post_media:7.parent-not-in-snapshot"]);
    expect(result.stdout).not.toContain(shared);
  },
);

it("maps explicit object identities and external hashes without guessing from URL prefixes", () => {
  // Сценарий: Объекты и внешние ресурсы связываются только явно заданными идентификаторами и хешами.

  const external = "https://external.example.test/file.webp";
  const input = {
    articles: [
      article([
        { type: "photo", url: shared },
        { type: "photo", url: external },
      ]),
    ],
    posts: [],
    media: [],
    comments: [],
    decoration: { avatars: [], videos: [], seasons: [] },
  };
  const report = collectMediaSnapshot(input, {
    objects: [
      { objectId: "own-shared", urlHashes: [hash(shared)] },
      { objectId: "unassociated", urlHashes: [] },
    ],
    externalUrlHashes: [hash(external)],
  });
  expect(report.objectMap).toEqual({
    scope: "declared-selected-inventory-not-rollout",
    objects: [
      {
        objectId: "own-shared",
        visibility: "shared",
        references: ["articles:1.coverUrl", "articles:1.sections:0.url"],
      },
      {
        objectId: "unassociated",
        visibility: "unassociated-in-snapshot",
        references: [],
      },
    ],
    externalReferences: [
      { urlHash: hash(external), references: ["articles:1.sections:1.url"] },
    ],
    unresolvedUrlHashes: [],
  });
});
it("rejects ambiguous object aliases and retains unmatched URL hashes as unresolved, never orphan", () => {
  // Сценарий: Неоднозначные псевдонимы отклоняются; несопоставленный хеш не считается безопасным для удаления.

  const input = { articles: [article([])], posts: [], media: [] };
  const report = collectMediaSnapshot(input, {
    objects: [],
    externalUrlHashes: [],
  });
  expect(report.objectMap?.unresolvedUrlHashes).toEqual([hash(shared)]);
  expect(() =>
    collectMediaSnapshot(input, {
      objects: [
        { objectId: "one", urlHashes: [hash(shared)] },
        { objectId: "two", urlHashes: [hash(shared)] },
      ],
      externalUrlHashes: [],
    }),
  ).toThrow("Invalid media inventory");
});
