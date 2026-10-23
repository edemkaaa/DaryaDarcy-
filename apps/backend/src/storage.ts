// Storage module with Timeweb S3 support + fallback to Manus built-in storage
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";

// --- Timeweb S3 Storage ---

function storageKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "");
  if (!key || /[\\\x00-\x1f\x7f]/.test(key) ||
      key.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

/** Encode the exact object key, not URL syntax or an already-decoded alias. */
function s3ObjectUrl(key: string): string {
  const encode = (part: string) =>
    encodeURIComponent(part).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  const encodedKey = key.split("/").map(encode).join("/");
  return `${ENV.s3Endpoint.replace(/\/+$/, "")}/${encode(ENV.s3Bucket)}/${encodedKey}`;
}

function getS3Client(): S3Client | null {
  if (!ENV.s3Endpoint || !ENV.s3AccessKey || !ENV.s3SecretKey || !ENV.s3Bucket) {
    return null;
  }
  return new S3Client({
    endpoint: ENV.s3Endpoint,
    region: "ru-1",
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
    forcePathStyle: true,
    maxAttempts: 1,
    requestHandler: {
      connectionTimeout: 3000,
      requestTimeout: 10000,
      throwOnRequestTimeout: true,
    },
  });
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  signal?: AbortSignal,
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  if (!client) throw new Error("S3 not configured");

  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : data;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: "public-read",
      }),
      { abortSignal: signal },
    );

    const url = s3ObjectUrl(key);
    return { key, url };
  } finally {
    client.destroy();
  }
}

// --- Manus Built-in Storage (fallback) ---

type StorageConfig = { baseUrl: string; apiKey: string };

function getManusStorageConfig(): StorageConfig | null {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("path", relKey.replace(/^\/+/, ""));
  return url;
}

async function buildDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  downloadApiUrl.searchParams.set("path", relKey.replace(/^\/+/, ""));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Storage URL unavailable");
  return (await response.json()).url;
}

async function manusPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  signal?: AbortSignal,
): Promise<{ key: string; url: string }> {
  const config = getManusStorageConfig();
  if (!config) throw new Error("No storage configured (neither S3 nor Manus)");

  const key = relKey.replace(/^\/+/, "");
  const uploadUrl = buildUploadUrl(config.baseUrl, key);
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status}): ${message}`);
  }
  const url = (await response.json()).url;
  return { key, url };
}

// --- Public API (auto-selects S3 if configured, otherwise Manus) ---

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  options: { signal?: AbortSignal } = {},
): Promise<{ key: string; url: string }> {
  const key = storageKey(relKey);
  // A timed-out PUT may already exist remotely: never retry it automatically.
  const deadline = AbortSignal.timeout(10000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline])
    : deadline;
  signal.throwIfAborted();
  // Prefer Timeweb S3 if configured
  if (ENV.s3Endpoint && ENV.s3AccessKey && ENV.s3SecretKey && ENV.s3Bucket) {
    return s3Put(key, data, contentType, signal);
  }
  // Fallback to Manus built-in storage
  return manusPut(key, data, contentType, signal);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = storageKey(relKey);

  // If S3 is configured, return direct public URL
  if (ENV.s3Endpoint && ENV.s3Bucket) {
    return { key, url: s3ObjectUrl(key) };
  }

  // Fallback to Manus
  const config = getManusStorageConfig();
  if (!config) throw new Error("No storage configured");
  return { key, url: await buildDownloadUrl(config.baseUrl, key, config.apiKey) };
}

// --- Test helper ---
export async function testS3Connection(): Promise<{ success: boolean; message: string }> {
  try {
    if (
      !ENV.s3Endpoint ||
      !ENV.s3AccessKey ||
      !ENV.s3SecretKey ||
      !ENV.s3Bucket
    )
      return { success: false, message: "S3 not configured" };

    const testKey = "_test/connection-test.txt";
    const testData = `Connection test at ${new Date().toISOString()}`;
    const { url } = await storagePut(testKey, testData, "text/plain");
    return { success: true, message: `S3 connected. Test file: ${url}` };
  } catch (err: any) {
    return { success: false, message: err.message || "Unknown error" };
  }
}
