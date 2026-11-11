// Скачивает выбранные публичные картинки S3 и готовит локальные варианты сайта. Уменьшение размеров и quality здесь не являются lossless-операцией.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "site", "public", "img");
fs.mkdirSync(outDir, { recursive: true });

const jobs = [
  { name: "hero.webp", width: 900, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg" },
  { name: "banner-feed.webp", width: 240, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/cc53a49e1416-qxGDcExHmMNZuoWc.jpg" },
  { name: "banner-club.webp", width: 240, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/597ab82580a0-GDVbsOSXBYgogKWH.jpg" },
  { name: "banner-interactive.webp", width: 240, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/6ac128a122fc-aEjJLmnJbZuksHiz.jpg" },
  { name: "banner-library.webp", width: 240, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7e8f673737d1-bGwFUQjrxWpTxAMM.jpg" },
  { name: "banner-shop.webp", width: 240, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8283ecb861ab-BSgzKdVEmubRcHjZ.jpg" },
  { name: "club.webp", width: 900, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9e3aec1f0a5d-PUMBhecZrXmmctyT.jpg" },
  { name: "book-1.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b8106c44719f-tlMfbAYBCxFjOQfm.webp" },
  { name: "book-2.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/94b5bebfd7f4-IbTlGDtcIAJBcJAR.webp" },
  { name: "book-3.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.webp" },
  { name: "digital-1.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/76751795802b-cvPWAEJjkmXMKPjM.webp" },
  { name: "digital-2.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b573a5cea177-nNMSLpNDmzQdnfqe.webp" },
  { name: "lib-about.webp", width: 560, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG" },
  { name: "lib-stilizacii.webp", width: 560, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3b8642166933-rdRVzYWvuGEmSUdF.jpeg" },
  { name: "lib-loshadka.webp", width: 560, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/library/loshadka-cover.jpg" },
  { name: "lib-aesthetics.webp", width: 560, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg" },
  { name: "lib-recipes.webp", width: 560, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/877a6c2a49ef-JZjLEpuxmhqHszUD.jpg" },
  { name: "lib-peterburg.webp", width: 560, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/925076516046-CkdCchNXtpJkPNVd.JPG" },
  { name: "lib-patterns.webp", width: 560, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg" },
  { name: "about-2.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/90e0ee86a4ff-kMJdEKDrnBTzTyzP.JPG" },
  { name: "about-3.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d2e7c03c6f36-CAbMTXzGTiRynQvA.jpeg" },
  { name: "about-4.webp", width: 720, url: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9503c81d3711-gFvZsxUUAlJFJQPJ.JPG" },
];

for (const job of jobs) {
  const res = await fetch(job.url);
  if (!res.ok) throw new Error(`${res.status} ${job.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(outDir, job.name);
  await sharp(buf).rotate().resize({ width: job.width, withoutEnlargement: true }).webp({ quality: 72 }).toFile(out);
  const stat = fs.statSync(out);
  console.log(`${job.name} ${buf.length} -> ${stat.size}`);
}
