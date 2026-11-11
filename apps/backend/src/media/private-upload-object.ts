/** Закрытая загрузка проверяет namespace, целостность и ранее созданный объект перед повтором записи. */
import { createHash } from "node:crypto";
import {
  S3Client,
  GetBucketPolicyCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { ENV } from "../_core/env";

/** Вычисляем SHA-256 строк или байтов для неизменяемых идентификаторов намерения и пространства хранилища. */
export const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
/** Привязка к конфигурации хранилища не даёт повтору операции сменить назначение. */
export function privateStorageNamespace() {
  const url = new URL(ENV.s3Endpoint);
  const loopback =
    !ENV.isProduction &&
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    (!loopback && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(ENV.s3Bucket)
  )
    throw new Error("Private storage unavailable");
  const endpoint = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  const bucket = ENV.s3Bucket;
  return { endpoint, bucket, hash: digest(JSON.stringify([endpoint, bucket])) };
}
/** Ключ закрытого объекта выводится из проверенной квитанции, а не из произвольного имени клиента. */
export function privateAttachmentObjectKey(
  type: "audio" | "document" | "video",
  assetId: string,
  scope?: "content",
) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      assetId,
    )
  )
    throw new Error("Invalid asset identity");
  return scope === "content" || type === "video"
    ? `content/private-v1/${assetId}`
    : `feed/${type === "audio" ? "audio" : "documents"}/private-v1/${assetId}`;
}
const ruleSchema = z
  .object({
    Sid: z.enum([
      "DaryadarcyPrivateAttachmentsV1",
      "DaryadarcyPrivateContentV1",
    ]),
    Effect: z.literal("Deny"),
    Principal: z.literal("*"),
    Action: z.array(z.string()),
    Resource: z.array(z.string()),
    Condition: z
      .object({
        StringNotEqualsIfExists: z
          .object({
            "aws:username": z.array(z.string().min(1).max(128)).length(1),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type PrivateUploadObject = {
  scope?: "content";
  assetId: string;
  type: "audio" | "document" | "video";
  payloadHash: string;
  mimeType: string;
  fileSize: number;
  namespaceHash: string;
};

/** Проверяем необходимые правила хранилища до использования закрытой загрузки. */
export function verifyPrivateUploadPolicy(
  policy: unknown,
  bucket: string,
  contentScope: boolean,
) {
  const statements = z
    .object({ Statement: z.array(z.unknown()) })
    .passthrough()
    .parse(policy).Statement;
  const sid = contentScope
    ? "DaryadarcyPrivateContentV1"
    : "DaryadarcyPrivateAttachmentsV1";
  const rule = statements.find(
    (row) =>
      row !== null &&
      typeof row === "object" &&
      "Sid" in row &&
      row.Sid === sid,
  );
  const accepted = ruleSchema.parse(rule);
  const username =
    accepted.Condition.StringNotEqualsIfExists["aws:username"][0];
  const resources = contentScope
    ? [`arn:aws:s3:::${bucket}/content/private-v1/*`]
    : ["audio", "documents"].map(
        (folder) => `arn:aws:s3:::${bucket}/feed/${folder}/private-v1/*`,
      );
  if (
    ["anonymous", "*"].includes(username.toLowerCase()) ||
    JSON.stringify([...accepted.Action].sort()) !==
      JSON.stringify(["s3:GetObject", "s3:GetObjectVersion"].sort()) ||
    JSON.stringify([...accepted.Resource].sort()) !==
      JSON.stringify(resources.sort())
  )
    throw new Error("Private policy unavailable");
}

/** Only new owned keys. Never overwrite, delete, grant public ACL or fall back. */
/** Проверяем защитную bucket policy, затем принимаем совпадающий объект либо создаём новый условным private PUT; потерю ACK восстанавливаем HEAD, а конфликтующий объект никогда не перезаписываем. */
export async function ensurePrivateUploadObject(
  receipt: PrivateUploadObject,
  bytes: Buffer,
  callerSignal?: AbortSignal,
) {
  // Обрыв HTTP прерывает ожидание S3. Уже принятый объект проверит повтор по тому же ключу.
  const timeout = AbortSignal.timeout(30000);
  const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
  signal.throwIfAborted();
  const namespace = privateStorageNamespace();
  const contentScope = receipt.scope === "content" || receipt.type === "video";
  if (
    namespace.hash !== receipt.namespaceHash ||
    !ENV.s3AccessKey ||
    !ENV.s3SecretKey ||
    bytes.length !== receipt.fileSize
  )
    throw new Error("Private storage mismatch");
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
  const object = {
    Bucket: namespace.bucket,
    Key: privateAttachmentObjectKey(
      receipt.type,
      receipt.assetId,
      receipt.scope,
    ),
  };
  try {
    // Private ACL alone does not defeat this bucket's broad public read policy.
    const result = await client.send(
      new GetBucketPolicyCommand({ Bucket: namespace.bucket }),
      { abortSignal: signal },
    );
    verifyPrivateUploadPolicy(
      JSON.parse(result.Policy ?? "null"),
      namespace.bucket,
      contentScope,
    );
    /** Читаем метаданные точного ключа закреплённого assetId под общим сигналом отмены. */
    const head = () =>
      client.send(new HeadObjectCommand(object), { abortSignal: signal });
    let meta;
    try {
      meta = await head();
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw error;
    }
    if (!meta) {
      try { await client.send(
        new PutObjectCommand({
          ...object,
          Body: bytes,
          ContentLength: bytes.length,
          ContentType: receipt.mimeType,
          ContentMD5: createHash("md5").update(bytes).digest("base64"),
          ACL: "private",
          IfNoneMatch: "*",
          CacheControl: "no-store",
          Metadata: {
            "asset-id": receipt.assetId,
            "intent-hash": receipt.payloadHash,
          },
        }),
        { abortSignal: signal },
      ); } catch (error) {
        // Another retry may have won the same conditional write. Accept only
        // matching durable evidence from HEAD below; never overwrite an object.
        if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
      }
      meta = await head();
    }
    // A lost PUT ACK is reconciled from the same object on a later retry.
    if (
      meta.ContentLength !== bytes.length ||
      meta.ContentType !== receipt.mimeType ||
      meta.Metadata?.["asset-id"] !== receipt.assetId ||
      meta.Metadata?.["intent-hash"] !== receipt.payloadHash ||
      !meta.ETag ||
      meta.ETag.length > 128
    )
      throw new Error("Invalid private object evidence");
    return meta.ETag;
  } finally {
    client.destroy();
  }
}
