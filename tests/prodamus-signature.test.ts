import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProdamusSign as signPayload } from "../apps/backend/src/billing/prodamus-signature";
import {
  createProdamusSign,
  verifyProdamusSign,
} from "../apps/backend/src/prodamus";

const secret = "signature-fixture-only-secret";
// Canonical strings are hand-derived, not produced by the production normalizer.
function independentSign(canonical: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

beforeEach(() => {
  vi.stubEnv("PRODAMUS_SECRET", secret);
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("Prodamus signature canonicalization", () => {
  it.each([
    {
      name: "ordinary nested values, array order, Unicode and escaped slashes",
      raw: '{"z":[2,null,true],"a":{"url":"https://example.test/Клуб","n":7,"enabled":false}}',
      canonical:
        '{"a":{"enabled":"false","n":"7","url":"https:\\/\\/example.test\\/Клуб"},"z":["2","","true"]}',
    },
    {
      name: "own scalar __proto__ at the root",
      raw: '{"payment_status":"pending","__proto__":"private-field"}',
      canonical: '{"__proto__":"private-field","payment_status":"pending"}',
    },
    {
      name: "own object __proto__ at the root",
      raw: '{"payment_status":"pending","__proto__":{"z":2,"a":1}}',
      canonical: '{"__proto__":{"a":"1","z":"2"},"payment_status":"pending"}',
    },
    {
      name: "own null __proto__ at the root",
      raw: '{"payment_status":"pending","__proto__":null}',
      canonical: '{"__proto__":"","payment_status":"pending"}',
    },
    {
      name: "nested __proto__ and other Object prototype property names",
      raw: '{"subscription":{"prototype":true,"constructor":7,"__proto__":{"id":23}}}',
      canonical:
        '{"subscription":{"__proto__":{"id":"23"},"constructor":"7","prototype":"true"}}',
    },
    {
      name: "own __proto__ inside an array element",
      raw: '{"products":[{"price":790,"__proto__":{"name":"Клуб"}}]}',
      canonical: '{"products":[{"__proto__":{"name":"Клуб"},"price":"790"}]}',
    },
  ])(
    "signs $name without dropping any own JSON fields",
    ({ raw, canonical }) => {
      const payload = JSON.parse(raw);
      expect(signPayload(payload, secret)).toBe(independentSign(canonical));
      expect(createProdamusSign(payload, secret)).toBe(
        independentSign(canonical),
      );
      expect(verifyProdamusSign(payload, independentSign(canonical))).toBe(
        true,
      );
      expect(JSON.stringify(payload)).toBe(raw);
    },
  );

  it.each([null, undefined])(
    "signs a nullish root as an empty string: %s",
    (input) => {
      expect(signPayload(input, secret)).toBe(independentSign('""'));
      expect(createProdamusSign(input, secret)).toBe(independentSign('""'));
    },
  );

  it("signs only own enumerable fields without mutating frozen nested input", () => {
    const input = Object.freeze(
      Object.assign(Object.create({ inherited: "not-signed" }), {
        z: undefined,
        a: Object.freeze([true, Object.freeze({ url: "/club", n: 7 })]),
      }),
    );
    const canonical = '{"a":["true",{"n":"7","url":"\\/club"}],"z":""}';
    expect(signPayload(input, secret)).toBe(independentSign(canonical));
    expect(createProdamusSign(input, secret)).toBe(independentSign(canonical));
    expect(input.inherited).toBe("not-signed");
    expect(input.a[1]).toEqual({ url: "/club", n: 7 });
    expect(input.z).toBeUndefined();
  });

  it.each([
    {
      name: "root object",
      raw: '{"payment_status":"pending","__proto__":{"note":"unsigned"}}',
      canonical: '{"payment_status":"pending"}',
    },
    {
      name: "nested object",
      raw: '{"subscription":{"id":7,"__proto__":{"note":"unsigned"}},"payment_status":"pending"}',
      canonical: '{"payment_status":"pending","subscription":{"id":"7"}}',
    },
    {
      name: "array element",
      raw: '{"products":[{"price":790,"__proto__":"unsigned"}],"payment_status":"pending"}',
      canonical: '{"payment_status":"pending","products":[{"price":"790"}]}',
    },
  ])("rejects an unsigned own field added to a $name", ({ raw, canonical }) => {
    expect(
      verifyProdamusSign(JSON.parse(raw), independentSign(canonical)),
    ).toBe(false);
  });
});
