import { expectTypeOf, it } from "vitest";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../apps/backend/src/routers";
import type { PostMedia } from "../packages/database/src/schema";

type Output = inferRouterOutputs<AppRouter>;
it("exposes delivered media and comment counts in post API types", () => {
  expectTypeOf<NonNullable<Output["feed"]["getById"]>>().toHaveProperty("media").toEqualTypeOf<PostMedia[]>();
  expectTypeOf<Output["feed"]["listPaginated"]["posts"][number]>().toHaveProperty("commentCount").toEqualTypeOf<number>();
  expectTypeOf<Output["club"]["list"]["posts"][number]>().toHaveProperty("media").toEqualTypeOf<PostMedia[]>();
  expectTypeOf<Output["club"]["list"]["posts"][number]>().toHaveProperty("commentCount").toEqualTypeOf<number>();
});
