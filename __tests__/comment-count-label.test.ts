import { describe, expect, it } from "vitest";
import { commentCountLabel, COMMENT_CHAR_LIMIT } from "@/lib/comment-count-label";

describe("commentCountLabel", () => {
  it("declines Russian comment counts", () => {
    expect(commentCountLabel(1)).toBe("1 комментарий");
    expect(commentCountLabel(2)).toBe("2 комментария");
    expect(commentCountLabel(5)).toBe("5 комментариев");
    expect(commentCountLabel(11)).toBe("11 комментариев");
    expect(commentCountLabel(21)).toBe("21 комментарий");
    expect(commentCountLabel(34)).toBe("34 комментария");
  });

  it("exports char limit matching API", () => {
    expect(COMMENT_CHAR_LIMIT).toBe(1000);
  });
});
