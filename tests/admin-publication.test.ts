import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../apps/backend/src/_core/context";
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

const caller = () =>
  createAdminRouter(
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
    await caller().updatePost({
      id: 8,
      status: "published",
      text: "correction",
    });
    expect(state.notify).not.toHaveBeenCalled();
  });
  it("does not notify on draft edits or scheduling", async () => {
    state.update.mockResolvedValue(undefined);
    await caller().updatePost({ id: 8, status: "draft" });
    await caller().updatePost({ id: 8, status: "scheduled" });
    expect(state.notify).not.toHaveBeenCalled();
  });
});
