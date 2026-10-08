import { describe, expect, it } from "vitest";
import { parseProdamusPayload } from "../apps/backend/src/billing/prodamus-payload";

describe("Prodamus payload parsing compatibility", () => {
  it("takes the first repeated scalar query value and ignores structured query values", () => {
    const query = {
      payment_status: ["pending", "success"],
      "subscription[id]": "7",
      object: { ignored: "value" },
      laterString: [{ ignored: "value" }, "not-first"],
      empty: [],
      number: 7,
    };
    expect(parseProdamusPayload(query, undefined)).toEqual({
      payment_status: "pending",
      subscription: { id: "7" },
    });
  });

  it.each(["buffer", "string", "object"])(
    "%s body overrides whole query fields, not individual nested keys",
    (encoding) => {
      const query = Object.freeze({
        payment_status: "success",
        "subscription[id]": "7",
        note: "query",
      });
      const value = Object.freeze({
        payment_status: "pending",
        subscription: Object.freeze({ profile_id: "23" }),
      });
      const raw =
        '{"payment_status":"pending","subscription":{"profile_id":"23"}}';
      const body =
        encoding === "buffer"
          ? Buffer.from(raw)
          : encoding === "string"
            ? raw
            : value;
      expect(parseProdamusPayload(query, body)).toEqual({
        payment_status: "pending",
        subscription: { profile_id: "23" },
        note: "query",
      });
      expect(query).toEqual({
        payment_status: "success",
        "subscription[id]": "7",
        note: "query",
      });
      expect(value).toEqual({
        payment_status: "pending",
        subscription: { profile_id: "23" },
      });
    },
  );

  it.each(["buffer", "string"])(
    "decodes %s form data with indexed objects and last duplicate values",
    (encoding) => {
      const raw =
        "payment_status=success&payment_status=pending&products[0][name]=%D0%9A%D0%BB%D1%83%D0%B1&products[1][price]=790.00&note=hello+world%2Fclub";
      expect(
        parseProdamusPayload(
          { retained: "query" },
          encoding === "buffer" ? Buffer.from(raw) : raw,
        ),
      ).toEqual({
        retained: "query",
        payment_status: "pending",
        products: { "0": { name: "Клуб" }, "1": { price: "790.00" } },
        note: "hello world/club",
      });
    },
  );

  it.each([
    {
      raw: "subscription=old&subscription[id]=7",
      want: { subscription: { id: "7" } },
    },
    {
      raw: "subscription[id]=7&subscription=new",
      want: { subscription: "new" },
    },
    {
      raw: "subscription[id]=7&subscription[id]=8",
      want: { subscription: { id: "8" } },
    },
  ])(
    "retains form insertion-order collision behavior: $raw",
    ({ raw, want }) => {
      expect(parseProdamusPayload({}, raw)).toEqual(want);
    },
  );

  it.each([
    "null",
    "7",
    "true",
    '"text"',
    "[]",
    '[{"payment_status":"success"}]',
  ])("does not reinterpret valid non-object JSON as form data: %s", (raw) => {
    expect(parseProdamusPayload({ payment_status: "pending" }, raw)).toEqual({
      payment_status: "pending",
    });
  });

  it.each([
    { name: "undefined", body: undefined },
    { name: "null", body: null },
    { name: "array", body: [] },
    { name: "blank string", body: " \n\t" },
    { name: "blank buffer", body: Buffer.from(" \n\t") },
  ])("retains query fields with an absent or empty $name body", ({ body }) => {
    expect(parseProdamusPayload({ payment_status: "pending" }, body)).toEqual({
      payment_status: "pending",
    });
  });

  it.each(["__proto__", "constructor", "prototype"])(
    "blocks %s path segments in query and form before authentication",
    (blocked) => {
      const flat = {
        note: "safe",
        [`${blocked}[polluted]`]: "root",
        [`subscription[${blocked}][polluted]`]: "nested",
        "subscription[id]": "7",
      };
      const want = { note: "safe", subscription: { id: "7" } };
      expect(parseProdamusPayload(flat, undefined)).toEqual(want);
      expect(
        parseProdamusPayload({}, new URLSearchParams(flat).toString()),
      ).toEqual(want);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    },
  );

  it("preserves own JSON __proto__ fields for signature verification", () => {
    const raw =
      '{"__proto__":{"note":"signed"},"subscription":{"__proto__":"nested"},"products":[{"__proto__":null}]}';
    const parsed = parseProdamusPayload({}, Buffer.from(raw));
    expect(JSON.stringify(parsed)).toBe(raw);
    expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).note).toBeUndefined();
  });
});
