import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { getHttpStatus, shouldRetryQuery } from "./errors";
import { requestSessionCheck } from "./session-events";

/** Content stays cached across window/network events. Access checks opt in separately. */
export function createAppQueryClient() {
  const checkAccess = (error: unknown) => {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) requestSessionCheck(status);
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: checkAccess }),
    mutationCache: new MutationCache({ onError: checkAccess }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: shouldRetryQuery,
      },
      mutations: { retry: false },
    },
  });
}
