import { describe, expect, it } from "vitest";
import { assertLegacyClubStagingIdentity } from "../tooling/operations/import-legacy-club";
import {
  prepareLegacyClubContent,
  prepareLegacyClubStagingContent,
} from "../tooling/data/legacy-club-import";

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
describe("approved staging import draft policy", () => {
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

describe("fixed staging identity guard", () => {
  const correct = {
    schema: "daryadarcy_candidate_20261019",
    uuid: "2a41f961-c168-11f1-8660-0a4124b25f9f",
    version: "8.4.4",
    tables: 40,
    history: 42,
  };
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
});
