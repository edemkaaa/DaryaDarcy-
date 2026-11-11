/** Проверяем серверные права на клубный контент, обсуждения и административные действия с синтетическим репозиторием. */
import { describe, expect, it, vi } from "vitest";
import type { User } from "../packages/database/src/schema";
import type { TrpcContext } from "../apps/backend/src/_core/context";
const state = vi.hoisted(() => ({ published: true, status: "published", articleAccess: "club" }));
vi.mock("../apps/backend/src/db", () => ({
  isOwnerAccount: (user: User) => user.role === "admin",
  getActiveClubSubscription: async () => ({ orderId: "club-7-paid", expiresAt: new Date("2026-11-01") }),
  getPostById: async () => ({ id: 1, target: "club", published: state.published, status: state.status, text: "paid material" }),
  getLatestPublishedPost: async (target: string) => ({ id: 1, text: target === "club" ? "paid material" : "public material" }),
  getAllPostsAdmin: async () => ["admin material"],
  getArticleById: async () => ({ id: 1, published: true, access: state.articleAccess, sections: ["paid article"] }),
  getUserSavedPostIds: async () => [1],
  getPostsByIds: async () => [{ id: 1, target: "club", published: state.published, status: state.status, text: "paid material", media: [{ url: "https://assets.example.test/private" }] }],
}));
vi.mock("../apps/backend/src/content/comments", () => ({ listCommentReports: async () => ["reports"], listPostCommentsV2: async () => ["draft discussion"] }));
import { appRouter } from "../apps/backend/src/routers";
import { userHasClubAccess } from "../apps/backend/src/_core/trpc";
const member: User = {
  id: 7, openId: "member", email: "member@example.test", name: null, phone: null, contactPhone: null,
  passwordHash: null, sessionVersion: 0, profileRevision: 0, loginMethod: "email", gender: null, avatarUrl: null, role: "user",
  blockedAt: null, blockedReason: null, accountDeletionRequestedAt: null,
  createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
};
/** Создаёт прямой tRPC caller с заданным actor; сетевую cookie-авторизацию этот набор не проверяет. */
function caller(user: User | null) {
  return appRouter.createCaller({ user, req: {}, res: {} } as TrpcContext);
}
/** Проверяем несколько путей чтения и ролей: оплаченная подписка не должна обходить блокировку. */
describe("blocked identity is denied on every access path", () => {
  /** Любая заблокированная роль теряет клубный доступ, включая администратора. */
  it.each(["user", "admin", "moderator"] as const)("does not give blocked %s club access", async (role) => {
    expect(await userHasClubAccess({ ...member, role, blockedAt: new Date() })).toBe(false);
  });
  /** Административная роль без актуального разрешённого аккаунта недостаточна. */
  it("denies admin routes to a blocked administrator", async () => {
    await expect(caller({ ...member, role: "admin", blockedAt: new Date() }).admin.posts()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  /** Блокировка запрещает и отдельный модераторский путь чтения жалоб. */
  it("denies moderation routes to a blocked moderator", async () => {
    await expect(caller({ ...member, role: "moderator", blockedAt: new Date() }).moderation.listCommentReports()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  /** Публичное имя процедуры не должно раскрывать клубный текст заблокированной участнице. */
  it("does not expose club detail via public procedure to blocked subscriber", async () => {
    expect(await caller({ ...member, blockedAt: new Date() }).feed.getById({ id: 1 })).toBeUndefined();
  });
  /** Общее объявление Ленты остаётся открытым, а клубная часть очищается. */
  it("does not expose club notification text to blocked subscriber", async () => {
    const result = await caller({ ...member, blockedAt: new Date() }).notifications.latest();
    expect(result.clubText).toBe("");
    expect(result.feedText).toBe("public material");
  });
  /** Ответ статуса подписки должен учитывать блокировку текущего пользователя. */
  it("does not report a blocked subscriber as subscribed", async () => {
    expect((await caller({ ...member, blockedAt: new Date() }).club.subscription()).subscribed).toBe(false);
  });
  /** Скрываем секции платной статьи при отсутствии текущего клубного доступа. */
  it("locks article body for blocked subscriber", async () => {
    const result = await caller({ ...member, blockedAt: new Date() }).articles.getById({ id: 1 });
    expect(result?.sections).toEqual([]);
  });
  /** Проверяем оба признака опубликованности; изменяемую фикстуру возвращаем в исходное состояние через finally. */
  it.each([[false, "published"], [true, "draft"], [true, "scheduled"]] as const)("hides unpublished post (published=%s, status=%s)", async (published, status) => {
    state.published = published; state.status = status;
    try { expect(await caller(member).feed.getById({ id: 1 })).toBeUndefined(); }
    finally { state.published = true; state.status = "published"; }
  });
  /** Положительный контроль показывает, что проверка не закрыла разрешённый контент всем. */
  it("keeps published club detail available to an active subscriber", async () => {
    expect((await caller(member).feed.getById({ id: 1 }))?.text).toBe("paid material");
  });
  /** Открытая статья доступна гостю; флаг фикстуры восстанавливается после проверки. */
  it("public articles do not require a subscription", async () => {
    state.articleAccess = "public";
    try { expect((await caller(null).articles.getById({ id: 1 }))?.locked).toBe(false); }
    finally { state.articleAccess = "club"; }
  });
  /** Закладка не обходит статус черновика или отложенной публикации. */
  it.each(["draft", "scheduled"])("does not expose %s body or attachments through saved posts", async (status) => {
    state.status = status;
    try { expect(await caller(member).feed.savedPosts()).toEqual([]); }
    finally { state.status = "published"; }
  });
  /** Угаданный ID скрытого поста не должен открывать обсуждение. */
  it.each(["draft", "scheduled"])("does not expose %s discussion by guessing a post ID", async (status) => {
    state.status = status;
    try { await expect(caller(member).club.comments({ postId: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" }); }
    finally { state.status = "published"; }
  });
});
