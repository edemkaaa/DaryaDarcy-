import { afterAll, expect, it, vi } from "vitest";
import type { User } from "../packages/database/src/schema";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";
import { ContentCommentService } from "../apps/backend/src/content/content-comment.service";
import { listAdminMembersPage } from "../apps/backend/src/db";

vi.stubEnv("DATABASE_URL", "");
afterAll(() => vi.unstubAllEnvs());
// No actor field is used before missing infrastructure is rejected.
const actor = { id: 1 } as User;
it.each([
  () =>
    new ContentReadService().savedPostsPage(actor, {
      target: "feed",
      limit: 20,
    }),
  () => listAdminMembersPage(1, { limit: 20 }),
  () => new ContentCommentService().listPage({ postId: 1, limit: 20 }, actor),
])("does not turn an unavailable database into an empty page", async (read) => {
  await expect(read()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
});
