import { createHash } from "node:crypto";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ENV } from "../_core/env";
import { privateStorageNamespace } from "./private-upload-object";
import type { publicPhotoUploads } from "../../../../packages/database/src/schema";

type Receipt = typeof publicPhotoUploads.$inferSelect;
function objectKey(row: Receipt) {
  if (!row.actorUserId || !/^[a-f0-9-]{36}$/.test(row.assetId))
    throw new Error("Invalid public receipt");
  const folder =
    row.purpose === "avatar" ? `avatars/${row.actorUserId}` : "covers";
  return `${folder}/public-v1/${row.assetId}.webp`;
}

/** Immutable new keys only; HEAD proves a prior PUT before retry. Never DELETE. */
export async function ensurePublicPhotoObject(
  row: Receipt,
  bytes: Buffer,
  callerSignal?: AbortSignal,
) {
  const namespace = privateStorageNamespace();
  if (
    row.namespaceHash !== namespace.hash ||
    !ENV.s3AccessKey ||
    !ENV.s3SecretKey
  )
    throw new Error("Public storage mismatch");
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
      connectionTimeout: 3000,
      requestTimeout: 10000,
      throwOnRequestTimeout: true,
    },
  });
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, AbortSignal.timeout(10000)])
    : AbortSignal.timeout(10000);
  const object = { Bucket: namespace.bucket, Key: objectKey(row) };
  async function exists() {
    try {
      const head = await client.send(new HeadObjectCommand(object), {
        abortSignal: signal,
      });
      if (
        head.ContentLength !== row.fileSize ||
        head.ContentType !== "image/webp" ||
        head.Metadata?.sha256 !== row.outputHash ||
        head.Metadata?.receipt !== row.requestId
      )
        throw new Error("Public object integrity mismatch");
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
            ContentMD5: createHash("md5").update(bytes).digest("base64"),
            ACL: "public-read",
            IfNoneMatch: "*",
            CacheControl: "public, max-age=31536000, immutable",
            Metadata: { sha256: row.outputHash, receipt: row.requestId },
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
    return `${namespace.endpoint}/${encodeURIComponent(namespace.bucket)}/${object.Key.split("/").map(encodeURIComponent).join("/")}`;
  } finally {
    client.destroy();
  }
}
