import { describe, expect, it } from "vitest";
import {
  areCommentsOpen,
  commentsCloseAt,
  isCommunityPost,
  primaryClubTab,
} from "../lib/club-tags";

describe("club-tags comments", () => {
  it("opens comments only for community posts within 48h", () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isCommunityPost(["community"])).toBe(true);
    expect(areCommentsOpen(["community"], recent)).toBe(true);
    expect(areCommentsOpen(["life"], recent)).toBe(false);
  });

  it("closes comments after 48 hours", () => {
    const old = new Date(Date.now() - 49 * 60 * 60 * 1000);
    expect(areCommentsOpen(["комьюнити"], old)).toBe(false);
  });

  it("computes close time from publishedAt", () => {
    const published = new Date("2026-09-10T10:00:00+03:00");
    const until = commentsCloseAt(published);
    expect(until?.getTime()).toBe(published.getTime() + 48 * 60 * 60 * 1000);
  });

  it("routes community tag to community tab", () => {
    expect(primaryClubTab(["community", "life"])).toBe("community");
  });
});
