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
function render() {
  function Probe() {
    const c = useClub();
    return createElement("span", null, `${c.status}:${c.hasClubAccess}`);
  }
  return renderToStaticMarkup(
    createElement(ClubProvider, { children: createElement(Probe) }),
  );
}
afterEach(() => {
  vi.useRealTimers();
  state.role = "user";
  state.error = false;
});
it("does not keep an expired cached paid response active", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2040-01-01T00:00:01Z"));
  expect(render()).toContain("checking:false");
});
it("keeps unexpired paid access active", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2039-12-31T23:59:59Z"));
  expect(render()).toContain("active:true");
});
it.each(["admin", "moderator"])(
  "does not revoke %s service access on paid expiry",
  (role) => {
    state.role = role;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2040-01-01T00:00:01Z"));
    expect(render()).toContain("active:true");
  },
);

it("does not preserve expired access when the expiry recheck fails", () => {
  state.error = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2040-01-01T00:00:01Z"));
  expect(render()).toContain("error:false");
});
