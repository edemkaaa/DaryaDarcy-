import { expect, it } from "vitest";
import { readProdamusCancellationProfile } from "../apps/backend/src/billing/prodamus-cancellation";

const configured = Object.freeze({
  domain: "fixture.payform.ru",
  subscriptionId: "7",
});
const expected = {
  domain: "fixture.payform.ru",
  subscriptionId: "7",
  profileId: "23",
};

// Dropping merchant/subscription comparison or changing legacy scalar decoding
// must break these independent literal expectations, not just source structure.
it.each<[string, Record<string, unknown>, typeof expected | null]>([
  [
    "complete profile",
    {
      domain: "fixture.payform.ru",
      subscription: { id: "7", profile_id: "23" },
    },
    expected,
  ],
  [
    "uppercase trimmed domain",
    {
      domain: " FIXTURE.PAYFORM.RU ",
      subscription: { id: " 7 ", profile_id: " 23 " },
    },
    expected,
  ],
  [
    "numeric IDs",
    { domain: "fixture.payform.ru", subscription: { id: 7, profile_id: 23 } },
    expected,
  ],
  [
    "case-insensitive scalar keys",
    {
      DOMAIN: "fixture.payform.ru",
      subscription: { ID: "7", PROFILE_ID: "23" },
    },
    expected,
  ],
  [
    "exact key takes precedence",
    {
      domain: "fixture.payform.ru",
      DOMAIN: "foreign.payform.ru",
      subscription: { id: "7", profile_id: "23" },
    },
    expected,
  ],
  [
    "foreign domain",
    {
      domain: "foreign.payform.ru",
      subscription: { id: "7", profile_id: "23" },
    },
    null,
  ],
  ["missing domain", { subscription: { id: "7", profile_id: "23" } }, null],
  [
    "foreign subscription",
    {
      domain: "fixture.payform.ru",
      subscription: { id: "8", profile_id: "23" },
    },
    null,
  ],
  [
    "leading-zero subscription differs",
    {
      domain: "fixture.payform.ru",
      subscription: { id: "007", profile_id: "23" },
    },
    null,
  ],
  [
    "missing profile",
    { domain: "fixture.payform.ru", subscription: { id: "7" } },
    null,
  ],
  [
    "empty profile",
    {
      domain: "fixture.payform.ru",
      subscription: { id: "7", profile_id: "  " },
    },
    null,
  ],
  [
    "null profile",
    {
      domain: "fixture.payform.ru",
      subscription: { id: "7", profile_id: null },
    },
    null,
  ],
  ["missing subscription", { domain: "fixture.payform.ru" }, null],
  [
    "array is not subscription record",
    { domain: "fixture.payform.ru", subscription: ["7", "23"] },
    null,
  ],
  [
    "root IDs cannot replace nested profile",
    { domain: "fixture.payform.ru", id: "7", profile_id: "23" },
    null,
  ],
  [
    "legacy non-numeric profile",
    {
      domain: "fixture.payform.ru",
      subscription: { id: "7", profile_id: "legacy-profile" },
    },
    { ...expected, profileId: "legacy-profile" },
  ],
  [
    "legacy zero profile",
    { domain: "fixture.payform.ru", subscription: { id: "7", profile_id: 0 } },
    { ...expected, profileId: "0" },
  ],
])("%s", (_name, body, want) => {
  expect(readProdamusCancellationProfile(body, configured)).toEqual(want);
});

it("does not mutate frozen decoded payload or normalize trusted configuration", () => {
  const body = Object.freeze({
    domain: "fixture.payform.ru",
    subscription: Object.freeze({ id: "7", profile_id: "23" }),
  });
  expect(readProdamusCancellationProfile(body, configured)).toEqual(expected);
  expect(
    readProdamusCancellationProfile(body, {
      ...configured,
      domain: "FIXTURE.PAYFORM.RU",
    }),
  ).toBeNull();
});
