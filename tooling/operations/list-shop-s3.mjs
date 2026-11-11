// Перечисляет объекты Магазина; с --acl дополнительно делает их public-read. Режим изменения доступа не следует включать для закрытого контента.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ListObjectsV2Command, PutObjectAclCommand, S3Client } from "@aws-sdk/client-s3";

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

const apply = process.argv.includes("--acl");
const keys = [];
let token;
do {
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET,
      Prefix: "app-assets/shop/",
      ContinuationToken: token,
      MaxKeys: 1000,
    }),
  );
  for (const obj of res.Contents || []) {
    if (obj.Key) keys.push({ key: obj.Key, size: obj.Size });
  }
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);

console.log("shop objects", keys.length);
for (const item of keys.slice(0, 15)) console.log(item.size, item.key);
if (keys.length > 15) console.log("...");

if (apply) {
  let ok = 0;
  for (const item of keys) {
    await client.send(
      new PutObjectAclCommand({
        Bucket: env.S3_BUCKET,
        Key: item.key,
        ACL: "public-read",
      }),
    );
    ok += 1;
  }
  console.log("acl public-read", ok);
}
