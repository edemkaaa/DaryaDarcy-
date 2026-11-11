/** SSR модель подписки проверяет срок закэшированного доступа независимо от нового сетевого ответа. */
import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({
  role: "user",
  error: false,
  expiry: new Date("2040-01-01T00:00:00Z"),
}));
vi.mock("../apps/frontend/src/domain/session/session-context", () => ({
  useAuth: () => ({
    user: { id: 1, role: state.role },
    isOwner: state.role === "admin",
    invalidateAccess: () => {},
  }),
}));
vi.mock("../apps/frontend/src/shared/api/trpc", () => ({
  trpc: {
    club: {
      subscription: {
        useQuery: () => ({
          data: {
            hasClubAccess: true,
            subscribed: true,
            cancelAtPeriodEnd: false,
            expiresAt: state.expiry,
          },
          isError: state.error,
          isPending: false,
          error: state.error ? { data: { httpStatus: 503 } } : null,
          refetch: async () => {},
        }),
      },
    },
  },
}));
import {
  ClubProvider,
  useClub,
} from "../apps/frontend/src/domain/subscription/subscription-context";
/** Монтируем настоящий ClubProvider над синтетическими session/query данными и читаем status/access из Probe. */
function render() {
  /** Показываем только результат useClub для assertions, не воспроизводя логику провайдера. */
  function Probe() {
    const c = useClub();
    return createElement("span", null, `${c.status}:${c.hasClubAccess}`);
  }
  return renderToStaticMarkup(
    createElement(ClubProvider, { children: createElement(Probe) }),
  );
}
/** Возвращаем часы, роль и состояние ошибки. */
afterEach(() => {
  vi.useRealTimers();
  state.role = "user";
  state.error = false;
});
/** Истёкшая оплаченная запись возвращается в checking без клубного доступа. */
it("does not keep an expired cached paid response active", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2040-01-01T00:00:01Z"));
  expect(render()).toContain("checking:false");
});
/** До срока истечения сохранённый положительный ответ остаётся действительным. */
it("keeps unexpired paid access active", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2039-12-31T23:59:59Z"));
  expect(render()).toContain("active:true");
});
/** Служебное право admin/moderator не зависит от оплаченного периода. */
it.each(["admin", "moderator"])(
  "does not revoke %s service access on paid expiry",
  (role) => {
    state.role = role;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2040-01-01T00:00:01Z"));
    expect(render()).toContain("active:true");
  },
);

/** 503 при проверке уже истёкшей записи не продлевает разрешение из кэша. */
it("does not preserve expired access when the expiry recheck fails", () => {
  state.error = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2040-01-01T00:00:01Z"));
  expect(render()).toContain("error:false");
});
