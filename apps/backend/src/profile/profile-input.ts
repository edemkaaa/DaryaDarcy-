import { z } from "zod";

export const profileUpdateInput = z.object({
  name: z.string().min(1).optional(),
  gender: z.enum(["female", "male"]).optional(),
  avatarUrl: z.string().url().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateInput>;
