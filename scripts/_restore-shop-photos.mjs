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

const src = fs.readFileSync(
  path.join(root, "apps/frontend/app/(tabs)/shop/[id].tsx"),
  "utf8",
);
const keys = [...new Set([...src.matchAll(/https:\/\/s3\.twcstorage\.ru\/daryadarcy-s3\/(app-assets\/shop\/[^"']+)/g)].map((m) => m[1]))];

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const base = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663475213159/";
const mime = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

async function exists(key) {
  try {
    await Promise.race([
      client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key })),
      new Promise((_, reject) => setTimeout(() => reject(new Error("head timeout")), 12000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function fetchRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15000);
      const res = await fetch(url, { signal: ac.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`http ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      console.log("retry", attempt, String(err).slice(0, 80));
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastErr;
}

let ok = 0;
let skip = 0;
let fail = 0;
for (const key of keys) {
  const name = key.split("/").pop();
  if (await exists(key)) {
    skip += 1;
    console.log("skip", name);
    continue;
  }
  console.log("get", name);
  try {
    const buf = await fetchRetry(base + name);
    const ext = (name.split(".").pop() || "").toLowerCase();
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buf,
        ContentType: mime[ext] || "application/octet-stream",
        ACL: "public-read",
      }),
    );
    try {
      await client.send(new PutObjectAclCommand({ Bucket: env.S3_BUCKET, Key: key, ACL: "public-read" }));
    } catch {}
    ok += 1;
    console.log("ok", name, buf.length);
  } catch (err) {
    fail += 1;
    console.log("fail", name, String(err).slice(0, 80));
  }
}
console.log("done uploaded", ok, "skip", skip, "fail", fail);
