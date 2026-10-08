import { queryOptions } from "@tanstack/react-query";
import { apiCall } from "@/shared/api/auth";

export const PUBLIC_LAUNCH_KEY = ["launch-config"];

/** Keep the full response: each consumer validates only its own settings. */
export function publicConfigurationOptions() {
  return queryOptions({
    queryKey: PUBLIC_LAUNCH_KEY,
    queryFn: ({ signal }) => apiCall<unknown>("/api/launch-config", { signal }),
    staleTime: 0,
    retry: false,
  });
}
