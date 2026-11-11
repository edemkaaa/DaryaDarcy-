/** Opaque editRevision проверяется как hash содержимого и вложений, отдельно от updatedAt и strict rollout. */
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  articleEditRevision,
  expectedEditRevision,
  postEditRevision,
} from "../apps/backend/src/content/content-edit-revision";
import type { Post, PostMedia } from "../packages/database/src/schema";
import type {
  ApiInputs,
  ApiOutputs,
} from "../apps/frontend/src/shared/api/types";

const post: Post = {
  id: 1,
  publicId: "c22db58f-698b-41ea-8e12-524d8323b034",
  text: "Body",
  photos: [],
  tags: [],
  source: "manual",
  instagramId: null,
  sortOrder: 0,
  published: false,
  status: "draft",
  target: "feed",
  scheduledAt: null,
  publishedAt: null,
  richText: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const media: PostMedia = {
  id: 1,
  postId: 1,
  type: "video",
  url: "https://example.test/video.mp4",
  posterUrl: null,
  filename: null,
  mimeType: "video/mp4",
  fileSize: 1024,
  duration: 10,
  sortOrder: 0,
  createdAt: new Date(0),
};

/** Синтетические snapshots позволяют проверить revision без реальной записи или миграции. */
describe("opaque edit snapshot revisions", () => {
  /** Возвращаем strict-mode env. */
  afterEach(() => vi.unstubAllEnvs());
  /** Порядок SQL-строк не меняет hash; изменение сохранённого sortOrder меняет. */
  it("ignores query order while detecting an actual attachment reorder", () => {
    const other = { ...media, id: 2, sortOrder: 1 };
    expect(postEditRevision(post, [media, other])).toBe(
      postEditRevision(post, [other, media]),
    );
    expect(postEditRevision(post, [media, other])).not.toBe(
      postEditRevision(post, [
        { ...media, sortOrder: 1 },
        { ...other, sortOrder: 0 },
      ]),
    );
  });
  /** Текст, расписание и poster входят в revision, даже если timestamp не изменился. */
  it("detects body, schedule and poster edits with the same timestamp", () => {
    const initial = postEditRevision(post, [media]);
    expect(postEditRevision({ ...post, text: "Fresh" }, [media])).not.toBe(
      initial,
    );
    expect(
      postEditRevision({ ...post, scheduledAt: new Date(1000) }, [media]),
    ).not.toBe(initial);
    expect(
      postEditRevision(post, [
        { ...media, posterUrl: "/api/media/content-files/new" },
      ]),
    ).not.toBe(initial);
  });
  /** Revision различает запись/содержимое, но не порядок ключей эквивалентного JSON. */
  it("is scoped to the record and canonicalizes JSON key ordering", () => {
    expect(postEditRevision({ ...post, id: 2 }, [])).not.toBe(
      postEditRevision(post, []),
    );
    const article = {
      id: 3,
      title: "Title",
      coverUrl: null,
      access: "club" as const,
      published: true,
      sortOrder: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      sections: [{ type: "text" as const, text: "Body", url: "" }],
    };
    expect(articleEditRevision(article)).toBe(
      articleEditRevision({
        ...article,
        sections: [{ url: "", text: "Body", type: "text" }],
      }),
    );
    expect(articleEditRevision(article)).not.toBe(
      articleEditRevision({ ...article, title: "Fresh" }),
    );
  });
  /** Внутренний вызов без options допустим; клиентский options без expectedRevision в strict-mode отвергается. */
  it("strict mode distinguishes internal current-state commands from client edits", () => {
    vi.stubEnv("CONTENT_EDIT_REVISIONS_REQUIRED", "true");
    expect(expectedEditRevision()).toBeUndefined();
    expect(() => expectedEditRevision({})).toThrow(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }),
    );
    const expectedRevision = "a".repeat(64);
    expect(expectedEditRevision({ expectedRevision })).toBe(expectedRevision);
  });
  /** Server details и generated client edit inputs не теряют revision-поля. */
  it("preserves versions in the generated API types", () => {
    expectTypeOf<
      NonNullable<ApiOutputs["admin"]["postDetail"]>["editRevision"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      NonNullable<ApiOutputs["admin"]["articleDetail"]>["editRevision"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ApiInputs["admin"]["updatePost"]["expectedRevision"]
    >().toEqualTypeOf<string | undefined>();
    expectTypeOf<
      ApiInputs["admin"]["updateArticle"]["expectedRevision"]
    >().toEqualTypeOf<string | undefined>();
  });
});
