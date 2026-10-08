import { describe, expect, it } from "vitest";
import {
  parseClubAccess,
  requireClubClaim,
} from "../apps/frontend/src/shared/api/club-access";

const paid = {
  subscribed: true,
  expiresAt: "2040-11-01T10:00:00Z",
  cancelAtPeriodEnd: false,
  isOwner: false,
  monthlyPrice: "790",
};
describe("server-confirmed club access", () => {
  it.each([paid.expiresAt, new Date(paid.expiresAt)])(
    "accepts a real expiry in the transport format %s",
    (expiresAt) => {
      expect(parseClubAccess({ ...paid, expiresAt }).expiresAt).toEqual(
        new Date(paid.expiresAt),
      );
    },
  );
  it("allows owner access without a paid period", () => {
    expect(
      parseClubAccess({ ...paid, isOwner: true, expiresAt: null }).subscribed,
    ).toBe(true);
  });
  it("keeps a server-confirmed inactive account inactive", () => {
    expect(
      parseClubAccess({ ...paid, subscribed: false, expiresAt: null })
        .subscribed,
    ).toBe(false);
  });
  it.each([
    null,
    [],
    {},
    { ...paid, subscribed: "true" },
    { ...paid, cancelAtPeriodEnd: "false" },
    { ...paid, isOwner: "true" },
    { ...paid, monthlyPrice: null },
    { ...paid, monthlyPrice: "" },
    { ...paid, expiresAt: undefined },
    { ...paid, expiresAt: null },
    { ...paid, expiresAt: "invalid" },
    { ...paid, expiresAt: 123 },
    { ...paid, expiresAt: new Date(NaN) },
  ])("rejects malformed paid access %j", (value) => {
    expect(() => parseClubAccess(value)).toThrow();
  });
  it.each([
    { granted: false, orderId: null },
    { granted: true, orderId: "club-paid" },
  ])(
    "accepts the compatibility read %j without interpreting it as access",
    (value) => {
      expect(() => requireClubClaim(value)).not.toThrow();
    },
  );
  it.each([
    null,
    {},
    { granted: "true", orderId: "x" },
    { granted: true, orderId: "" },
    { granted: true, orderId: null },
    { granted: false, orderId: "x" },
  ])("rejects malformed compatibility read %j", (value) => {
    expect(() => requireClubClaim(value)).toThrow();
  });
});
