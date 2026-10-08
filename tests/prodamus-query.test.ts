import { describe, expect, it } from "vitest";
import { buildProdamusQuery } from "../apps/backend/src/billing/prodamus-query";

describe("Prodamus outbound query format", () => {
  it.each([
    {
      name: "keeps zero and false while omitting only empty and nullish values",
      input: {
        empty: "",
        nil: null,
        absent: undefined,
        amount: 0,
        active: false,
      },
      want: "amount=0&active=false",
    },
    {
      name: "preserves field insertion order rather than signature sorting",
      input: { subscription: "7", profile: "23", active_user: "0" },
      want: "subscription=7&profile=23&active_user=0",
    },
    {
      name: "percent-encodes Unicode, spaces and literal plus signs",
      input: { name: "Даша", email: "member+club@example.test", note: "a b" },
      want: "name=%D0%94%D0%B0%D1%88%D0%B0&email=member%2Bclub%40example.test&note=a%20b",
    },
    {
      name: "encodes URL values without exposing their separators as fields",
      input: { url: "https://example.test/a?x=1&y=two#end" },
      want: "url=https%3A%2F%2Fexample.test%2Fa%3Fx%3D1%26y%3Dtwo%23end",
    },
    {
      name: "uses PHP brackets for indexed products and nested object fields",
      input: {
        products: [{ name: "Club", price: "790" }],
        customer: { email: "a@b.test" },
      },
      want: "products[0][name]=Club&products[0][price]=790&customer[email]=a%40b.test",
    },
    {
      name: "keeps sparse array indices instead of compacting skipped values",
      input: { values: [, "", null, "last"], flags: [false, 0] },
      want: "values[3]=last&flags[0]=false&flags[1]=0",
    },
    {
      name: "encodes key separators while retaining bracket notation",
      input: { "extra note": { "x&y": "a=b" }, "list[0]": "ok" },
      want: "extra%20note[x%26y]=a%3Db&list[0]=ok",
    },
    {
      name: "does not emit empty collections",
      input: { array: [], object: {}, keep: "yes" },
      want: "keep=yes",
    },
  ])("$name", ({ input, want }) => {
    expect(buildProdamusQuery(input)).toBe(want);
  });

  it("includes only own enumerable fields, including a literal __proto__ key", () => {
    const nested = Object.create({ inherited: "ignore" });
    Object.defineProperty(nested, "hidden", { value: "ignore" });
    Object.defineProperty(nested, "__proto__", {
      value: "literal",
      enumerable: true,
    });
    nested.kept = "yes";
    const input = Object.assign(Object.create({ inherited: "ignore" }), {
      extra: nested,
    });
    expect(buildProdamusQuery(input)).toBe(
      "extra[__proto__]=literal&extra[kept]=yes",
    );
  });

  it("does not mutate frozen nested input", () => {
    const product = Object.freeze({ name: "Club", count: 1 });
    const products = Object.freeze([product]);
    const input = Object.freeze({ products });
    expect(buildProdamusQuery(input)).toBe(
      "products[0][name]=Club&products[0][count]=1",
    );
    expect(input.products).toBe(products);
    expect(products[0]).toBe(product);
  });
});
