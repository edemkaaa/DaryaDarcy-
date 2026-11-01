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
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("accepts revision zero, nullable embed, and compatible additional fields", () => {
  expect(
    parseVkEditorDetail({ ...detail, embedUrl: null, extra: true }, 18),
  ).toEqual({ ...detail, embedUrl: null });
  expect(vkEditorPayload(draftFromVkDetail(101, detail), false)).toMatchObject({
    id: 18,
    expectedRevision: 0,
  });
});
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
it("another actor cannot read or overwrite the previous account's draft", () => {
  const store = new VkEditorDraftStore(101);
  store.save(draftFromVkDetail(101, detail));
  setPersonalDataOwner(102);
  expect(() => store.read()).toThrow();
  expect(() => store.save(emptyVkEditorDraft(101))).toThrow();
  expect(new VkEditorDraftStore(102).read()).toBeNull();
});
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
