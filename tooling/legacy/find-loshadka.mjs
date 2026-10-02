import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const keys = [];
let token;
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
    if (/WDRmWxjeWyXWNrto|loshad|horse|4542/i.test(obj.Key || "")) keys.push(obj.Key);
  }
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);
console.log("s3 matches", keys);

const pngKey = "app-assets/manus/f8a919017d4c-WDRmWxjeWyXWNrto.PNG";
const obj = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: pngKey }));
const buf = Buffer.from(await obj.Body.transformToByteArray());
const out = path.join(root, "tooling", "legacy", "loshadka-current.png");
fs.writeFileSync(out, buf);
console.log("saved", out, buf.length, buf.slice(0, 8).toString("hex"));

