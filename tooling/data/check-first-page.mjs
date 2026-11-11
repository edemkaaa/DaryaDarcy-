// Показывает первую выборку постов из выбранной БД для проверки порядка и наполнения; не меняет клиентскую пагинацию.
import fs from "fs";
import mysql from "mysql2/promise";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

// Первая страница читается по историческому порядку SQL; результаты не доказывают нынешнюю сортировку tRPC.
const conn = await mysql.createConnection(env.DATABASE_URL);
const [firstPage] = await conn.query(
  `SELECT p.id, p.text, p.richText IS NOT NULL AS hasRt,
    (SELECT GROUP_CONCAT(pm.type) FROM post_media pm WHERE pm.postId = p.id) AS mediaTypes
   FROM posts p
   WHERE p.published = 1 AND p.target IN ('feed', 'both')
   ORDER BY p.sortOrder LIMIT 12`
);
for (const r of firstPage) {
  console.log(r.id, "media:", r.mediaTypes || "none", "richText:", r.hasRt, "textLen:", (r.text || "").length);
}
await conn.end();
