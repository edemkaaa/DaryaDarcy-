/** VK editor сохраняет base revision/uncertain payload между reload, не подменяя ручной ввод свежим серверным ответом. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import { parseVkEditorDetail } from "../apps/frontend/src/features/videos/catalog-api";
import {
  VkEditorDraftStore,
  draftFromVkDetail,
  emptyVkEditorDraft,
  vkEditorPayload,
  reviewVkDraft,
  reconcileVkDraft,
  vkEditorDraftKey,
} from "../apps/frontend/src/features/admin/vk-editor-draft";
const detail = {
  id: 18,
  title: "Original",
  embedUrl: "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh",
  access: "club" as const,
  published: false,
  thumbnailUrl: "/assets/responsive/old.webp",
  editRevision: 0,
};
let values: Map<string, string>;
/** Map sessionStorage принадлежит synthetic owner101. */
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  });
  setPersonalDataOwner(101);
});
/** Снимаем owner/globals/spies. */
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
/** Revision0 валиден; parser убирает дополнительные поля, update содержит expectedRevision0. */
it("accepts revision zero, nullable embed, and compatible additional fields", () => {
  expect(
    parseVkEditorDetail({ ...detail, embedUrl: null, extra: true }, 18),
  ).toEqual({ ...detail, embedUrl: null });
  expect(vkEditorPayload(draftFromVkDetail(101, detail), false)).toMatchObject({
    id: 18,
    expectedRevision: 0,
  });
});
/** Неверные id/revision/URL/boolean не становятся base редактирования. */
it.each([
  {},
  { ...detail, id: 19 },
  { ...detail, editRevision: -1 },
  { ...detail, editRevision: 0.5 },
  { ...detail, editRevision: Number.MAX_SAFE_INTEGER + 1 },
  { ...detail, embedUrl: "javascript:alert(1)" },
  { ...detail, published: "true" },
])("rejects malformed or mismatched detail %j", (value) => {
  expect(() => parseVkEditorDetail(value, 18)).toThrow();
});
/** Review свежего snapshot сохраняет ввод и старый base до явного reconcile, после которого write использует новую ревизию. */
it("persists draft, original revision and uncertain state across reload without rebasing", () => {
  const store = new VkEditorDraftStore(101);
  const draft = {
    ...draftFromVkDetail(101, detail),
    title: "My unsaved title",
    state: "uncertain" as const,
  };
  store.save(draft);
  const restored = new VkEditorDraftStore(101).read()!;
  expect(restored).toEqual(draft);
  const reviewed = reviewVkDraft(restored, {
    ...detail,
    title: "Another admin",
    editRevision: 1,
  });
  expect(reviewed.base?.editRevision).toBe(0);
  expect(reviewed.title).toBe("My unsaved title");
  expect(() => vkEditorPayload(reviewed, true)).toThrow("сверку");
  const reconciled = reconcileVkDraft(reviewed);
  expect(reconciled.title).toBe(draft.title);
  expect(vkEditorPayload(reconciled, true)).toMatchObject({
    title: draft.title,
    expectedRevision: 1,
  });
});
/** Scope owner не даёт другому аккаунту прочитать/заменить прежний draft. */
it("another actor cannot read or overwrite the previous account's draft", () => {
  const store = new VkEditorDraftStore(101);
  store.save(draftFromVkDetail(101, detail));
  setPersonalDataOwner(102);
  expect(() => store.read()).toThrow();
  expect(() => store.save(emptyVkEditorDraft(101))).toThrow();
  expect(new VkEditorDraftStore(102).read()).toBeNull();
});
/** Corrupt/foreign/base revision/write/readback failure не разрешают отправку без журнала. */
it.each(["corrupt", "owner", "revision", "write", "verify"])(
  "exposes %s persistence failures before mutation",
  (fault) => {
    const store = new VkEditorDraftStore(101);
    if (fault === "corrupt") values.set(vkEditorDraftKey(101), "{broken");
    if (fault === "owner")
      values.set(
        vkEditorDraftKey(101),
        JSON.stringify(emptyVkEditorDraft(102)),
      );
    if (fault === "revision")
      values.set(
        vkEditorDraftKey(101),
        JSON.stringify({
          ...draftFromVkDetail(101, detail),
          base: { ...detail, editRevision: -1 },
        }),
      );
    if (["corrupt", "owner", "revision"].includes(fault)) {
      expect(() => store.read()).toThrow();
      return;
    }
    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      if (fault === "write") throw Error("quota");
    });
    expect(() => store.save(draftFromVkDetail(101, detail))).toThrow();
  },
);
/** Create payload не притворяется update существующего video. */
it("new videos never receive an ID or expected revision", () => {
  expect(
    vkEditorPayload(
      { ...emptyVkEditorDraft(101), title: "New", embedUrl: detail.embedUrl },
      true,
    ),
  ).toEqual({
    title: "New",
    embedUrl: detail.embedUrl + "&autoplay=0",
    access: "club",
    published: false,
  });
});
/** Публичная обложка попадает в запрос создания и редактирования без изменения ревизии. */
it.each([false, true])("saves a public-v1 cover with editing=%s", (editing) => {
  const thumbnailUrl =
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp";
  const draft = editing
    ? draftFromVkDetail(101, detail)
    : { ...emptyVkEditorDraft(101), title: "New", embedUrl: detail.embedUrl };
  const payload = vkEditorPayload(
    { ...draft, thumbnailChanged: true, thumbnailUrl },
    true,
  );
  expect(payload.thumbnailUrl).toBe(thumbnailUrl);
  if (editing) expect(payload).toMatchObject({ id: 18, expectedRevision: 0 });
  else expect(payload).not.toHaveProperty("id");
});

/** Uncertain writePayload неизменен после reload даже при другом thumbnail build flag. */
it("a create replay retains its original cover payload even if build flags change after reload", () => {
  const draft = {
    ...emptyVkEditorDraft(101),
    title: "New",
    embedUrl: detail.embedUrl,
    thumbnailChanged: true,
    thumbnailUrl: "/assets/responsive/new.webp",
  };
  const payload = vkEditorPayload(draft, true);
  const store = new VkEditorDraftStore(101);
  store.save({ ...draft, state: "uncertain", writePayload: payload });
  expect(vkEditorPayload(new VkEditorDraftStore(101).read()!, false)).toEqual(
    payload,
  );
});
/** Редактирование без current matching base или после conflict требует сверки, не blind overwrite. */
it("requires a matching loaded base for an update and a fresh base after 409/412", () => {
  expect(() =>
    vkEditorPayload(
      {
        ...emptyVkEditorDraft(101),
        editing: true,
        id: "18",
        title: "Title",
        embedUrl: detail.embedUrl,
      },
      true,
    ),
  ).toThrow("загрузите");
  expect(() =>
    vkEditorPayload({ ...draftFromVkDetail(101, detail), id: "19" }, true),
  ).toThrow("загрузите");
  expect(() =>
    vkEditorPayload(
      { ...draftFromVkDetail(101, detail), state: "conflict" },
      true,
    ),
  ).toThrow();
  expect(() => reconcileVkDraft(draftFromVkDetail(101, detail))).toThrow();
});
/** Omitted/null/new cover не смешиваются; explicit removal сохраняется через review/reconcile. */
it("keeps omitted cover, explicit removal and replacement distinct after reconciliation", () => {
  const draft = draftFromVkDetail(101, detail);
  expect(vkEditorPayload(draft, true)).not.toHaveProperty("thumbnailUrl");
  expect(
    vkEditorPayload(
      { ...draft, thumbnailChanged: true, thumbnailUrl: "" },
      true,
    ),
  ).toHaveProperty("thumbnailUrl", null);
  expect(
    vkEditorPayload(
      {
        ...draft,
        thumbnailChanged: true,
        thumbnailUrl: "/assets/responsive/new.webp",
      },
      true,
    ),
  ).toHaveProperty("thumbnailUrl", "/assets/responsive/new.webp");
  expect(
    vkEditorPayload(
      { ...draft, thumbnailChanged: true, thumbnailUrl: "" },
      false,
    ),
  ).not.toHaveProperty("thumbnailUrl");
  const reviewed = reviewVkDraft(
    { ...draft, thumbnailChanged: true, thumbnailUrl: "" },
    {
      ...detail,
      editRevision: 1,
      thumbnailUrl: "/assets/responsive/other.webp",
    },
  );
  expect(vkEditorPayload(reconcileVkDraft(reviewed), true)).toHaveProperty(
    "thumbnailUrl",
    null,
  );
});
