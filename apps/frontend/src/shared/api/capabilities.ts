"use client";
import { useQuery } from "@tanstack/react-query";
import type { LaunchCapabilities } from "@shared/capabilities";
import { apiCall } from "./auth";

const unavailable: LaunchCapabilities = {
  smsLogin: false,
  penPals: false,
  shopOnlinePayment: false,
  webPush: false,
  privateContentUploads: false,
  privatePostMediaUploads: false,
  privatePostVideoUploads: false,
};

export async function getAppCapabilities(
  signal?: AbortSignal,
): Promise<LaunchCapabilities> {
  const response = await apiCall<Partial<LaunchCapabilities> | null>(
    "/api/capabilities",
    { signal },
  );
  if (!response || typeof response !== "object" || Array.isArray(response))
    return unavailable;
  return {
    smsLogin: response.smsLogin === true,
    penPals: response.penPals === true,
    shopOnlinePayment: response.shopOnlinePayment === true,
    webPush: response.webPush === true,
    privateContentUploads: response.privateContentUploads === true,
    privatePostMediaUploads: response.privatePostMediaUploads === true,
    privatePostVideoUploads: response.privatePostVideoUploads === true,
  };
}

export function useCapabilities(): LaunchCapabilities {
  const { data, isError } = useQuery({
    queryKey: ["app-capabilities"],
    queryFn: ({ signal }) => getAppCapabilities(signal),
    staleTime: 60_000,
    retry: false,
  });
  return isError ? unavailable : (data ?? unavailable);
}
