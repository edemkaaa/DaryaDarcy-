import { expectTypeOf, it } from "vitest";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../apps/backend/src/routers";
import type { publicUser } from "../apps/backend/src/identity/session.service";

type Output = inferRouterOutputs<AppRouter>;
it("keeps the unverified contact typed on administrator cards only", () => {
  expectTypeOf<Output["admin"]["members"][number]>()
    .toHaveProperty("contactPhone")
    .toEqualTypeOf<string | null>();
  expectTypeOf<Output["admin"]["membersPage"]["items"][number]>()
    .toHaveProperty("contactPhone")
    .toEqualTypeOf<string | null>();
  expectTypeOf<ReturnType<typeof publicUser>>().not.toHaveProperty(
    "contactPhone",
  );
});
