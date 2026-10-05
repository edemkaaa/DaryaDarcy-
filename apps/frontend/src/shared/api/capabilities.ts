"use client";
import { useQuery } from "@tanstack/react-query";
import type { LaunchCapabilities } from "@shared/capabilities";
import { apiCall } from "./auth";

const unavailable: LaunchCapabilities = {
  smsLogin: false,
  penPals: false,
  shopOnlinePayment: false,
  webPush: false,
};

export async function getAppCapabilities(): Promise<LaunchCapabilities> {
  const response =
    await apiCall<Partial<LaunchCapabilities>>("/api/capabilities");
  return {
    smsLogin: response.smsLogin === true,
    penPals: response.penPals === true,
    shopOnlinePayment: response.shopOnlinePayment === true,
    webPush: response.webPush === true,
  };
}

export function useCapabilities(): LaunchCapabilities {
  const { data } = useQuery({
    queryKey: ["app-capabilities"],
    queryFn: getAppCapabilities,
    staleTime: 60_000,
    retry: false,
  });
  return data ?? unavailable;
}
