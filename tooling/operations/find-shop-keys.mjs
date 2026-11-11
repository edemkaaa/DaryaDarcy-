// Ищет конкретные прежние ключи иллюстраций Магазина в списке S3. Ничего не загружает, но обращается к рабочему хранилищу с выданным доступом.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const needles = ["veXysoFDZMKZaCDB", "kIvlvGffqWCvSlth", "vjdQHvFhVxKjVyWq", "eWHYEgFyQkkTVIac", "koLmphlWqhNfBNNV"];
const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

let token;
let scanned = 0;
const hits = [];
do {
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET,
      Prefix: "app-assets/",
      ContinuationToken: token,
      MaxKeys: 1000,
    }),
  );
  for (const obj of res.Contents || []) {
    scanned += 1;
    const key = obj.Key || "";
    if (needles.some((n) => key.includes(n))) hits.push(key);
  }
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);
console.log("scanned", scanned, "hits", hits);
