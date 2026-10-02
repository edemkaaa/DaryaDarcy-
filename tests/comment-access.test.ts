import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "../packages/database/src/schema";
import type { TrpcContext } from "../apps/backend/src/_core/context";
const state = vi.hoisted(() => ({ subscribed: false, status: "published", target: "club", parentPostId: 1, mutations: vi.fn() }));
vi.mock("../apps/backend/src/db", () => ({
  isOwnerAccount: (user: User) => user.role === "admin",
  getActiveClubSubscription: async () => state.subscribed ? { orderId: "paid" } : null,
  getPostById: async () => ({ id: 1, published: true, status: state.status, target: state.target, tags: ["вопрос-ответ"], createdAt: new Date() }),
}));
vi.mock("../apps/backend/src/platform-db", () => ({
  isStaffAccount: (user: User) => ["admin", "moderator"].includes(user.role),
}));
vi.mock("../apps/backend/src/content/comments", () => ({
  getPostCommentById: async () => ({ id: 10, postId: state.parentPostId, userId: 7 }),
  toggleCommentLike: state.mutations, reportComment: state.mutations,
  deletePostCommentV2: state.mutations, updatePostCommentV2: state.mutations,
  addPostCommentV2: state.mutations,
}));
import { appRouter } from "../apps/backend/src/routers";
const user = { id: 7, role: "user", blockedAt: null } as User;
const caller = () => appRouter.createCaller({ user, req: {}, res: {} } as TrpcContext);
const actions = [
  () => caller().club.toggleCommentLike({ commentId: 10 }),
  () => caller().club.reportComment({ id: 10, reason: "reason" }),
  () => caller().club.updateComment({ id: 10, text: "updated" }),
  () => caller().club.deleteComment({ id: 10 }),
];
beforeEach(() => { state.subscribed = false; state.status = "published"; state.target = "club"; state.parentPostId = 1; state.mutations.mockReset(); });
it.each(actions)("refuses a club comment mutation without access before changing records", async action => {
  await expect(action()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.mutations).not.toHaveBeenCalled();
});
it.each(actions)("refuses mutations on a draft even for subscribers", async action => {
  state.subscribed = true; state.status = "draft";
  await expect(action()).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.mutations).not.toHaveBeenCalled();
});
it("keeps published public discussion mutations available to authenticated non-members", async () => {
  state.target = "feed";
  await caller().club.toggleCommentLike({ commentId: 10 });
  expect(state.mutations).toHaveBeenCalledWith(7, 10);
});
