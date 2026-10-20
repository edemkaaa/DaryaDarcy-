"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/domain/session/session-context";
import { useClub } from "@/domain/subscription/subscription-context";
import {
  getLibraryFiles,
  isPrivateLibraryEnabled,
  type LibraryMaterialKey,
} from "./library-files-api";

export function useLibraryFiles(material: LibraryMaterialKey, active = true) {
  const { user, isAuthenticated } = useAuth();
  const { hasClubAccess } = useClub();
  const allowed =
    isPrivateLibraryEnabled() && isAuthenticated && hasClubAccess && active;
  const query = useQuery({
    queryKey: ["private-library-files", user?.id, material],
    queryFn: ({ signal }) => getLibraryFiles(material, signal),
    enabled: allowed,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  // Hide old links while rechecking access, including after an account change.
  return {
    data:
      allowed && query.isSuccess && !query.isFetching ? query.data : undefined,
    isPending: allowed && (query.isPending || query.isFetching),
    isError: allowed && query.isError,
    retry: () => {
      if (allowed) void query.refetch();
    },
  };
}
