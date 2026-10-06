// Refilter/repack non-interlaced PNG without changing samples or ancillary chunks.
// In particular this preserves 16-bit colour and ICC, unlike conversion to WebP.
import { deflateSync, inflateSync, crc32, constants } from "node:zlib";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
function chunks(bytes) {
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error("Not PNG");
  const result = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error("Truncated PNG");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new Error("Invalid PNG CRC");
    result.push({ type, data, bytes: bytes.subarray(offset, end) });
    offset = end;
  }
  return result;
}
function paeth(left, up, corner) {
  const value = left + up - corner;
  const a = Math.abs(value - left), b = Math.abs(value - up), c = Math.abs(value - corner);
  return a <= b && a <= c ? left : b <= c ? up : corner;
}
function predictor(filter, left, up, corner) {
  switch (filter) {
    case 0: return 0;
    case 1: return left;
    case 2: return up;
    case 3: return Math.floor((left + up) / 2);
    case 4: return paeth(left, up, corner);
    default: throw new Error("Invalid PNG filter");
  }
}
function unfilter(filtered, width, height, bpp) {
  if (filtered.length !== (width + 1) * height) throw new Error("Invalid PNG scanlines");
  const raw = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (width + 1)];
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      raw[i] = (filtered[y * (width + 1) + x + 1] + predictor(filter,
        x >= bpp ? raw[i - bpp] : 0, y ? raw[i - width] : 0,
        y && x >= bpp ? raw[i - width - bpp] : 0)) & 255;
    }
  }
  return raw;
}
function refilter(raw, width, height, bpp) {
  const output = Buffer.alloc((width + 1) * height);
  const candidate = Buffer.alloc(width);
  for (let y = 0; y < height; y++) {
    let best = Infinity;
    for (let filter = 0; filter <= 4; filter++) {
      let cost = 0;
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const value = (raw[i] - predictor(filter, x >= bpp ? raw[i - bpp] : 0,
          y ? raw[i - width] : 0, y && x >= bpp ? raw[i - width - bpp] : 0)) & 255;
        candidate[x] = value;
        cost += Math.min(value, 256 - value);
      }
      if (cost < best) {
        best = cost;
        output[y * (width + 1)] = filter;
        candidate.copy(output, y * (width + 1) + 1);
      }
    }
  }
  return output;
}
function idat(data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write("IDAT", 4, "ascii");
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
  return result;
}
export function optimizeLosslessPng(bytes) {
  const parts = chunks(bytes);
  const header = parts.find((part) => part.type === "IHDR")?.data;
  // APNG and interlaced files require different scanline handling; preserve them.
  if (!header || header[12] !== 0 || parts.some((part) => part.type === "acTL")) return bytes;
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
  const bits = channels[header[9]] * header[8];
  if (!bits || header[10] || header[11]) return bytes;
  const rowWidth = Math.ceil(width * bits / 8), bpp = Math.max(1, Math.ceil(bits / 8));
  if ((rowWidth + 1) * height > 512 * 1024 * 1024) return bytes;
  const filtered = inflateSync(Buffer.concat(parts.filter((part) => part.type === "IDAT").map((part) => part.data)),
    { maxOutputLength: 512 * 1024 * 1024 });
  const raw = unfilter(filtered, rowWidth, height, bpp);
  const adaptive = refilter(raw, rowWidth, height, bpp);
  if (!raw.equals(unfilter(adaptive, rowWidth, height, bpp))) throw new Error("PNG sample mismatch");
  const candidates = [filtered, adaptive].flatMap((data) => [constants.Z_DEFAULT_STRATEGY, constants.Z_FILTERED]
    .map((strategy) => deflateSync(data, { level: 9, strategy })));
  candidates.sort((a, b) => a.length - b.length);
  let inserted = false;
  const output = Buffer.concat([signature, ...parts.flatMap((part) => {
    if (part.type !== "IDAT") return [part.bytes];
    if (inserted) return [];
    inserted = true;
    return [idat(candidates[0])];
  })]);
  return output.length < bytes.length ? output : bytes;
}
