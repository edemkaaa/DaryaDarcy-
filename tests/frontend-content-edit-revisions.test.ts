import { describe, expect, it, vi } from "vitest";
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import {
  serializePostDraft,
  postDraftSnapshot,
  type PostDraft,
} from "../apps/frontend/src/domain/post/draft";
import { assertPostTextSize } from "../apps/frontend/src/domain/post/text-limit";
import { ApiError } from "../apps/frontend/src/shared/api/errors";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import {
  captureEditBase,
  matchesEditableWrite,
  readEditRevision,
  withExpectedRevision,
} from "../apps/frontend/src/domain/content/edit-revision";
import { parseArticleCreationRecord } from "../apps/frontend/src/domain/content/article-creation-journal";

const draft: PostDraft = {
  text: "original",
  photos: [],
  videos: [],
  tags: [],
  status: "published",
  target: "club",
  scheduledAt: null,
  publishedAt: new Date("2026-10-27T12:00:00Z"),
  sortOrder: 5,
};
const original = postDraftSnapshot(draft);
const edited = { ...original, text: "my text" };
const task = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;
function fixture() {
  return {
    create: vi.fn(async (_input: object, _signal: AbortSignal) => 42),
    update: vi.fn(
      async (_id: number, _input: object, _signal: AbortSignal) => ({
        success: true,
      }),
    ),
    upload: vi.fn(),
    read: vi.fn(async (_id: number, _signal: AbortSignal) => ({
      id: 42,
      ...edited,
      media: [],
      editRevision: "server-next",
    })),
  };
}

describe("documented UTF-8 text limit", () => {
  it.each([
    "a".repeat(65535),
    "я".repeat(32767) + "a",
    "🧶".repeat(16383) + "aaa",
  ])("accepts exactly 65535 bytes (%#)", (text) => {
    expect(new TextEncoder().encode(text).byteLength).toBe(65535);
    expect(() => assertPostTextSize(text)).not.toThrow();
    expect(serializePostDraft({ ...draft, text }).text).toBe(text);
  });
  it.each(["a".repeat(65536), "я".repeat(32768), "🧶".repeat(16384)])(
    "retains an overlong draft but blocks submission (%#)",
    (text) => {
      expect(postDraftSnapshot({ ...draft, text }).text).toBe(text);
      expect(() => serializePostDraft({ ...draft, text })).toThrow("65 535");
    },
  );
  it("rejects before capability probes, uploads, or writes, including a replayed create", async () => {
    const api = { ...fixture(), checkUploadsAvailable: vi.fn() };
    const value = { ...edited, text: "я".repeat(32768) };
    const coordinator = new PostSaveCoordinator();
    await expect(coordinator.save(value, [], [], api, task())).rejects.toThrow(
      "65 535",
    );
    expect(api.checkUploadsAvailable).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    coordinator.restore({
      ...coordinator.snapshot(),
      phase: "create",
      creationIntent: {
        key: "original-key-123456",
        payloadJson: JSON.stringify(value),
      },
    });
    await expect(coordinator.recoverCreation(api, task())).rejects.toThrow(
      "65 535",
    );
    expect(api.create).not.toHaveBeenCalled();
  });
});

it("restores the original revision instead of borrowing a newer detail revision", async () => {
  const old = new PostSaveCoordinator(42, original, "opaque:old");
  const state = structuredClone(old.snapshot());
  const restored = new PostSaveCoordinator(
    42,
    { ...original, text: "someone else" },
    "opaque:new",
  );
  restored.restore(state);
  const api = fixture();
  await restored.save(edited, [], [], api, task());
  expect(api.update.mock.calls[0]).toEqual([
    42,
    { text: "my text", richText: null, expectedRevision: "opaque:old" },
    expect.any(AbortSignal),
  ]);
  expect(api.read).toHaveBeenCalledTimes(1);
});

it.each([409, 412])(
  "keeps a rejected revision and input until a deliberate comparison decision (%s)",
  async (status) => {
    const api = fixture();
    api.update.mockRejectedValueOnce(new ApiError("conflict", status));
    api.read.mockResolvedValue({
      id: 42,
      ...original,
      text: "someone else",
      media: [],
      editRevision: "opaque:new",
    });
    const coordinator = new PostSaveCoordinator(42, original, "opaque:old");
    const checkpoint = vi.fn(async () => {});
    coordinator.setCheckpoint(checkpoint);
    await expect(
      coordinator.save(edited, [], [], api, task()),
    ).rejects.toMatchObject({ data: { httpStatus: status } });
    const stored = structuredClone(coordinator.snapshot());
    expect(stored).toMatchObject({
      editRevision: "opaque:old",
      editConflict: status,
      attemptedUpdate: { text: "my text" },
      original,
    });
    const restored = new PostSaveCoordinator(42, original, "new-from-opening");
    restored.restore(stored);
    restored.setCheckpoint(checkpoint);
    await expect(restored.save(edited, [], [], api, task())).rejects.toThrow();
    const server = await restored.compareUpdate(api, task());
    expect(restored.snapshot().editRevision).toBe("opaque:old");
    expect(api.update).toHaveBeenCalledTimes(1);
    await restored.acceptComparedRevision(server);
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(restored.snapshot().original).toEqual(original);
    await restored.save(edited, [], [], api, task());
    expect(api.update.mock.calls[1]).toEqual([
      42,
      { text: "my text", richText: null, expectedRevision: "opaque:new" },
      expect.any(AbortSignal),
    ]);
  },
);

it.each([
  new TypeError("lost response"),
  new ApiError("conflict after prior commit", 409),
])(
  "recognizes an already recorded result by reading, without another write (%#)",
  async (cause) => {
    const api = fixture();
    api.update.mockRejectedValueOnce(cause);
    const coordinator = new PostSaveCoordinator(42, original, "old");
    await expect(
      coordinator.save(edited, [], [], api, task()),
    ).rejects.toThrow();
    await coordinator.compareUpdate(api, task());
    expect(coordinator.snapshot().phase).toBe("complete");
    expect(api.update).toHaveBeenCalledTimes(1);
    await expect(coordinator.save(edited, [], [], api, task())).rejects.toThrow(
      "уже сохранена",
    );
  },
);

it("a failed post-ACK read never unlocks another mutation", async () => {
  const api = fixture();
  api.read.mockRejectedValueOnce(new TypeError("offline"));
  const coordinator = new PostSaveCoordinator(42, original, "old");
  await expect(coordinator.save(edited, [], [], api, task())).rejects.toThrow(
    "сохранена",
  );
  expect(coordinator.snapshot().phase).toBe("complete");
  await expect(coordinator.save(edited, [], [], api, task())).rejects.toThrow(
    "уже сохранена",
  );
  expect(api.update).toHaveBeenCalledTimes(1);
});

it("keeps a missing legacy revision missing on restore and never adopts it from comparison", async () => {
  const coordinator = new PostSaveCoordinator(42, original, "new");
  coordinator.restore({ ...coordinator.snapshot(), editRevision: undefined });
  const api = fixture();
  api.update.mockRejectedValueOnce(new ApiError("revision required", 412));
  await expect(coordinator.save(edited, [], [], api, task())).rejects.toThrow();
  expect(api.update.mock.calls[0][1]).not.toHaveProperty("expectedRevision");
  await coordinator.compareUpdate(
    {
      ...api,
      read: async () => ({
        id: 42,
        ...original,
        media: [],
        editRevision: "new",
      }),
    },
    task(),
  );
  expect(coordinator.snapshot().editRevision).toBeUndefined();
});

it("never accepts a same-version unresolved write just because a GET is still old", async () => {
  const coordinator = new PostSaveCoordinator(42, original, "old");
  const api = fixture();
  api.update.mockRejectedValueOnce(new TypeError("offline"));
  await expect(coordinator.save(edited, [], [], api, task())).rejects.toThrow();
  await expect(
    coordinator.acceptComparedRevision({
      id: 42,
      ...original,
      media: [],
      editRevision: "old",
    }),
  ).rejects.toThrow("ещё может");
});

it("does not transfer a late read to another owner", async () => {
  const scope = new OperationScope();
  const operation = scope.begin(
    "compare",
    new AbortController().signal,
    () => true,
  )!;
  const coordinator = new PostSaveCoordinator(42, original, "old");
  const api = fixture();
  api.read.mockImplementation(async () => {
    scope.cancel();
    return { id: 42, ...edited, media: [], editRevision: "new" };
  });
  await expect(coordinator.compareUpdate(api, operation)).rejects.toMatchObject(
    { name: "AbortError" },
  );
  expect(coordinator.snapshot().phase).toBe("idle");
});

it("preserves article revisions and original snapshots without imposing the post text limit", () => {
  const payload = {
    title: "Article",
    access: "club",
    published: true,
    coverUrl: null,
    sections: [{ type: "text", text: "я".repeat(70000) }],
  };
  const editBase = captureEditBase({ editRevision: "opaque:article" }, payload);
  const stored = parseArticleCreationRecord(
    {
      version: 1,
      ownerId: 101,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      payload,
      editBase,
    },
    101,
  );
  expect(stored.editBase).toEqual(editBase);
  expect(stored.payload).toEqual(payload);
  expect(
    withExpectedRevision(
      { id: 7, published: false },
      stored.editBase?.revision,
    ),
  ).toEqual({ id: 7, published: false, expectedRevision: "opaque:article" });
});

it("compares actual fields and dates conservatively, including retained and removed media", () => {
  const detail = {
    ...edited,
    publishedAt: new Date(edited.publishedAt!),
    media: [
      {
        id: 5,
        type: "audio",
        url: "/audio",
        filename: "a.mp3",
        mimeType: "audio/mpeg",
        fileSize: 5,
      },
    ],
  };
  expect(
    matchesEditableWrite(
      detail,
      {
        text: edited.text,
        publishedAt: edited.publishedAt,
        removedMediaIds: [6],
      },
      "post",
    ),
  ).toBe(true);
  expect(matchesEditableWrite(detail, { removedMediaIds: [5] }, "post")).toBe(
    false,
  );
  expect(
    matchesEditableWrite(detail, { privateAssetIds: ["hidden"] }, "post"),
  ).toBe(false);
  expect(() => readEditRevision({ editRevision: 1 })).toThrow();
});
