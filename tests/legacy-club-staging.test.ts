/** План старого переноса привязан к утверждённому dump/серверу и не является общим разрешением менять любую staging БД. */
import { describe, expect, it } from "vitest";
import {
  assertLegacyClubStagingIdentity,
  assertLegacyClubStagingConnection,
  assertLegacyClubSchemaProfile,
} from "../tooling/operations/import-legacy-club";
import {
  prepareLegacyClubContent,
  prepareLegacyClubStagingContent,
} from "../tooling/data/legacy-club-import";

/** Собираем минимальный известный snapshot с одним просроченным и одним другим scheduled постом. */
function source() {
  const post = {
    id: 928,
    text: "Old scheduled post",
    photos: [],
    tags: ["life"],
    source: "manual",
    instagramId: null,
    sortOrder: 5,
    published: 0,
    status: "scheduled",
    target: "club",
    scheduledAt: "2026-10-19 07:00:00",
    publishedAt: null,
    richText: null,
    createdAt: "2026-09-30 12:00:00",
    updatedAt: "2026-10-12 10:00:00",
  };
  return {
    sourceSha256:
      "2b2ccad2b74c74b2098760e168ea2c6daedacc62fff8957427095dfc27e3aa8b",
    posts: [post, { ...post, id: 932, scheduledAt: "2026-10-26 07:00:00" }],
    articles: [],
    media: [],
  };
}
/** Исключение разрешено только для конкретной старой записи 928 из закреплённого source hash. */
describe("approved staging import draft policy", () => {
  /** Просроченный пост становится draft без scheduledAt; соседняя запись и исходный input не мутируются. */
  it("keeps only source928 as a non-scheduled draft, leaving original input and other post intact", () => {
    const input = source();
    const before = structuredClone(input);
    const result = prepareLegacyClubStagingContent(input);
    expect(result.posts[0]).toEqual({
      ...prepareLegacyClubContent(input).posts[0],
      status: "draft",
      published: 0,
      scheduledAt: null,
    });
    expect(result.posts[1]).toEqual(prepareLegacyClubContent(input).posts[1]);
    expect(input).toEqual(before);
  });
  /** Другой dump hash или расписание не получают историческое исключение автоматически. */
  it("refuses another source snapshot or changed overdue identity rather than silently editing it", () => {
    const changed = source();
    changed.sourceSha256 = "a".repeat(64);
    expect(() => prepareLegacyClubStagingContent(changed)).toThrow(
      /approved source/i,
    );
    const rescheduled = source();
    rescheduled.posts[0].scheduledAt = "2026-10-20 07:00:00";
    expect(() => prepareLegacyClubStagingContent(rescheduled)).toThrow(
      /overdue post/i,
    );
  });
});

/** Сверяются schema/server/version/table count/history и connection driver options до переноса. */
describe("fixed staging identity guard", () => {
  const correct = {
    schema: "daryadarcy_candidate_20261019",
    uuid: "2a41f961-c168-11f1-8660-0a4124b25f9f",
    version: "8.4.4",
    tables: 40,
    history: 42,
  };
  /** Каждое отклонение от зафиксированной old staging identity запрещено. */
  it("accepts only the verified database identity and current schema profile", () => {
    expect(() => assertLegacyClubStagingIdentity(correct)).not.toThrow();
    for (const changed of [
      { schema: "daryadarcy_staging" },
      { uuid: "another-server" },
      { version: "5.7.0" },
      { tables: 39 },
      { history: 41 },
    ])
      expect(() =>
        assertLegacyClubStagingIdentity({ ...correct, ...changed }),
      ).toThrow(/staging identity/i);
  });
  /** Разрешён только известный charset, не подмена host/schema или multi-statements. */
  it("retains the existing utf8mb4 option but refuses alternate hosts, databases and unsafe driver options", () => {
    const uri =
      "mysql://operator:local-placeholder@mysql:3306/daryadarcy_candidate_20261019";
    expect(() =>
      assertLegacyClubStagingConnection(uri + "?charset=utf8mb4"),
    ).not.toThrow();
    for (const changed of [
      uri.replace("@mysql:", "@remote:"),
      uri.replace("candidate_20261019", "staging"),
      uri + "?multipleStatements=true",
      uri + "?charset=utf8mb4&multipleStatements=true",
    ])
      expect(() => assertLegacyClubStagingConnection(changed)).toThrow(
        /staging connection/i,
      );
  });
  /** Структура и миграционная история фиксируются, а свежие users-данные допускаются только через отдельный backup-bound план. */
  it("pins schema/history while a final backup-bound plan preserves newer user rows", () => {
    const profile = {
      schemaHash: "schema",
      baseline: {
        __drizzle_migrations: { rows: 42, sha256: "history" },
        users: { rows: 7, sha256: "earlier" },
      },
    };
    const latest = {
      ...profile,
      baseline: {
        ...profile.baseline,
        users: { rows: 7, sha256: "latest-user-profile" },
      },
    };
    expect(() => assertLegacyClubSchemaProfile(latest, profile)).not.toThrow();
    expect(() =>
      assertLegacyClubSchemaProfile(
        { ...latest, schemaHash: "changed" },
        profile,
      ),
    ).toThrow();
    expect(() =>
      assertLegacyClubSchemaProfile(
        {
          ...latest,
          baseline: {
            ...latest.baseline,
            __drizzle_migrations: { rows: 42, sha256: "changed" },
          },
        },
        profile,
      ),
    ).toThrow();
  });
});
