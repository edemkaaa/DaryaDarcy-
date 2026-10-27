import { z } from "zod";
import { postAttachmentInput } from "./post-attachments";
import { postTextInput } from "./post-text-limit";
import {
  contentSortOrderInput,
  postTimestampInput,
} from "./content-write-input";

const privateVideoPosters = z
  .array(
    z
      .object({
        videoAssetId: z.string().uuid(),
        posterAssetId: z.string().uuid(),
      })
      .strict(),
  )
  .max(100)
  .optional();

// These existing wire schemas also define the validated service inputs.
export const createPostInput = z.object({
  text: postTextInput.min(1),
  idempotencyKey: z
    .string()
    .regex(/^[A-Za-z0-9._:-]{16,128}$/)
    .optional(),
  photos: z.array(z.string()),
  tags: z.array(z.string()),
  videos: z.array(z.string()).optional(),
  attachments: z.array(postAttachmentInput).max(100).optional(),
  privateAssetIds: z.array(z.string().uuid()).max(100).optional(),
  privateVideoPosters,
  source: z.string().max(32).refine(value =>
    !value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().startsWith("article:"),
    "Анонс статьи создаётся автоматически",
  ).default("manual"),
  published: z.boolean().default(true),
  sortOrder: contentSortOrderInput.default(0),
  status: z.enum(["draft", "scheduled", "published"]).default("published"),
  target: z.enum(["feed", "club", "both"]).default("feed"),
  scheduledAt: postTimestampInput,
  publishedAt: postTimestampInput,
  richText: z.any().optional(),
});

export const updatePostInput = z.object({
  id: z.number().int().positive().safe(),
  text: postTextInput.optional(),
  photos: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  attachments: z.array(postAttachmentInput).max(100).optional(),
  privateAssetIds: z.array(z.string().uuid()).max(100).optional(),
  privateVideoPosters,
  removedMediaIds: z.array(z.number().int().positive()).max(100).optional(),
  published: z.boolean().optional(),
  sortOrder: contentSortOrderInput.optional(),
  status: z.enum(["draft", "scheduled", "published"]).optional(),
  target: z.enum(["feed", "club", "both"]).optional(),
  scheduledAt: postTimestampInput,
  publishedAt: postTimestampInput,
  richText: z.any().optional(),
});

export type CreatePostInput = z.output<typeof createPostInput>;
export type UpdatePostInput = z.output<typeof updatePostInput>;
