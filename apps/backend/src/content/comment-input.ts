import { z } from "zod";

export const addCommentInput = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/).optional(),
  postId: z.number(),
  text: z.string().trim().min(1).max(1000),
  parentId: z.number().optional(),
  photos: z.array(z.string().url().or(z.string().regex(/^\/api\/media\/content-files\/[a-f0-9-]{36}$/))).max(2).optional(),
});

export type AddCommentInput = z.output<typeof addCommentInput>;
