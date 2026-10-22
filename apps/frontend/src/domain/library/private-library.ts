"use client";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import {
  aestheticGuideSchema,
  type AestheticGuideKey,
} from "@shared/aesthetic-guide";
import { apiCall } from "@/shared/api/auth";
import { invalidResponse } from "@/shared/api/errors";
import { useAuth } from "@/domain/session/session-context";
import { useClub } from "@/domain/subscription/subscription-context";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { contentRefreshOptions } from "@/shared/api/content-refresh";

const privateReadOptions = {
  retry: false,
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: "always",
  refetchOnReconnect: "always",
} as const;

function useCancelHiddenRead(
  namespace: string,
  ownerId: number | undefined,
  active: boolean,
) {
  const client = useQueryClient();
  useEffect(() => {
    if (active) return;
    let hidden = true;
    // Query observers apply enabled=false in their own effects. Check after
    // those updates, and never cancel a shared guide used by another screen.
    queueMicrotask(() => {
      if (hidden)
        void client.cancelQueries({
          queryKey: [namespace, ownerId],
          predicate: (query) => !query.isActive(),
        });
    });
    return () => {
      hidden = false;
    };
  }, [active, client, namespace, ownerId]);
}

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

/** Private data stays in this identity's memory; denied/failed reads hide it.
 * Revalidation keeps the confirmed DOM until a result arrives, rather than
 * replacing it with a loader on every visit or resume.
 */
export function useAestheticGuides(
  keys: readonly AestheticGuideKey[],
  requested = true,
) {
  const { user } = useAuth();
  const { hasClubAccess } = useClub();
  const active = useScreenActive();
  const allowed = Boolean(user && hasClubAccess && requested);
  useCancelHiddenRead("private-library-guide", user?.id, active);
  const queries = useQueries({
    queries: keys.map((key) => ({
      ...contentRefreshOptions(allowed && active),
      ...privateReadOptions,
      queryKey: ["private-library-guide", user?.id, key],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readAestheticGuide(key, signal),
    })),
  });
  return queries.map((query) => ({
    data: allowed && query.isSuccess ? query.data : undefined,
    isLoading: allowed && query.isPending,
    error: allowed ? query.error : null,
    retry: () => {
      if (allowed && active) void query.refetch({ cancelRefetch: false });
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
const patternKeys = ["holly", "sock", "star", "apple"];

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
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimeType))
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
  const active = useScreenActive();
  const allowed = Boolean(user && hasClubAccess);
  useCancelHiddenRead("private-library-patterns", user?.id, active);
  const query = useQuery({
    ...contentRefreshOptions(allowed && active),
    ...privateReadOptions,
    queryKey: ["private-library-patterns", user?.id],
    queryFn: ({ signal }) => readPatternBindings(signal),
  });
  return {
    files: allowed && query.isSuccess ? query.data : undefined,
    isLoading: allowed && query.isPending,
    error: allowed ? query.error : null,
    retry: () => {
      if (allowed && active) void query.refetch({ cancelRefetch: false });
    },
  };
}
