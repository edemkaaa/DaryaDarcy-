const token =
  "bWFpbgEAAA4wAAABoDL2vfkAAAGgM9NiWWv79fj2TrdklOX0rChamI9n48-1ksfFrPDyt2FATDAKzWr7xY5sxhnOFWRaq9p6cwurx7OikgWMaWluiPRl1cCXK4Uq108O2KN42f-BtjKKcYVkHh4PuHGNAJxJM81XlmSaqw";
const resourceUrl =
  "https://office-online.disk.yandex.net/v1/disk/wopi/files/Y2ViOJGjaUJtmlIid8xNsl5IUzNzmhWbdSlSAuTi5MAf7Itm82p0wKQTL54ZZOLCj_oND1DmKqKS3xKgbzjc-Q2EFAAmhNsSGYxJ3ghuR1oj3oJ6moc5u9rNKqCM_nCo";

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
