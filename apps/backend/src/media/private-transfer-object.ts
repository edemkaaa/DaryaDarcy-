/** Перенос большого объекта идёт потоком с проверкой результата и без перекодирования. */
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  GetBucketPolicyCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { ENV } from "../_core/env";
import { detectBinaryFileType } from "./file-signature";
import {
  privateStorageNamespace,
  privateAttachmentObjectKey,
  verifyPrivateUploadPolicy,
  type PrivateUploadObject,
} from "./private-upload-object";

type Source = { key: string; etag: string; sha256: string | null };

/** Own legacy video -> conditional streaming PUT. No transcode, disk file or whole-video buffer. */
export async function ensurePrivateTransferredObject(
  receipt: PrivateUploadObject,
  source: Source,
) {
  const namespace = privateStorageNamespace();
  if (
    receipt.type !== "video" ||
    namespace.hash !== receipt.namespaceHash ||
    !ENV.s3AccessKey ||
    !ENV.s3SecretKey ||
    !Number.isSafeInteger(receipt.fileSize) ||
    receipt.fileSize <= 0 ||
    receipt.fileSize > 1024 * 1024 * 1024 ||
    !/^(?:feed\/(videos|reels)|club\/tg)\//.test(source.key) ||
    /[\\\x00-\x1f\x7f]/.test(source.key) ||
    Buffer.byteLength(source.key) > 1024 ||
    source.key.includes("private-v1") ||
    source.key
      .split("/")
      .some((part) => !part || part === "." || part === "..") ||
    !/^"[a-zA-Z0-9-]+"$/.test(source.etag) ||
    (source.sha256 !== null && !/^[a-f0-9]{64}$/.test(source.sha256))
  )
    throw new Error("Invalid private transfer intent");
  const client = new S3Client({
    endpoint: namespace.endpoint,
    region: "ru-1",
    forcePathStyle: true,
    maxAttempts: 1,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
    requestHandler: {
      connectionTimeout: 5000,
      requestTimeout: 300_000,
      socketTimeout: 30_000,
      throwOnRequestTimeout: true,
    },
  });
  const controller = new AbortController();
  const signal = AbortSignal.any([
    AbortSignal.timeout(300_000),
    controller.signal,
  ]);
  const object = {
    Bucket: namespace.bucket,
    Key: privateAttachmentObjectKey("video", receipt.assetId),
  };
  const origin = { Bucket: namespace.bucket, Key: source.key };
  async function openSource(key: typeof origin, etag: string) {
    const response = await client.send(
      new GetObjectCommand({ ...key, IfMatch: etag }),
      { abortSignal: signal },
    );
    if (
      response.ContentLength !== receipt.fileSize ||
      response.ETag !== etag ||
      !(response.Body instanceof Readable)
    ) {
      if (response.Body instanceof Readable) response.Body.destroy();
      throw new Error("Invalid transfer stream");
    }
    return response.Body;
  }
  async function checksum(key: typeof origin, etag: string) {
    const body = await openSource(key, etag);
    const hash = createHash("sha256"),
      md5 = createHash("md5");
    let size = 0,
      prefix = Buffer.alloc(0);
    const idle = setTimeout(
      () => body.destroy(new Error("Transfer stream stalled")),
      30_000,
    );
    idle.unref();
    try {
      for await (const chunk of body) {
        if (!Buffer.isBuffer(chunk)) throw new Error("Invalid transfer bytes");
        size += chunk.length;
        if (size > receipt.fileSize)
          throw new Error("Transfer stream exceeded source size");
        hash.update(chunk);
        md5.update(chunk);
        idle.refresh();
        if (prefix.length < 65536)
          prefix = Buffer.concat([
            prefix,
            chunk.subarray(0, 65536 - prefix.length),
          ]);
      }
      if (size !== receipt.fileSize)
        throw new Error("Truncated transfer stream");
      const detected = await detectBinaryFileType(prefix);
      if (
        detected?.mime !== receipt.mimeType ||
        !["video/mp4", "video/webm", "video/quicktime"].includes(
          receipt.mimeType,
        )
      )
        throw new Error("Transfer signature mismatch");
      return { sha256: hash.digest("hex"), md5: md5.digest("base64") };
    } finally {
      clearTimeout(idle);
      body.destroy();
    }
  }
  try {
    const policy = await client.send(
      new GetBucketPolicyCommand({ Bucket: namespace.bucket }),
      { abortSignal: signal },
    );
    verifyPrivateUploadPolicy(
      JSON.parse(policy.Policy ?? "null"),
      namespace.bucket,
      true,
    );
    const original = await client.send(
      new HeadObjectCommand({ ...origin, IfMatch: source.etag }),
      { abortSignal: signal },
    );
    if (
      original.ContentLength !== receipt.fileSize ||
      original.ETag !== source.etag
    )
      throw new Error("Transfer source changed");
    let destination;
    try {
      destination = await client.send(new HeadObjectCommand(object), {
        abortSignal: signal,
      });
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw error;
    }
    if (!destination) {
      const { sha256, md5 } = await checksum(origin, source.etag);
      if (source.sha256 !== null && sha256 !== source.sha256)
        throw new Error("Transfer source checksum mismatch");
      const body = await openSource(origin, source.etag);
      const hash = createHash("sha256");
      let size = 0;
      const checked = new Transform({
        highWaterMark: 64 * 1024,
        transform(chunk: Buffer, _encoding, done) {
          if (
            !Buffer.isBuffer(chunk) ||
            (size += chunk.length) > receipt.fileSize
          ) {
            done(new Error("Invalid transfer bytes"));
            return;
          }
          hash.update(chunk);
          done(null, chunk);
        },
        flush(done) {
          done(
            size === receipt.fileSize && hash.digest("hex") === sha256
              ? undefined
              : new Error("Transfer source checksum changed"),
          );
        },
      });
      try {
        await Promise.all([
          pipeline(body, checked, { signal }),
          client.send(
            new PutObjectCommand({
              ...object,
              Body: checked,
              ContentLength: receipt.fileSize,
              ContentMD5: md5,
              IfNoneMatch: "*",
              ACL: "private",
              ContentType: receipt.mimeType,
              CacheControl: "no-store",
              Metadata: {
                "asset-id": receipt.assetId,
                "intent-hash": receipt.payloadHash,
                "source-etag": source.etag,
                "source-sha256": sha256,
              },
            }),
            { abortSignal: signal },
          ),
        ]);
      } catch (error) {
        controller.abort();
        body.destroy();
        checked.destroy();
        throw error;
      }
      destination = await client.send(new HeadObjectCommand(object), {
        abortSignal: signal,
      });
    }
    const sha256 = destination.Metadata?.["source-sha256"];
    if (
      destination.ContentLength !== receipt.fileSize ||
      destination.ContentType !== receipt.mimeType ||
      destination.Metadata?.["asset-id"] !== receipt.assetId ||
      destination.Metadata?.["intent-hash"] !== receipt.payloadHash ||
      destination.Metadata?.["source-etag"] !== source.etag ||
      !sha256 ||
      !/^[a-f0-9]{64}$/.test(sha256) ||
      (source.sha256 !== null && sha256 !== source.sha256) ||
      !destination.ETag ||
      destination.ETag.length > 128
    )
      throw new Error("Invalid transfer evidence");
    if ((await checksum(object, destination.ETag)).sha256 !== sha256)
      throw new Error("Transfer destination checksum mismatch");
    return { etag: destination.ETag, sha256 };
  } finally {
    client.destroy();
  }
}
