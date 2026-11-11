/** Проверяем nullable-тип отсутствующего поста от репозитория до сгенерированного клиентского контракта. */
import { expectTypeOf, it } from "vitest";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../apps/backend/src/routers";
import type { AppRouter as ClientRouter } from "../apps/frontend/src/shared/api/contract";
import type { getAdminPostDetail } from "../apps/backend/src/content/admin-post-reads";

/** Проверка уровня типов закрепляет null во всех трёх слоях; runtime HTTP здесь не вызывается. */
it("represents a missing admin post as null through the server and generated client contract", () => {
  expectTypeOf<Awaited<ReturnType<typeof getAdminPostDetail>>>()
    .extract<null>()
    .toEqualTypeOf<null>();
  expectTypeOf<inferRouterOutputs<AppRouter>["admin"]["postDetail"]>()
    .extract<null>()
    .toEqualTypeOf<null>();
  expectTypeOf<inferRouterOutputs<ClientRouter>["admin"]["postDetail"]>()
    .extract<null>()
    .toEqualTypeOf<null>();
});
