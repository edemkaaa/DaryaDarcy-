import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PostRecoveryJournal } from "../apps/frontend/src/domain/post/recovery-store";
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import { journalObjectStore } from "./helpers/journal-object-store";

let storage: ReturnType<typeof journalObjectStore>;
beforeEach(() => {
  storage = journalObjectStore();
  vi.stubGlobal("indexedDB", storage.factory);
  setPersonalDataOwner(101);
});
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
});
const video = () => ({
  key: "private-video-original-key",
  file: new File(["video original bytes"], "lesson.mp4", {
    type: "video/mp4",
    lastModified: 1234,
  }),
  attempted: true,
  poster: {
    key: "private-poster-original-key",
    file: new File(["poster bytes"], "poster.png", {
      type: "image/png",
      lastModified: 5678,
    }),
    attempted: true,
  },
});
const editor = (selected = video()) => ({
  draft: {
    text: "Video",
    photos: [],
    videos: [`local-video:${selected.key}`],
    tags: [],
    target: "club" as const,
    status: "draft" as const,
    publishedAt: new Date("2026-10-16"),
    scheduledAt: null,
    sortOrder: 0,
  },
  attachments: [],
  removedIds: [],
  pending: [],
  privateVideos: [selected],
});
const snapshot = (selected = video()) => ({
  ...new PostSaveCoordinator().snapshot(),
  phase: "upload" as const,
  privateVideos: [selected],
});

it("stores video and poster as ArrayBuffer, restores exact Files and editor/coordinator aliases", async () => {
  const selected = video(),
    journal = new PostRecoveryJournal(101, "video");
  await journal.load();
  await journal.write(editor(selected), snapshot(selected));
  const loaded = await new PostRecoveryJournal(101, "video").load();
  const restored = loaded!.editor.privateVideos![0];
  expect(restored.file).toBeInstanceOf(File);
  expect(restored.file.name).toBe("lesson.mp4");
  expect(restored.file.type).toBe("video/mp4");
  expect(restored.file.lastModified).toBe(1234);
  expect(await restored.file.text()).toBe("video original bytes");
  expect(restored.poster!.file.name).toBe("poster.png");
  expect(restored.poster!.file.lastModified).toBe(5678);
  expect(await restored.poster!.file.text()).toBe("poster bytes");
  expect(restored.key).toBe("private-video-original-key");
  expect(restored.poster!.key).toBe("private-poster-original-key");
  expect(loaded!.save.privateVideos![0]).toBe(restored);
});
it("keeps the record owner-scoped and rejects a stale tab revision", async () => {
  const a = new PostRecoveryJournal(101, "video"),
    b = new PostRecoveryJournal(101, "video");
  await a.load();
  await b.load();
  const selected = video();
  await a.write(editor(selected), snapshot(selected));
  await expect(b.write(editor(selected), snapshot(selected))).rejects.toThrow(
    "другой вкладке",
  );
  setPersonalDataOwner(102);
  await expect(a.load()).rejects.toThrow("владельца");
  expect(await new PostRecoveryJournal(102, "video").load()).toBeNull();
  setPersonalDataOwner(101);
  expect(
    (await new PostRecoveryJournal(101, "video").load())!.editor
      .privateVideos![0].key,
  ).toBe(selected.key);
});
it("rejects a corrupted video receipt after storage restore", async () => {
  const selected = video(),
    journal = new PostRecoveryJournal(101, "video");
  await journal.load();
  await journal.write(editor(selected), snapshot(selected));
  const raw = storage.records.get("101:video") as {
    save: { privateVideos: unknown[] };
    editor: { privateVideos: { receipt?: unknown }[] };
  };
  raw.editor.privateVideos[0].receipt = {
    state: "ready",
    assetId: "3af23d8c-140f-454b-a123-123456789abc",
    type: "video",
    filename: "lesson.mp4",
    mimeType: "text/html",
    fileSize: 19,
  };
  await expect(new PostRecoveryJournal(101, "video").load()).rejects.toThrow(
    "повреждён",
  );
});
it("refuses to persist original bytes after an account switch during file preparation", async () => {
  const selected = video(),
    journal = new PostRecoveryJournal(101, "video");
  await journal.load();
  vi.spyOn(selected.file, "arrayBuffer").mockImplementationOnce(async () => {
    setPersonalDataOwner(102);
    return new TextEncoder().encode("video original bytes").buffer;
  });
  await expect(
    journal.write(editor(selected), snapshot(selected)),
  ).rejects.toThrow("владельца");
  expect(storage.records.size).toBe(0);
});
it("blocks a checkpoint when the editor no longer owns the attempted video", async () => {
  const selected = video(),
    journal = new PostRecoveryJournal(101, "video");
  await journal.load();
  await expect(
    journal.write(
      { ...editor(selected), privateVideos: [] },
      snapshot(selected),
    ),
  ).rejects.toThrow();
  expect(storage.records.size).toBe(0);
});
it("keeps legacy journal records without a video field readable", async () => {
  const selected = video(),
    journal = new PostRecoveryJournal(101, "video");
  await journal.load();
  const { privateVideos: omitted, ...oldEditor } = editor(selected);
  oldEditor.draft.videos = [];
  await journal.write(oldEditor, new PostSaveCoordinator().snapshot());
  const raw = storage.records.get("101:video") as {
    editor: { privateVideos?: unknown };
    save: { privateVideos?: unknown };
  };
  delete raw.editor.privateVideos;
  delete raw.save.privateVideos;
  expect(
    (await new PostRecoveryJournal(101, "video").load())!.editor.draft.text,
  ).toBe("Video");
  expect(omitted).toHaveLength(1);
});
it("rejects bytes returned after the owner changed during storage read", async () => {
  const selected = video(),
    journal = new PostRecoveryJournal(101, "video");
  await journal.load();
  await journal.write(editor(selected), snapshot(selected));
  const get = storage.records.get.bind(storage.records);
  vi.spyOn(storage.records, "get").mockImplementationOnce((key) => {
    setPersonalDataOwner(102);
    return get(key);
  });
  await expect(new PostRecoveryJournal(101, "video").load()).rejects.toThrow(
    "владельца",
  );
});
