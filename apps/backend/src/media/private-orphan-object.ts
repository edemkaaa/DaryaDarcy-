/** Удаление бесхозного закрытого объекта выполняется только по проверенному служебному пути. */
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetBucketVersioningCommand,
} from "@aws-sdk/client-s3";
import { ENV } from "../_core/env";
import {
  privateAttachmentObjectKey,
  privateStorageNamespace,
  type PrivateUploadObject,
} from "./private-upload-object";

/** Exact ledger-owned private-v1 key only. Success requires a final HEAD404. */
export async function deletePrivateOrphanObject(
  receipt: PrivateUploadObject & { etag: string | null },
) {
  const namespace = privateStorageNamespace();
  if (
    namespace.hash !== receipt.namespaceHash ||
    !ENV.s3AccessKey ||
    !ENV.s3SecretKey
  )
    throw new Error("Private storage mismatch");
  // This slice is intentionally unusable against a working S3 endpoint.
  const endpoint = new URL(namespace.endpoint);
  if (
    ENV.isProduction ||
    endpoint.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
  )
    throw new Error("Only local orphan cleanup is enabled");
  const client = new S3Client({
    endpoint: namespace.endpoint,
    region: "ru-1",
    forcePathStyle: true,
    maxAttempts: 1,
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
    requestHandler: {
      connectionTimeout: 5000,
      requestTimeout: 10000,
      throwOnRequestTimeout: true,
    },
  });
  const signal = AbortSignal.timeout(30000);
  const object = {
    Bucket: namespace.bucket,
    Key: privateAttachmentObjectKey(receipt.type, receipt.assetId),
  };
  const head = async () => {
    try {
      return await client.send(new HeadObjectCommand(object), {
        abortSignal: signal,
      });
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return null;
      throw error;
    }
  };
  try {
    const versioning = await client.send(
      new GetBucketVersioningCommand({ Bucket: namespace.bucket }),
      { abortSignal: signal },
    );
    if (versioning.Status)
      throw new Error("Versioned storage cleanup is not enabled");
    const meta = await head();
    if (!meta) return;
    if (
      meta.ContentLength !== receipt.fileSize ||
      meta.ContentType !== receipt.mimeType ||
      meta.Metadata?.["asset-id"] !== receipt.assetId ||
      meta.Metadata?.["intent-hash"] !== receipt.payloadHash ||
      !meta.ETag ||
      meta.ETag.length > 128 ||
      (receipt.etag && meta.ETag !== receipt.etag) ||
      meta.VersionId ||
      meta.DeleteMarker
    )
      throw new Error("Private object ownership mismatch");
    await client.send(
      new DeleteObjectCommand({ ...object, IfMatch: meta.ETag }),
      { abortSignal: signal },
    );
    if (await head()) throw new Error("Private deletion unconfirmed");
  } finally {
    client.destroy();
  }
}
