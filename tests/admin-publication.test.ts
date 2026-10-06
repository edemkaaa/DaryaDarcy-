import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { savePostEdit } from "../apps/backend/src/content/post-editor";
import type { UpdatePostInput } from "../apps/backend/src/content/post-write-input";
const state = vi.hoisted(() => ({
  update: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("../apps/backend/src/db", () => ({
  savePostEdit: state.update,
  isOwnerAccount: (user: { role: string }) => user.role === "admin",
}));
vi.mock("../apps/backend/src/push", () => ({
  sendMarketingPostNotification: state.notify,
}));
import { createAdminRouter } from "../apps/backend/src/admin/router";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";

const caller = () =>
  createAdminRouter(
    new ContentReadService(),
    new ContentWriteService(),
    new ContentUploadService(),
  ).createCaller({
    user: { id: 1, role: "admin", blockedAt: null },
    req: {},
    res: {},
  } as TrpcContext);
describe("publication notification follows successful persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.update.mockResolvedValue({
      id: 8,
      text: "previous text",
      target: "club",
    });
    state.notify.mockResolvedValue(undefined);
  });
  it("does not send a publication notification when the post write fails", async () => {
    state.update.mockRejectedValue(new Error("fixture write failed"));
    await expect(
      caller().updatePost({ id: 8, status: "published" }),
    ).rejects.toThrow("fixture write failed");
    expect(state.notify).not.toHaveBeenCalled();
  });
  it.each<{ change: string; input: UpdatePostInput }>([
    { change: "text", input: { id: 8, text: "Unsaved correction" } },
    {
      change: "video",
      input: { id: 8, videos: ["https://assets.example.test/video.mp4"] },
    },
    { change: "publication", input: { id: 8, status: "published" } },
    { change: "photos", input: { id: 8, photos: [] } },
    {
      change: "empty media lists",
      input: { id: 8, videos: [], attachments: [], removedMediaIds: [] },
    },
    { change: "no fields", input: { id: 8 } },
    { change: "attachment removal", input: { id: 8, removedMediaIds: [1] } },
  ])(
    "rejects $change edits of a missing post without announcing success",
    async ({ input }) => {
      // Only the unavailable SQL reader is doubled; the editor, service and
      // router execute their real missing-post/error propagation paths.
      const reader = {
        select: () => ({
          from: () => ({ where: () => ({ for: async () => [] }) }),
        }),
      };
      const database = {
        transaction: async (run: (tx: typeof reader) => Promise<unknown>) =>
          run(reader),
      } as unknown as MySql2Database;
      state.update.mockImplementation((id, data, videos, attachments) =>
        savePostEdit(database, id, data, videos, attachments),
      );
      await expect(caller().updatePost(input)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
      expect(state.notify).not.toHaveBeenCalled();
    },
  );
  it("does not notify before associated video updates succeed", async () => {
    state.update.mockRejectedValue(new Error("fixture media failed"));
    await expect(
      caller().updatePost({
        id: 8,
        status: "published",
        videos: ["https://assets.example.test/video"],
      }),
    ).rejects.toThrow("fixture media failed");
    expect(state.notify).not.toHaveBeenCalled();
  });
  it("waits for the pending write and notifies only after it resolves", async () => {
    let finish!: (publication: {
      id: number;
      text: string;
      target: string;
    }) => void;
    state.update.mockImplementation(
      () =>
        new Promise<{ id: number; text: string; target: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const result = caller().updatePost({ id: 8, status: "published" });
    try {
      await vi.waitFor(() => expect(state.update).toHaveBeenCalledOnce());
      expect(state.notify).not.toHaveBeenCalled();
    } finally {
      finish({ id: 8, text: "previous text", target: "club" });
      await result;
    }
    expect(state.notify).toHaveBeenCalledWith("previous text", 8, "club");
  });
  it("uses the changed text and audience after the last successful write", async () => {
    state.update.mockResolvedValue({ id: 8, text: "updated", target: "feed" });
    expect(
      await caller().updatePost({
        id: 8,
        status: "published",
        text: "updated",
        target: "feed",
        videos: [],
      }),
    ).toEqual({ success: true });
    expect(state.notify).toHaveBeenCalledWith("updated", 8, "feed");
    expect(state.update).toHaveBeenCalledWith(
      8,
      expect.objectContaining({
        text: "updated",
        target: "feed",
        status: "published",
      }),
      [],
      { attachments: undefined, removedMediaIds: undefined },
    );
  });
  it("does not reannounce an already published post", async () => {
    state.update.mockResolvedValue(undefined);
    expect(
      await caller().updatePost({
        id: 8,
        status: "published",
        text: "correction",
      }),
    ).toEqual({ success: true });
    expect(state.notify).not.toHaveBeenCalled();
  });
  it("does not notify on draft edits or scheduling", async () => {
    state.update.mockResolvedValue(undefined);
    expect(await caller().updatePost({ id: 8, status: "draft" })).toEqual({
      success: true,
    });
    expect(await caller().updatePost({ id: 8, status: "scheduled" })).toEqual({
      success: true,
    });
    expect(state.notify).not.toHaveBeenCalled();
  });
});
