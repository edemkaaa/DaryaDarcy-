import { invalidResponse } from "@/shared/api/errors";
export function requireUploadedUrl(result: unknown): string {
  const url =
    result && typeof result === "object"
      ? (result as { url?: unknown }).url
      : undefined;
  if (typeof url !== "string") throw invalidResponse();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw invalidResponse();
  }
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw invalidResponse();
  return url;
}
