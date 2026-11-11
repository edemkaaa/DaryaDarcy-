// Архив Expo. Получает Blob web-источника либо целиком декодирует native Base64; не является потоковой загрузкой.
import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;

async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  // Получает Blob web-источника либо целиком декодирует native Base64; не является потоковой загрузкой.

  if (Platform.OS === "web" || /^(blob:|data:|https?:)/i.test(uri)) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("Не удалось прочитать видеофайл");
    return response.blob();
  }

  const FileSystem = await import("expo-file-system/legacy");
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error("Видеофайл не найден на устройстве");

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "video/mp4" });
}

export async function uploadAdminVideoBlob(blob: Blob, filename: string): Promise<string> {
  // Проверяет 80 МиБ и отправляет raw body старому upload-video с таймаутом; ключа идемпотентности здесь нет.

  if (blob.size > MAX_VIDEO_BYTES) {
    throw new Error("Видео больше 80 МБ. Сожмите ролик или загрузите более короткий файл.");
  }

  const token = await Auth.getSessionToken();
  const base = getApiBaseUrl().replace(/\/$/, "");
  const qs = `filename=${encodeURIComponent(filename || "video.mp4")}`;
  const headers: Record<string, string> = {
    "Content-Type": blob.type || "video/mp4",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
    : null;

  let response: Response;
  try {
    response = await fetch(`${base}/api/admin/upload-video?${qs}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: blob,
      signal: controller?.signal,
    });
  } catch (err) {
    if (controller?.signal.aborted) {
      throw new Error("Загрузка видео заняла слишком много времени. Попробуйте снова или сожмите файл.");
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `Не удалось загрузить видео (${response.status})`;
    try {
      const json = await response.json();
      if (json?.error) message = json.error;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error("Сервер не вернул ссылку на видео");
  return data.url;
}

export async function uploadAdminVideoFromUri(
  uri: string,
  filename: string,
  mimeType?: string,
): Promise<string> {
  // Читает URI, уточняет MIME при необходимости и передаёт Blob общему uploader.

  const blob = await uriToBlob(uri, mimeType);
  const typed = mimeType && (!blob.type || blob.type === "application/octet-stream")
    ? new Blob([blob], { type: mimeType })
    : blob;
  return uploadAdminVideoBlob(typed, filename);
}
