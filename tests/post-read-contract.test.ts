import { expectTypeOf, it } from "vitest";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../apps/backend/src/routers";
import type { ApiOutputs } from "../apps/frontend/src/shared/api/types";
import type { PostMedia } from "../packages/database/src/schema";

type Output = inferRouterOutputs<AppRouter>;
it("exposes delivered media and comment counts in post API types", () => {
  expectTypeOf<NonNullable<Output["feed"]["getById"]>>().toHaveProperty("media").toEqualTypeOf<PostMedia[]>();
  expectTypeOf<Output["feed"]["listPaginated"]["posts"][number]>().toHaveProperty("commentCount").toEqualTypeOf<number>();
  expectTypeOf<Output["club"]["list"]["posts"][number]>().toHaveProperty("media").toEqualTypeOf<PostMedia[]>();
  expectTypeOf<Output["club"]["list"]["posts"][number]>().toHaveProperty("commentCount").toEqualTypeOf<number>();
  expectTypeOf<Output["club"]["listByCategory"]["posts"][number]>().toHaveProperty("media").toEqualTypeOf<PostMedia[]>();
  expectTypeOf<Output["club"]["listByCategory"]["posts"][number]>().toHaveProperty("commentCount").toEqualTypeOf<number>();
  expectTypeOf<NonNullable<Output["feed"]["getById"]>>().not.toHaveProperty("commentCount");
});

// Compile the same direct accesses a client uses, without widening or casting DTOs.
// Narrow repository/wrapper annotations or a stale generated contract break this.
function readClientPostFields(
  detail: NonNullable<ApiOutputs["feed"]["getById"]>,
  feedPost: ApiOutputs["feed"]["listPaginated"]["posts"][number],
  clubPost: ApiOutputs["club"]["list"]["posts"][number],
  categoryPost: ApiOutputs["club"]["listByCategory"]["posts"][number],
) {
  expectTypeOf(detail.media).toEqualTypeOf<PostMedia[]>();
  expectTypeOf(feedPost.commentCount).toEqualTypeOf<number>();
  expectTypeOf(clubPost.media).toEqualTypeOf<PostMedia[]>();
  expectTypeOf(clubPost.commentCount).toEqualTypeOf<number>();
  expectTypeOf(categoryPost.media).toEqualTypeOf<PostMedia[]>();
  expectTypeOf(categoryPost.commentCount).toEqualTypeOf<number>();
  expectTypeOf(detail).not.toHaveProperty("commentCount");
}

it("keeps the generated client post types aligned with tRPC outputs", () => {
  expectTypeOf<ApiOutputs["feed"]["getById"]>().toEqualTypeOf<Output["feed"]["getById"]>();
  expectTypeOf<ApiOutputs["feed"]["listPaginated"]>().toEqualTypeOf<Output["feed"]["listPaginated"]>();
  expectTypeOf<ApiOutputs["club"]["list"]>().toEqualTypeOf<Output["club"]["list"]>();
  expectTypeOf<ApiOutputs["club"]["listByCategory"]>().toEqualTypeOf<Output["club"]["listByCategory"]>();
  expectTypeOf(readClientPostFields).returns.toBeVoid();
});
