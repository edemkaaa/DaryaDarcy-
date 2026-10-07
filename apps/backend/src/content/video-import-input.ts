import { z } from "zod";

// Existing wire contract; the service accepts its validated output.
export const importVideosInput = z.object({
  videos: z.array(
    z.object({
      youtubeId: z.string(),
      title: z.string(),
      duration: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      views: z.string().optional(),
      publishedText: z.string().optional(),
    }),
  ),
});

export type ImportVideosInput = z.output<typeof importVideosInput>;
