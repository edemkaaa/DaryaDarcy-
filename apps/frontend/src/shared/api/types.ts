/** Типы входов и выходов выводим из сгенерированного API-контракта, чтобы компоненты не копировали серверные структуры вручную. */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./contract";

export type ApiInputs = inferRouterInputs<AppRouter>;
export type ApiOutputs = inferRouterOutputs<AppRouter>;
export type AdminPost = ApiOutputs["admin"]["posts"][number];
export type AdminPostCard = ApiOutputs["admin"]["postsPage"]["posts"][number];
