"use client";
import { useQuery } from "@tanstack/react-query";
import type { LaunchCapabilities } from "@shared/capabilities";
import { apiCall } from "./auth";
import { ApiError, invalidResponse } from "./errors";

export const uploadUnavailableMessage =
  "Загрузка файлов сейчас недоступна. Попробуйте позже.";
type PrivateUploadCapability =
  | "privateContentUploads"
  | "privatePostMediaUploads"
  | "privatePostVideoUploads";

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
  const response = await apiCall<unknown>("/api/capabilities", { signal });
  if (!response || typeof response !== "object" || Array.isArray(response))
    throw invalidResponse();
  const capabilities = response as Record<string, unknown>;
  // Only an explicit boolean can select the unkeyed text-comment contract.
  // Omitted optional release switches stay disabled; malformed values are errors.
  if (
    typeof capabilities.privateContentUploads !== "boolean" ||
    Object.keys(unavailable).some(
      (key) => key in capabilities && typeof capabilities[key] !== "boolean",
    )
  )
    throw invalidResponse();
  return {
    smsLogin: capabilities.smsLogin === true,
    penPals: capabilities.penPals === true,
    shopOnlinePayment: capabilities.shopOnlinePayment === true,
    webPush: capabilities.webPush === true,
    privateContentUploads: capabilities.privateContentUploads,
    privatePostMediaUploads: capabilities.privatePostMediaUploads === true,
    privatePostVideoUploads: capabilities.privatePostVideoUploads === true,
  };
}

export function useCapabilities(): LaunchCapabilities {
  const { data, isError } = useQuery({
    queryKey: ["app-capabilities"],
    queryFn: ({ signal }) => getAppCapabilities(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });
  return isError ? unavailable : (data ?? unavailable);
}

/** Recheck release policy at the write boundary, not a cached UI hint. */
export async function requirePrivateUpload(
  name: PrivateUploadCapability,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const capabilities = await getAppCapabilities(signal);
  signal?.throwIfAborted();
  // Editors generate private photo posters for file videos as well.
  if (
    !capabilities[name] ||
    (name === "privatePostVideoUploads" && !capabilities.privateContentUploads)
  )
    throw new ApiError(uploadUnavailableMessage, 503);
}
