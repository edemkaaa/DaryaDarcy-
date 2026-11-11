/** Проверяем форму подтверждённого сервером доступа к Клубу, отделяя подписку, служебный доступ и отмену. */
import { describe, expect, it } from "vitest";
import {
  parseClubAccess,
  requireClubClaim,
} from "../apps/frontend/src/shared/api/club-access";

const paid = {
  hasClubAccess: true,
  subscribed: true,
  expiresAt: "2040-11-01T10:00:00Z",
  cancelAtPeriodEnd: false,
  cancellationStatus: "none",
  isOwner: false,
  monthlyPrice: "790",
};
/** Клиент валидирует серверное решение, не выводит оплату из одного флага или возврата браузера. */
describe("server-confirmed club access", () => {
  /** Состояние отмены сохраняется даже при отсутствии текущего оплаченного периода. */
  it.each(["none", "pending", "confirmed"] as const)(
    "preserves cancellation state %s independently from paid access",
    (cancellationStatus) => {
      expect(
        parseClubAccess({
          ...paid,
          subscribed: false,
          hasClubAccess: false,
          expiresAt: null,
          cancellationStatus,
        }),
      ).toMatchObject({
        subscribed: false,
        hasClubAccess: false,
        cancellationStatus,
      });
    },
  );
  /** Неизвестное или нетекстовое состояние нельзя принимать за подтверждённую отмену. */
  it.each([undefined, null, "unknown", false, 1])(
    "rejects malformed cancellation state %j",
    (cancellationStatus) => {
      expect(() => parseClubAccess({ ...paid, cancellationStatus })).toThrow();
    },
  );
  /** Дата ISO и Date после SuperJSON должны нормализоваться в одно значение. */
  it.each([paid.expiresAt, new Date(paid.expiresAt)])(
    "accepts a real expiry in the transport format %s",
    (expiresAt) => {
      expect(parseClubAccess({ ...paid, expiresAt }).expiresAt).toEqual(
        new Date(paid.expiresAt),
      );
    },
  );
  /** Owner-доступ допускается без выдуманной даты оплаты. */
  it("allows owner access without a paid period", () => {
    expect(
      parseClubAccess({ ...paid, isOwner: true, expiresAt: null }).subscribed,
    ).toBe(true);
  });
  /** Подтверждённое отсутствие доступа остаётся закрытым состоянием. */
  it("keeps a server-confirmed inactive account inactive", () => {
    expect(
      parseClubAccess({
        ...paid,
        hasClubAccess: false,
        subscribed: false,
        expiresAt: null,
      }).subscribed,
    ).toBe(false);
  });
  /** hasClubAccess может быть true независимо от subscribed и оплаченного срока. */
  it("accepts service access without inventing a paid subscription", () => {
    expect(
      parseClubAccess({ ...paid, subscribed: false, expiresAt: null }),
    ).toMatchObject({
      hasClubAccess: true,
      subscribed: false,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancellationStatus: "none",
      isOwner: false,
    });
  });
  /** Нельзя заменить явный отказ hasClubAccess положительным subscribed. */
  it("preserves the server's access decision independently of subscribed", () => {
    expect(
      parseClubAccess({ ...paid, hasClubAccess: false }).hasClubAccess,
    ).toBe(false);
  });
  /** Неполные boolean/цена/дата и невозможный оплаченный период отклоняются. */
  it.each([
    null,
    [],
    {},
    { ...paid, hasClubAccess: undefined },
    { ...paid, hasClubAccess: "true" },
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
  /** Форма claimPending проверяется отдельно и сама не выдаёт право открыть контент. */
  it.each([
    { granted: false, orderId: null },
    { granted: true, orderId: "club-paid" },
  ])(
    "accepts the compatibility read %j without interpreting it as access",
    (value) => {
      expect(() => requireClubClaim(value)).not.toThrow();
    },
  );
  /** Несогласованные granted/orderId не должны становиться подтверждением покупки. */
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
