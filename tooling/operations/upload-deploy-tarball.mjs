import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

async function upload(rel, contentType) {
  const file = path.join(root, rel);
  const key = `deploy/${path.basename(rel)}`;
  const body = fs.readFileSync(file);
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  console.log(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`);
  console.log("bytes", body.length);
}

await upload("infrastructure/deploy/daryadarcy-src.tgz", "application/gzip");
await upload("infrastructure/deploy/vps-fresh.sh", "text/x-shellscript");
await upload("infrastructure/deploy/start-api.sh", "text/x-shellscript");
await upload("infrastructure/deploy/ecosystem.config.cjs", "application/javascript");
await upload("tooling/legacy/diag-tidb.mjs", "text/javascript");
await upload("infrastructure/deploy/nginx-daryadarcy.conf", "text/plain");
