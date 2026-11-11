/** Проверяем proxy-addr из фактического Express adapter, не меняя доверенные прокси приложения. */
import { createRequire } from "node:module";
import { expect, it } from "vitest";

// Resolve through the real HTTP adapter, not a separately installed test copy.
const expressRequire = createRequire(require.resolve("express"));
const proxyAddress = expressRequire("proxy-addr") as {
  compile(subnet: string): (address: string) => boolean;
};

// GHSA-jqcg-44mw-7w3h: dependency rollback must not restore IPv4 trust through
// an IPv6 prefix which does not cover the mapped marker. The edge-only app
// trusts one hop; this retains a separate check of proxy-addr's loopback behavior.
/** Неоднозначный IPv6-префикс не должен доверять публичному IPv4 или его mapped-форме. */
it.each(["::ffff:10.0.0.0/8", "::/1"])(
  "does not trust public IPv4 through ambiguous IPv6 subnet %s",
  (subnet) => {
    const trust = proxyAddress.compile(subnet);
    expect(trust("198.51.100.24")).toBe(false);
    expect(trust("203.0.113.42")).toBe(false);
    expect(trust("::ffff:198.51.100.24")).toBe(false);
  },
);

/** Закрепляем локальные IPv4/IPv6-адреса и отказ для внешних адресов. */
it.each([
  ["127.0.0.1", true],
  ["::1", true],
  ["::ffff:127.0.0.1", true],
  ["198.51.100.24", false],
  ["::ffff:198.51.100.24", false],
  ["10.0.0.24", false],
] as const)("retains loopback policy for %s", (address, trusted) => {
  expect(proxyAddress.compile("loopback")(address)).toBe(trusted);
});

/** Корректный mapped-префикс принимает свою частную подсеть и отклоняет внешний адрес. */
it("retains correctly spelled mapped IPv4 subnets without trusting outsiders", () => {
  const trust = proxyAddress.compile("::ffff:10.0.0.0/104");
  expect(trust("10.0.0.24")).toBe(true);
  expect(trust("198.51.100.24")).toBe(false);
});
