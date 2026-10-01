/**
 * Generate a base32 TOTP secret for ADMIN_TOTP_SECRET.
 * Add to production .env, then scan in Google Authenticator / 1Password.
 *
 * Usage: node scripts/generate-admin-totp.mjs
 */
import crypto from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes = crypto.randomBytes(20);
let bits = 0;
let value = 0;
let secret = "";

for (const byte of bytes) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) {
    secret += alphabet[(value >>> (bits - 5)) & 31];
    bits -= 5;
  }
}
if (bits > 0) secret += alphabet[(value << (5 - bits)) & 31];

console.log("ADMIN_TOTP_SECRET=" + secret);
console.log("");
console.log("1. Paste into production .env");
console.log("2. Restart API (pm2 restart daryadarcy-api)");
console.log("3. Add manual entry in authenticator: account daryadarcy-admin, secret above, 6 digits / 30s");
