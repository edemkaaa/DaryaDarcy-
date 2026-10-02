import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../apps/backend/src/_core/context";
const state = vi.hoisted(() => ({
  read: vi.fn(),
  update: vi.fn(),
  replace: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("../apps/backend/src/db", () => ({
  getPostById: state.read,
  updatePost: state.update,
  replacePostVideos: state.replace,
  isOwnerAccount: (user: { role: string }) => user.role === "admin",
}));
vi.mock("../apps/backend/src/push", () => ({
  sendMarketingPostNotification: state.notify,
}));
import { adminRouter } from "../apps/backend/src/admin/router";

const caller = () =>
  adminRouter.createCaller({
    user: { id: 1, role: "admin", blockedAt: null },
    req: {},
    res: {},
  } as TrpcContext);
describe("publication notification follows successful persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.read.mockResolvedValue({
      id: 8,
      text: "previous text",
      status: "draft",
      target: "club",
      publishedAt: new Date(),
    });
    state.update.mockResolvedValue(undefined);
    state.replace.mockResolvedValue(undefined);
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
    state.replace.mockRejectedValue(new Error("fixture media failed"));
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
    let finish!: () => void;
    state.update.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const result = caller().updatePost({ id: 8, status: "published" });
    try {
      await vi.waitFor(() => expect(state.update).toHaveBeenCalledOnce());
      expect(state.notify).not.toHaveBeenCalled();
    } finally {
      finish();
      await result;
    }
    expect(state.notify).toHaveBeenCalledWith("previous text", 8, "club");
  });
  it("uses the changed text and audience after the last successful write", async () => {
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
    expect(state.notify.mock.invocationCallOrder[0]).toBeGreaterThan(
      state.replace.mock.invocationCallOrder[0],
    );
  });
  it("does not reannounce an already published post", async () => {
    state.read.mockResolvedValue({
      id: 8,
      text: "published",
      status: "published",
      target: "feed",
      publishedAt: new Date(),
    });
    await caller().updatePost({
      id: 8,
      status: "published",
      text: "correction",
    });
    expect(state.notify).not.toHaveBeenCalled();
  });
  it("does not notify on draft edits or scheduling", async () => {
    await caller().updatePost({ id: 8, status: "draft" });
    await caller().updatePost({ id: 8, status: "scheduled" });
    expect(state.notify).not.toHaveBeenCalled();
  });
});
