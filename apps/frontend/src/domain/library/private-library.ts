"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  aestheticGuideSchema,
  type AestheticGuideKey,
} from "@shared/aesthetic-guide";
import { apiCall } from "@/shared/api/auth";
import { invalidResponse } from "@/shared/api/errors";
import { useAuth } from "@/domain/session/session-context";
import { useClub } from "@/domain/subscription/subscription-context";

const privateReadOptions = {
  retry: false,
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: "always",
  refetchOnReconnect: "always",
} as const;

export async function readAestheticGuide(
  key: AestheticGuideKey,
  signal?: AbortSignal,
) {
  const value = await apiCall<unknown>(
    `/api/library/guides/aesthetics/${key}`,
    { signal },
  );
  signal?.throwIfAborted();
  const parsed = aestheticGuideSchema.safeParse(value);
  if (!parsed.success || parsed.data.key !== key) throw invalidResponse();
  return parsed.data;
}

/** Private reads never reuse another identity's result or display failed/stale refreshes. */
export function useAestheticGuides(
  keys: readonly AestheticGuideKey[],
  requested = true,
) {
  const { user } = useAuth();
  const { hasClubAccess } = useClub();
  const enabled = Boolean(user && hasClubAccess && requested);
  const queries = useQueries({
    queries: keys.map((key) => ({
      ...privateReadOptions,
      queryKey: ["private-library-guide", user?.id, key],
      enabled,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readAestheticGuide(key, signal),
    })),
  });
  return queries.map((query) => ({
    data:
      enabled && query.isSuccess && !query.isFetching ? query.data : undefined,
    isLoading: enabled && (query.isPending || query.isFetching),
    error: enabled ? query.error : null,
    retry: () => {
      if (enabled) void query.refetch();
    },
  }));
}

const bindingSchema = z
  .object({
    fileKey: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    sortOrder: z.number().int().nonnegative(),
    revision: z.number().int().positive(),
    filename: z.string(),
    mimeType: z.string(),
    fileSize: z.number().int().positive(),
    url: z.string(),
  })
  .strict();
const bindingsPageSchema = z
  .object({
    files: z.array(bindingSchema).max(50),
    nextCursor: z
      .string()
      .regex(/^(0|[1-9]\d*):[1-9]\d*$/)
      .nullable(),
  })
  .strict();
export type PatternBinding = z.infer<typeof bindingSchema>;
const patternKeys = ["holly", "sock", "star", "apple", "loshadka"];

export async function readPatternBindings(signal?: AbortSignal) {
  const files: Record<string, PatternBinding> = {};
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const value = await apiCall<unknown>(
      `/api/library/materials/patterns/files${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    );
    signal?.throwIfAborted();
    const parsed = bindingsPageSchema.safeParse(value);
    if (!parsed.success) throw invalidResponse();
    for (const file of parsed.data.files) {
      if (file.url !== `/api/media/library-files/patterns/${file.fileKey}`)
        throw invalidResponse();
      if (patternKeys.includes(file.fileKey)) {
        if (files[file.fileKey]) throw invalidResponse();
        if (
          file.fileKey === "loshadka"
            ? file.mimeType !== "application/pdf"
            : !["image/jpeg", "image/png", "image/webp"].includes(file.mimeType)
        )
          throw invalidResponse();
        files[file.fileKey] = file;
      }
    }
    cursor = parsed.data.nextCursor;
    if (cursor && cursors.has(cursor)) throw invalidResponse();
    if (cursor) cursors.add(cursor);
  } while (cursor && !patternKeys.every((key) => files[key]));
  return files;
}

export function usePatternBindings() {
  const { user } = useAuth();
  const { hasClubAccess } = useClub();
  const enabled = Boolean(user && hasClubAccess);
  const query = useQuery({
    ...privateReadOptions,
    queryKey: ["private-library-patterns", user?.id],
    enabled,
    queryFn: ({ signal }) => readPatternBindings(signal),
  });
  return {
    files:
      enabled && query.isSuccess && !query.isFetching ? query.data : undefined,
    isLoading: enabled && (query.isPending || query.isFetching),
    error: enabled ? query.error : null,
    retry: () => {
      if (enabled) void query.refetch();
    },
  };
}
