import { describe, expect, it } from "vitest";
import { adminPostsPageInput } from "../apps/backend/src/content/admin-post-reads";

describe("admin post page transport input", () => {
  it("accepts the forward direction sent by the infinite-query client", () => {
    expect(
      adminPostsPageInput.parse({
        limit: 20,
        direction: "forward",
        cursor: 20,
      }),
    ).toMatchObject({ limit: 20, cursor: 20 });
  });

  it("keeps direct queries without a direction compatible", () => {
    expect(adminPostsPageInput.parse({ limit: 20 })).toMatchObject({
      limit: 20,
    });
  });

  it.each(["backward", "other", null, 1])(
    "rejects unsupported direction %s instead of reversing the cursor",
    (direction) => {
      expect(adminPostsPageInput.safeParse({ direction }).success).toBe(false);
    },
  );

  it("still rejects unknown pagination fields", () => {
    expect(adminPostsPageInput.safeParse({ offset: 20 }).success).toBe(false);
  });
});
