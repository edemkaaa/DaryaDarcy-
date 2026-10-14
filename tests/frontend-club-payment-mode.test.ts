import { afterEach, expect, it, vi } from "vitest";
import {
  getClubPaymentMode,
  requireProdamusTestUrl,
  isNormalCheckoutRecoveryEnabled,
} from "../apps/frontend/src/features/club/payment-mode";

afterEach(() => vi.unstubAllEnvs());
it.each([
  [undefined, undefined, "live"],
  ["false", "false", "live"],
  ["", "", "live"],
  ["true", "false", "yookassa-test"],
  ["false", "true", "prodamus-test"],
  ["true", "true", "unavailable"],
  ["TRUE", "false", "unavailable"],
  ["false", "1", "unavailable"],
  ["false", "true ", "unavailable"],
])(
  "build flags YooKassa=%s Prodamus=%s select %s",
  (yookassa, prodamus, expected) => {
    vi.stubEnv("NEXT_PUBLIC_CLUB_TEST_CHECKOUT", yookassa);
    vi.stubEnv("NEXT_PUBLIC_PRODAMUS_TEST_ENABLED", prodamus);
    expect(getClubPaymentMode()).toBe(expected);
  },
);

const demo =
  "https://testpage1.payform.ru/?demo_mode=1&payments_limit=1&sum=790.00&currency=rub&order_id=club-test-101-00000000-0000-4000-8000-000000000001";
it("accepts the isolated one-off 790 RUB demo checkout", () => {
  expect(requireProdamusTestUrl(demo)).toBe(demo);
});
it.each([
  demo.replace("testpage1", "live"),
  demo.replace("https:", "http:"),
  demo.replace("demo_mode=1", "demo_mode=0"),
  demo.replace("payments_limit=1", "payments_limit=12"),
  demo.replace("790.00", "990.00"),
  demo.replace("currency=rub", "currency=usd"),
  demo.replace("club-test-", "club-"),
  demo.replace("https://", "https://user:password@"),
  demo.replace(".ru/", ".ru/checkout/"),
  `${demo}&demo_mode=0`,
  `${demo}&sum=990.00`,
])("refuses mismatched demo checkout %s", (url) => {
  expect(() => requireProdamusTestUrl(url)).toThrow();
});

it.each([
  [undefined, "false", "false", false],
  ["false", "false", "false", false],
  ["TRUE", "false", "false", false],
  ["true", "false", "false", true],
  ["true", "true", "false", false],
  ["true", "false", "true", false],
  ["true", "1", "false", false],
])(
  "NORMAL recovery=%s never selects TEST (YooKassa=%s Prodamus=%s)",
  (normal, yookassa, prodamus, expected) => {
    vi.stubEnv("NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED", normal);
    vi.stubEnv("NEXT_PUBLIC_CLUB_TEST_CHECKOUT", yookassa);
    vi.stubEnv("NEXT_PUBLIC_PRODAMUS_TEST_ENABLED", prodamus);
    expect(isNormalCheckoutRecoveryEnabled()).toBe(expected);
  },
);
