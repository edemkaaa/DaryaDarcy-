// Диагностирует временные ссылки Яндекс-документа только с доступом из закрытого окружения; байты и сетевые ответы не подтверждают перенос материала.
// Историческая диагностика документа: временный доступ задаётся только закрытым окружением вне Git.
const token = process.env.YANDEX_DISK_DOWNLOAD_TOKEN;
const resourceUrl = process.env.YANDEX_DISK_RESOURCE_URL;
if (!token || !resourceUrl) {
  throw new Error("Set YANDEX_DISK_DOWNLOAD_TOKEN and YANDEX_DISK_RESOURCE_URL outside Git before running this diagnostic");
}

const candidates = [
  `${resourceUrl}/contents?access_token=${encodeURIComponent(token)}`,
  `${resourceUrl}?access_token=${encodeURIComponent(token)}`,
  `https://volga.yandex.ru/document/download?token=${encodeURIComponent(token)}&type=DOCUMENT`,
];

for (const url of candidates) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    const ct = r.headers.get("content-type") || "";
    console.log(url.split("?")[0], r.status, ct, r.headers.get("content-length") || "");
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      console.log(" bytes", buf.length, "head", buf.slice(0, 4).toString("hex"));
    } else {
      console.log(" body", (await r.text()).slice(0, 200));
    }
  } catch (e) {
    console.log("err", e.message);
  }
}
