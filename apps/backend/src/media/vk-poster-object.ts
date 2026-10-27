import { createHash } from "node:crypto";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ENV } from "../_core/env";
import { privateStorageNamespace } from "./private-upload-object";
import { preparePhoto } from "./photos";

/** Server-owned public covers only. Content-addressed keys never replace files.
 * A retry after lost PUT acknowledgement reuses the verified object by HEAD. */
export async function saveVkPoster(
  sourceKey: string,
  input: Buffer,
  signal: AbortSignal,
) {
  if (!/^[a-f0-9]{64}$/.test(sourceKey)) throw new Error("Invalid VK source");
  signal.throwIfAborted();
  if (!ENV.s3AccessKey || !ENV.s3SecretKey)
    throw new Error("Cover storage unavailable");
  const namespace = privateStorageNamespace();
  const bytes = await preparePhoto(input.toString("base64"));
  signal.throwIfAborted();
  const hash = createHash("sha256").update(bytes).digest("hex");
  const key = `covers/vk-v1/${sourceKey}/${hash}.webp`;
  const object = { Bucket: namespace.bucket, Key: key };
  const client = new S3Client({
    endpoint: namespace.endpoint,
    region: "ru-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
    maxAttempts: 1,
    requestHandler: {
      connectionTimeout: 2000,
      requestTimeout: 5000,
      throwOnRequestTimeout: true,
    },
  });
  async function exists() {
    try {
      const head = await client.send(new HeadObjectCommand(object), {
        abortSignal: signal,
      });
      if (
        head.ContentLength !== bytes.length ||
        head.ContentType !== "image/webp" ||
        head.Metadata?.sha256 !== hash ||
        head.Metadata?.["vk-source"] !== sourceKey
      )
        throw new Error("Cover integrity mismatch");
      return true;
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return false;
      throw error;
    }
  }
  try {
    if (!(await exists())) {
      try {
        await client.send(
          new PutObjectCommand({
            ...object,
            Body: bytes,
            ContentType: "image/webp",
            ACL: "public-read",
            IfNoneMatch: "*",
            CacheControl: "public, max-age=31536000, immutable",
            ContentMD5: createHash("md5").update(bytes).digest("base64"),
            Metadata: { sha256: hash, "vk-source": sourceKey },
          }),
          { abortSignal: signal },
        );
      } catch (error) {
        if (
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode !== 412 ||
          !(await exists())
        )
          throw error;
      }
    }
    return `${namespace.endpoint}/${encodeURIComponent(namespace.bucket)}/${key}`;
  } finally {
    client.destroy();
  }
}
