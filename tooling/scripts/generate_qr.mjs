#!/usr/bin/env node
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

const url = process.argv[2];

if (!url) {
  console.error('Usage: node tooling/scripts/generate_qr.mjs "exps://..."');
  process.exit(1);
}

const output = path.join("tmp", "expo-qr-code.png");
fs.mkdirSync(path.dirname(output), { recursive: true });
await QRCode.toFile(output, url, { width: 512 });
console.log(`✅ QR code saved to ${output}`);
