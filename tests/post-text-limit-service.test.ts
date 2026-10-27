import { describe, expect, it, vi, afterEach } from "vitest";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { createPostInput } from "../apps/backend/src/content/post-write-input";
import * as db from "../apps/backend/src/db";

describe("normalized post text is bounded before persistence", () => {
  afterEach(() => vi.restoreAllMocks());
  it("rejects oversized create even for a direct service caller", async () => {
    const write = vi.spyOn(db, "createPostWithVideos").mockResolvedValue(1);
    const input = createPostInput.parse({
      text: "valid",
      photos: [],
      tags: [],
      published: false,
    });
    await expect(
      new ContentWriteService().createPost(1, {
        ...input,
        text: "я".repeat(40_000),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(write).not.toHaveBeenCalled();
  });
  it("rejects oversized update without writing any fields", async () => {
    const write = vi.spyOn(db, "savePostEdit").mockResolvedValue(undefined);
    await expect(
      new ContentWriteService().updatePost({
        id: 1,
        text: "🌿".repeat(16_384),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(write).not.toHaveBeenCalled();
  });
});
