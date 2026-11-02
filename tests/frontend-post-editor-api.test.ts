import {
  createTRPCClient,
  TRPCClientError,
  type Operation,
} from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { beforeEach, expect, it, vi } from "vitest";
import type { AppRouter } from "../apps/frontend/src/shared/api/contract";
import { createPostEditorApi } from "../apps/frontend/src/features/admin/post-editor-api";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";

const uploads = vi.hoisted(() => ({ available: vi.fn(), video: vi.fn() }));
vi.mock("../apps/frontend/src/shared/api/capabilities", () => ({
  requirePrivateUpload: uploads.available,
}));
vi.mock(
  "../apps/frontend/src/features/admin/media/private-video-upload",
  () => ({ uploadAdminPrivateVideo: uploads.video }),
);
beforeEach(() => {
  vi.resetAllMocks();
  uploads.available.mockResolvedValue(undefined);
});

function fixture(
  reply: (operation: Operation) => unknown | Promise<unknown> = () => ({
    state: "notRecorded",
  }),
) {
  const calls: Operation[] = [];
  const client = createTRPCClient<AppRouter>({
    links: [
      () =>
        ({ op }) =>
          observable((observer) => {
            calls.push(op);
            void Promise.resolve()
              .then(() => reply(op))
              .then(
                (data) => {
                  observer.next({ result: { data } });
                  observer.complete();
                },
                (error) => observer.error(TRPCClientError.from(error)),
              );
          }),
    ],
  });
  return { api: createPostEditorApi(client), calls };
}
const task = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;
const draft = serializePostDraft({
  text: "Keep this draft",
  photos: [],
  videos: [],
  tags: [],
  target: "club",
  status: "draft",
  scheduledAt: null,
  publishedAt: new Date("2026-11-02T10:00:00Z"),
  sortOrder: 0,
});

it("keeps the creation key and payload after a lost reply until explicit recovery", async () => {
  let stored: unknown;
  const { api, calls } = fixture((op) => {
    if (op.path !== "admin.createPost") throw Error("unexpected operation");
    if (!stored) {
      stored = op.input;
      throw Error("lost reply after commit");
    }
    expect(op.input).toEqual(stored);
    return 42;
  });
  const coordinator = new PostSaveCoordinator();
  const first = task();
  await expect(
    coordinator.save(draft, [], [], api, first),
  ).rejects.toMatchObject({ uncertain: true });
  expect(calls).toHaveLength(1);
  expect(calls[0].signal).toBe(first.signal);
  const recovery = task();
  await expect(coordinator.recoverCreation(api, recovery)).resolves.toBe(42);
  expect(calls).toHaveLength(2);
  expect(calls[1].input).toEqual(calls[0].input);
  expect(calls[1].signal).toBe(recovery.signal);
});

it("preserves the revision and conflict without retrying the update", async () => {
  const error = new TRPCClientError<AppRouter>("conflict", {
    result: {
      error: {
        message: "conflict",
        code: -32009,
        data: { code: "CONFLICT", httpStatus: 409, path: "admin.updatePost" },
      },
    },
  });
  const { api, calls } = fixture(() => {
    throw error;
  });
  const signal = new AbortController().signal;
  await expect(
    api.update(
      42,
      { text: "Changed", expectedRevision: "revision-before" },
      signal,
    ),
  ).rejects.toBe(error);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    path: "admin.updatePost",
    input: { id: 42, text: "Changed", expectedRevision: "revision-before" },
  });
  expect(calls[0].signal).toBe(signal);
});

it.each(["photo", "attachment", "video"] as const)(
  "does not send a %s upload when capabilities reject it",
  async (kind) => {
    const denied = new Error("uploads disabled");
    uploads.available.mockRejectedValue(denied);
    const { api, calls } = fixture();
    const signal = new AbortController().signal;
    const input = {
      idempotencyKey: "stable-upload-key",
      filename: "file.pdf",
      mimeType: "application/pdf",
      base64: "AA==",
    };
    const result =
      kind === "photo"
        ? api.uploadPrivatePhoto({ ...input, usage: "postPhoto" }, signal)
        : kind === "attachment"
          ? api.uploadPrivate({ ...input, type: "document" }, signal)
          : api.uploadPrivateVideo(
              new File(["video"], "clip.mp4"),
              input.idempotencyKey,
              signal,
            );
    await expect(result).rejects.toBe(denied);
    expect(uploads.available).toHaveBeenCalledWith(
      {
        photo: "privateContentUploads",
        attachment: "privatePostMediaUploads",
        video: "privatePostVideoUploads",
      }[kind],
      signal,
    );
    expect(calls).toHaveLength(0);
    expect(uploads.video).not.toHaveBeenCalled();
  },
);

it("probes content then attachments with the current operation signal", async () => {
  const { api, calls } = fixture();
  const operation = task();
  await api.checkUploadsAvailable(["content", "attachment"], operation);
  expect(calls.map((call) => call.path)).toEqual([
    "admin.privateContentFileStatus",
    "admin.privateAttachmentStatus",
  ]);
  for (const call of calls) {
    expect(call.signal).toBe(operation.signal);
    expect(call.input).toEqual({
      idempotencyKey: expect.stringMatching(/^availability:/),
    });
  }
  expect(calls[0].input).not.toEqual(calls[1].input);
});

it("stops after an account switch while a probe is pending", async () => {
  let release!: (value: unknown) => void;
  const response = new Promise((resolve) => {
    release = resolve;
  });
  const { api, calls } = fixture(() => response);
  let ownerMatches = true;
  const operation = new OperationScope().begin(
    "save",
    new AbortController().signal,
    () => ownerMatches,
  )!;
  const pending = api.checkUploadsAvailable(
    ["content", "attachment"],
    operation,
  );
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  ownerMatches = false;
  release({ state: "notRecorded" });
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(calls).toHaveLength(1);
});
