/** Общий транспорт двух редакторов не владеет их черновиками; каждый вызов получает сигнал соответствующей операции. */
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import type { PostSaveApi } from "@/domain/post/save-post";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { requirePrivateUpload } from "@/shared/api/capabilities";
import { checkPrivateUploadAvailability } from "@/shared/media/private-upload-availability";
import { uploadAdminPrivateVideo } from "./media/private-video-upload";

/** Shared transport only; each editor keeps its own session and recovery state. */
export function createPostEditorApi(client: TRPCClient<AppRouter>) {
  return {
    read: (id: number, signal: AbortSignal) =>
      client.admin.postDetail.query({ id }, { signal }),
    checkUploadsAvailable: async (
      kinds: readonly ("content" | "attachment")[],
      task: ScopedOperation,
    ) => {
      for (const kind of kinds) {
        await checkPrivateUploadAvailability(
          (input, signal) =>
            kind === "content"
              ? client.admin.privateContentFileStatus.query(input, {
                  signal,
                })
              : client.admin.privateAttachmentStatus.query(input, {
                  signal,
                }),
          task,
        );
      }
    },
    uploadPrivateVideo: async (
      file: File,
      key: string,
      signal?: AbortSignal,
    ) => {
      await requirePrivateUpload("privatePostVideoUploads", signal);
      return uploadAdminPrivateVideo(file, key, signal);
    },
    create: (
      input: Parameters<typeof client.admin.createPost.mutate>[0],
      signal: AbortSignal,
    ) => client.admin.createPost.mutate(input, { signal }),
    update: (
      id: number,
      input: Omit<Parameters<typeof client.admin.updatePost.mutate>[0], "id">,
      signal: AbortSignal,
    ) => client.admin.updatePost.mutate({ id, ...input }, { signal }),
    upload: (
      input: Parameters<typeof client.admin.uploadMedia.mutate>[0],
      signal: AbortSignal,
    ) => client.admin.uploadMedia.mutate(input, { signal }),
    uploadPrivate: async (
      input: Parameters<typeof client.admin.uploadPrivateAttachment.mutate>[0],
      signal: AbortSignal,
    ) => {
      await requirePrivateUpload("privatePostMediaUploads", signal);
      return client.admin.uploadPrivateAttachment.mutate(input, {
        signal,
      });
    },
    privateStatus: (
      input: Parameters<typeof client.admin.privateAttachmentStatus.query>[0],
      signal: AbortSignal,
    ) => client.admin.privateAttachmentStatus.query(input, { signal }),
    uploadPrivatePhoto: async (
      input: Parameters<typeof client.admin.uploadPrivateContentFile.mutate>[0],
      signal: AbortSignal,
    ) => {
      await requirePrivateUpload("privateContentUploads", signal);
      return client.admin.uploadPrivateContentFile.mutate(input, {
        signal,
      });
    },
    privatePhotoStatus: (
      input: Parameters<typeof client.admin.privateContentFileStatus.query>[0],
      signal: AbortSignal,
    ) => client.admin.privateContentFileStatus.query(input, { signal }),
  } satisfies PostSaveApi;
}
