import { z } from "zod";
import { postAttachmentInput } from "./post-attachments";

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
  text: z.string().min(1),
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
  source: z.string().default("manual"),
  published: z.boolean().default(true),
  sortOrder: z.number().default(0),
  status: z.enum(["draft", "scheduled", "published"]).default("published"),
  target: z.enum(["feed", "club", "both"]).default("feed"),
  scheduledAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  richText: z.any().optional(),
});

export const updatePostInput = z.object({
  id: z.number(),
  text: z.string().optional(),
  photos: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  attachments: z.array(postAttachmentInput).max(100).optional(),
  privateAssetIds: z.array(z.string().uuid()).max(100).optional(),
  privateVideoPosters,
  removedMediaIds: z.array(z.number().int().positive()).max(100).optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().optional(),
  status: z.enum(["draft", "scheduled", "published"]).optional(),
  target: z.enum(["feed", "club", "both"]).optional(),
  scheduledAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  richText: z.any().optional(),
});

export type CreatePostInput = z.output<typeof createPostInput>;
export type UpdatePostInput = z.output<typeof updatePostInput>;
