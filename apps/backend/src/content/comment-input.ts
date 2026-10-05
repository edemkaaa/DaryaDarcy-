import { z } from "zod";

export const addCommentInput = z.object({
  postId: z.number(),
  text: z.string().trim().min(1).max(1000),
  parentId: z.number().optional(),
  photos: z.array(z.string().url()).max(2).optional(),
});

export type AddCommentInput = z.output<typeof addCommentInput>;
