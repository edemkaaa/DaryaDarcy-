"use client";
/** Иллюстрации эстетики подготавливаются из проверенных привязок; недоступная закрытая выдача не подменяется публичными файлами. */
import { useQueries } from "@tanstack/react-query";
import type { AestheticGuideKey } from "@shared/aesthetic-guide";
import { useAuth } from "@/domain/session/session-context";
import { useClub } from "@/domain/subscription/subscription-context";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import {
  aestheticMaterialKey,
  resolveAestheticImages,
} from "@/domain/library/aesthetic-visuals";
import { getLibraryFiles } from "./library-files-api";

type Group = readonly { uri: string }[];
export type AestheticVisualRequest = {
  key: AestheticGuideKey;
  moodboards: Group;
  outfits: Group;
  interiors: Group;
};

/** Параллельно читаем привязки нужных эстетик и сопоставляем их с порядком иллюстраций; старые результаты не переживают перепроверку доступа. Байты иллюстраций остаются no-store. */
export function useAestheticVisuals(
  entries: readonly AestheticVisualRequest[],
) {
  const { user, isAuthenticated } = useAuth();
  const { hasClubAccess } = useClub();
  const active = useScreenActive();
  const allowed = Boolean(user && isAuthenticated && hasClubAccess && active);
  const queries = useQueries({
    queries: entries.map((entry) => ({
      queryKey: ["private-aesthetic-visuals", user?.id, entry.key],
      enabled: allowed,
      gcTime: 0,
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const files = await getLibraryFiles(
          aestheticMaterialKey(entry.key),
          signal,
        );
        signal.throwIfAborted();
        return {
          moodboards: resolveAestheticImages(
            entry.key,
            files,
            entry.moodboards,
          ),
          outfits: resolveAestheticImages(entry.key, files, entry.outfits),
          interiors: resolveAestheticImages(entry.key, files, entry.interiors),
        };
      },
    })),
  });
  return queries.map((query) => ({
    data:
      allowed && query.isSuccess && !query.isFetching ? query.data : undefined,
    isPending: allowed && (query.isPending || query.isFetching),
    error: allowed ? query.error : null,
    retry: () => {
      if (allowed) void query.refetch();
    },
  }));
}
