import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = process.argv[2] || path.join(root, ".env");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

let token;
let total = 0;
let count = 0;
const prefixes = {};

do {
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET,
      ContinuationToken: token,
      MaxKeys: 1000,
    }),
  );
  for (const obj of res.Contents ?? []) {
    total += obj.Size ?? 0;
    count += 1;
    const prefix = obj.Key?.split("/")[0] ?? "root";
    prefixes[prefix] = (prefixes[prefix] ?? 0) + (obj.Size ?? 0);
  }
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);

const gb = total / 1024 / 1024 / 1024;
console.log(
  JSON.stringify(
    {
      bucket: env.S3_BUCKET,
      objects: count,
      total_bytes: total,
      total_gb: +gb.toFixed(2),
      prefixes_mb: Object.fromEntries(
        Object.entries(prefixes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k, v]) => [k, +(v / 1024 / 1024).toFixed(1)]),
      ),
    },
    null,
    2,
  ),
);
