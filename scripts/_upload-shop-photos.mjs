import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HeadObjectCommand, PutObjectCommand, PutObjectAclCommand, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const dir = path.join(root, ".tmp-shop-photos");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => !name.startsWith(".")) : [];
const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});
const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

let ok = 0;
let skip = 0;
let fail = 0;
for (const name of files) {
  const key = `app-assets/shop/${name}`;
  try {
    await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    skip += 1;
    console.log("skip", name);
    continue;
  } catch {}
  try {
    const Body = fs.readFileSync(path.join(dir, name));
    const ext = (name.split(".").pop() || "").toLowerCase();
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body,
        ContentType: mime[ext] || "application/octet-stream",
        ACL: "public-read",
      }),
    );
    try {
      await client.send(new PutObjectAclCommand({ Bucket: env.S3_BUCKET, Key: key, ACL: "public-read" }));
    } catch {}
    ok += 1;
    console.log("ok", name, Body.length);
  } catch (err) {
    fail += 1;
    console.log("fail", name, String(err).slice(0, 80));
  }
}
console.log("uploaded", ok, "skip", skip, "fail", fail);
