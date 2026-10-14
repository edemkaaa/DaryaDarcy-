import { expect, it } from "vitest";
import {
  parseArticleCreationRecord,
  parseArticleCreationStatus,
} from "../apps/frontend/src/domain/content/article-creation-journal";

const record = {
  version: 1,
  ownerId: 101,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  payload: {
    title: "Статья",
    coverUrl: null,
    access: "club",
    published: true,
    sections: [
      { type: "text", text: "" },
      { type: "photo", url: "", caption: "" },
      {
        type: "carousel",
        urls: [
          "https://example.test/2",
          "https://example.test/1",
          "https://example.test/2",
        ],
      },
    ],
  },
};
it("restores the exact original payload including empty blocks and ordered repeated URLs", () => {
  const restored = parseArticleCreationRecord(
    JSON.parse(JSON.stringify(record)),
    101,
  );
  expect(restored).toEqual(record);
  restored.payload.sections[0].text = "Changed form";
  expect(record.payload.sections[0].text).toBe("");
});
it("never assigns another account's saved operation to the current editor", () => {
  expect(() => parseArticleCreationRecord(record, 102)).toThrow("повреждена");
});
it.each([
  null,
  {},
  { ...record, version: 2 },
  { ...record, idempotencyKey: "00000000-0000-4000-8000-00000000000A" },
  { ...record, idempotencyKey: "00000000-0000-1000-8000-000000000001" },
  { ...record, payload: { ...record.payload, published: "true" } },
  {
    ...record,
    payload: { ...record.payload, sections: [{ type: "photo", url: 1 }] },
  },
])("rejects a corrupt operation rather than replacing it (%#)", (value) => {
  expect(() => parseArticleCreationRecord(value, 101)).toThrow();
});
it.each([
  { status: "notRecorded" },
  { status: "created", articleId: 42 },
  { status: "deleted", articleId: 42 },
])("accepts only server-confirmed status %j", (value) => {
  expect(parseArticleCreationStatus(value)).toEqual(value);
});
it.each([
  null,
  {},
  { status: "pending" },
  { status: "created", articleId: "42" },
  { status: "deleted", articleId: 0 },
  { status: "created", articleId: Number.MAX_SAFE_INTEGER + 1 },
  { status: "notRecorded", articleId: 42 },
])("never treats malformed status as permission to create (%#)", (value) => {
  expect(() => parseArticleCreationStatus(value)).toThrow();
});
