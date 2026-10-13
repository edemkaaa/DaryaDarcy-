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
      // Legacy import is always public YouTube. Never silently discard a
      // requested private/provider policy and publish that source instead.
      access: z.never().optional(),
      provider: z.never().optional(),
      vkEmbedUrl: z.never().optional(),
      vkSourceKey: z.never().optional(),
    }),
  ),
});

export type ImportVideosInput = z.output<typeof importVideosInput>;
