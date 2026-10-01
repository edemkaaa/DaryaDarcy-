import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
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

const accessKey = env.S3_ACCESS_KEY;
const secretKey = env.S3_SECRET_KEY;
const bucket = env.S3_BUCKET;
const host = new URL(env.S3_ENDPOINT).host;
const region = "ru-1";
const service = "s3";

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function listPage(token) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex("");
  const query = new URLSearchParams({ "list-type": "2", "max-keys": "1000" });
  if (token) query.set("continuation-token", token);
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "GET",
    `/${bucket}`,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), service),
    "aws4_request",
  );
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = `https://${host}/${bucket}?${canonicalQuery}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  });
  const xml = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${xml.slice(0, 400)}`);
  }
  const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
  const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  return { keys, next: truncated ? next : undefined };
}

const prefixes = new Map();
let total = 0;
let token;
do {
  const page = await listPage(token);
  total += page.keys.length;
  for (const key of page.keys) {
    const prefix = key.split("/")[0] || "(root)";
    prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
  }
  token = page.next;
} while (token);

console.log(`BUCKET_OK ${bucket}`);
console.log(`OBJECTS ${total}`);
[...prefixes.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`${v}\t${k}`));
