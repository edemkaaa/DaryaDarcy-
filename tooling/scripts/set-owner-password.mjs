import fs from "node:fs";
import path from "node:path";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const scryptAsync = promisify(scrypt);
const KEYLEN = 32;
const N = 16384;
const R = 8;
const P = 1;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

async function verifyPassword(password, stored) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const derived = await scryptAsync(password, salt, expected.length, { N: n, r, p });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

const password = process.argv[2] || "";
if (password.length < 8) {
  console.error("usage: node tooling/scripts/set-owner-password.mjs <password>");
  process.exit(1);
}

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

const email = (env.OWNER_EMAIL || "daryadarcy19@gmail.com").trim().toLowerCase();
const url = env.DATABASE_URL;
const conn = await mysql.createConnection(url);
const passwordHash = await hashPassword(password);
await conn.query(
  `UPDATE users SET passwordHash = ?, role = 'admin', loginMethod = 'email' WHERE email = ?`,
  [passwordHash, email],
);
const [[row]] = await conn.query(`SELECT passwordHash FROM users WHERE email = ?`, [email]);
const ok = await verifyPassword(password, row.passwordHash);
await conn.end();
console.log(ok ? "password set ok" : "password verify failed");
