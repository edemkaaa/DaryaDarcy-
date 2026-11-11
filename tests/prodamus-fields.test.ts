/** Совместимые selectors signed Prodamus payload не являются отдельной авторизацией или строгой валидацией ID. */
import { describe, expect, it } from "vitest";
import {
  isPaidStatus,
  pickOrderId,
  pickString,
  pickUserId,
  subscriptionAction,
} from "../apps/backend/src/billing/prodamus-fields";

/** Независимые таблицы фиксируют legacy coercion и точный приоритет полей перед последующей проверкой доверия. */
describe("Prodamus field selection compatibility", () => {
  /** Exact aliases имеют заданный приоритет; scalar conversion сохраняет прежние 0/false/array формы. */
  it.each([
    {
      body: { payment_status: " pending ", status: "success" },
      want: "pending",
    },
    { body: { Payment_Status: "pending", status: "success" }, want: "success" },
    { body: { PAYMENT_STATUS: " Success " }, want: "Success" },
    { body: { Payment_Status: "first", PAYMENT_STATUS: "last" }, want: "last" },
    { body: { payment_status: "  ", status: "pending" }, want: "pending" },
    { body: { payment_status: null, status: undefined }, want: "" },
    { body: { payment_status: 0 }, want: "0" },
    { body: { payment_status: false }, want: "false" },
    { body: { payment_status: [1, 2] }, want: "1,2" },
  ])(
    "selects exact keys before case-insensitive aliases: $body",
    ({ body, want }) => {
      expect(pickString(body, ["payment_status", "status"])).toBe(want);
    },
  );

  /** Приоритет nullish user hint не должен перескакивать к другому полю после невалидного первичного значения. */
  it.each([
    { body: { _param_userId: "7", userId: 8, _param: { userId: 9 } }, want: 7 },
    {
      body: { _param_userId: null, userId: "8", _param: { userId: 9 } },
      want: 8,
    },
    { body: { _param: { userId: "9" } }, want: 9 },
    { body: { _param_userId: 0, userId: 8 }, want: null },
    { body: { _param_userId: "bad", userId: 8 }, want: null },
    { body: { userId: -7 }, want: null },
    { body: { userId: Infinity }, want: null },
    { body: { _param: [{ userId: 7 }] }, want: null },
    { body: {}, want: null },
    // Preserve existing coercion; this selector is not an authorization/ID validator.
    { body: { userId: "7.5" }, want: 7.5 },
  ])("retains nullish user-ID precedence: $body", ({ body, want }) => {
    expect(pickUserId(body)).toBe(want);
  });

  /** Только выбранное success-состояние считается paid, не любая строка синонима. */
  it.each([
    { body: { payment_status: " SUCCESS " }, want: true },
    { body: { paymentStatus: "success" }, want: true },
    { body: { STATUS: "Success" }, want: true },
    { body: { payment_status: "pending", status: "success" }, want: false },
    { body: { status: "paid" }, want: false },
    { body: { status: "order_canceled" }, want: false },
    { body: {}, want: false },
  ])(
    "classifies only the selected success status as paid: $body",
    ({ body, want }) => {
      expect(isPaidStatus(body)).toBe(want);
    },
  );

  /** Internal order выбирается по aliases и известным префиксам, provider order_id не подменяет его. */
  it.each([
    {
      body: { order: " club-7-a ", order_num: "shop-digital-1-b" },
      want: "club-7-a",
    },
    { body: { ORDERNUM: "club6m-7-a" }, want: "club6m-7-a" },
    { body: { orderId: "shop-digital-1-a" }, want: "shop-digital-1-a" },
    { body: { order_id: "300155" }, want: "" },
    { body: { order: "foreign", order_num: "club-7-a" }, want: "" },
    { body: { order: "CLUB-7-a" }, want: "" },
    { body: {}, want: "" },
  ])(
    "retains selected order alias and known prefix semantics: $body",
    ({ body, want }) => {
      expect(pickOrderId(body)).toBe(want);
    },
  );

  /** Существующий nested action имеет приоритет целиком, даже если он пустой. */
  it.each([
    {
      body: {
        action_code: "finish",
        subscription: { action_code: " AUTO_PAYMENT " },
      },
      want: "auto_payment",
    },
    {
      body: {
        actionCode: "auto_payment",
        subscription: { action_code: "deactivation" },
      },
      want: "deactivation",
    },
    {
      body: { action_code: "finish", subscription: { action_code: "" } },
      want: "",
    },
    {
      body: {
        action_code: "finish",
        subscription: [{ action_code: "deactivation" }],
      },
      want: "finish",
    },
    { body: { subscription: { ACTION: " Finish " } }, want: "finish" },
    { body: { subscription: null }, want: "" },
  ])(
    "retains whole-field nested subscription action precedence: $body",
    ({ body, want }) => {
      expect(subscriptionAction(body)).toBe(want);
    },
  );

  /** Selectors возвращают normalized значения, оставляя signed input неизменным. */
  it("does not mutate a frozen signed payload during selection", () => {
    const body = Object.freeze({
      order_num: " club6m-7-frozen ",
      payment_status: " SUCCESS ",
      subscription: Object.freeze({ action: " AUTO_PAYMENT " }),
    });
    expect(pickOrderId(body)).toBe("club6m-7-frozen");
    expect(isPaidStatus(body)).toBe(true);
    expect(subscriptionAction(body)).toBe("auto_payment");
    expect(body).toEqual({
      order_num: " club6m-7-frozen ",
      payment_status: " SUCCESS ",
      subscription: { action: " AUTO_PAYMENT " },
    });
  });
});
