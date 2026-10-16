import { expect, it, vi } from "vitest";
vi.mock("../apps/frontend/src/shared/media/video-poster", () => ({
  extractVideoPosterBlob: vi.fn(),
}));
import { extractVideoPosterBlob } from "../apps/frontend/src/shared/media/video-poster";
import { preparePrivatePostVideo } from "../apps/frontend/src/features/admin/use-private-post-videos";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
const extract = vi.mocked(extractVideoPosterBlob);
const source = () =>
  new File(["original bytes"], "lesson.mp4", {
    type: "video/mp4",
    lastModified: 42,
  });
function scope(owns = () => true) {
  const scope = new OperationScope();
  return {
    scope,
    task: scope.begin("video", new AbortController().signal, owns)!,
  };
}
it("selects the immutable original File under one stable key, without network or a receipt", async () => {
  extract.mockClear();
  const file = source();
  const video = await preparePrivatePostVideo(file, scope().task);
  expect(video.file).toBe(file);
  expect(await video.file.text()).toBe("original bytes");
  expect(video.file.lastModified).toBe(42);
  expect(video.key).toMatch(/^[a-z\d-]{36}$/);
  expect(video).not.toHaveProperty("receipt");
  expect(video).not.toHaveProperty("attempted");
  expect(extract).not.toHaveBeenCalled();
});
it("keeps an optional poster as a separate private File/key, not a gallery URL", async () => {
  const blob = new Blob(["poster bytes"], { type: "image/jpeg" });
  extract.mockResolvedValueOnce(blob);
  const file = source(),
    { task } = scope();
  const video = await preparePrivatePostVideo(file, task, true);
  expect(extract).toHaveBeenLastCalledWith(file, task.signal);
  expect(video.poster?.key).not.toBe(video.key);
  expect(video.poster?.file.type).toBe("image/jpeg");
  expect(await video.poster?.file.text()).toBe("poster bytes");
});
it.each([null, "error"])(
  "keeps the original video if optional cover extraction yields %s",
  async (outcome) => {
    if (outcome === "error")
      extract.mockRejectedValueOnce(Error("Codec unsupported"));
    else extract.mockResolvedValueOnce(null);
    const file = source();
    const video = await preparePrivatePostVideo(file, scope().task, true);
    expect(video.file).toBe(file);
    expect(video.poster).toBeUndefined();
  },
);
it("refuses a cancelled selection before preparing a cover", async () => {
  extract.mockClear();
  const { scope: owner, task } = scope();
  owner.cancel();
  await expect(
    preparePrivatePostVideo(source(), task, true),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(extract).not.toHaveBeenCalled();
});
it.each([false, true])(
  "ignores late cover results/errors after account change (%s)",
  async (reject) => {
    let owner = true;
    const { task } = scope(() => owner);
    let finish!: () => void;
    const pending = new Promise<Blob | null>((resolve, fail) => {
      finish = () =>
        reject
          ? fail(Error("late codec error"))
          : resolve(new Blob(["late"], { type: "image/jpeg" }));
    });
    // Consume a rejected fixture even when an unimplemented selector never calls it.
    void pending.catch(() => {});
    extract.mockReturnValueOnce(pending);
    const result = preparePrivatePostVideo(source(), task, true);
    owner = false;
    finish();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  },
);
it("rejects an invalid source before optional cover work", async () => {
  extract.mockClear();
  await expect(
    preparePrivatePostVideo(new File([], "empty.mp4"), scope().task, true),
  ).rejects.toThrow();
  expect(extract).not.toHaveBeenCalled();
});
