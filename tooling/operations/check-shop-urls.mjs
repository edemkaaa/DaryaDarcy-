// Сверяет прежние ссылки Магазина с S3. Флаг --acl меняет доступ найденных объектов на public-read и требует отдельного согласования.
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

// Источник — прежний Expo-экран Магазина; отсутствие этого файла означает устаревший инструмент, не пропажу товаров.
const src = fs.readFileSync(
  path.join(root, "apps/frontend/app/(tabs)/shop/[id].tsx"),
  "utf8",
);
const urls = [...src.matchAll(/https:\/\/s3\.twcstorage\.ru\/daryadarcy-s3\/([^"']+)/g)].map((m) => m[1]);
const unique = [...new Set(urls)];

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const listed = new Set();
for (const prefix of ["app-assets/shop/", "app-assets/manus/"]) {
  let token;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const obj of res.Contents || []) if (obj.Key) listed.add(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}

const missing = [];
const present = [];
for (const key of unique) {
  if (listed.has(key)) present.push(key);
  else missing.push(key);
}
console.log("referenced", unique.length, "present", present.length, "missing", missing.length);
for (const key of missing) console.log("MISSING", key);

// Только этот явный режим меняет ACL найденных картинок на public-read.
if (process.argv.includes("--acl")) {
  let ok = 0;
  for (const key of present.filter((k) => k.startsWith("app-assets/shop/"))) {
    await client.send(
      new PutObjectAclCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ACL: "public-read",
      }),
    );
    ok += 1;
  }
  console.log("acl", ok);
}
