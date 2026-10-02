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
    }),
);

for (const name of ["NEW_DATABASE_URL", "OLD_DATABASE_URL", "DATABASE_URL"]) {
  const url = env[name];
  if (!url) continue;
  try {
    const conn = await mysql.createConnection(url);
    const [withText] = await conn.query(
      "SELECT COUNT(*) AS c FROM posts WHERE published = 1 AND target IN ('feed', 'both') AND text IS NOT NULL AND text != ''",
    );
    const [sample] = await conn.query(
      "SELECT id, instagramId, LEFT(text, 60) AS t FROM posts WHERE published = 1 AND text != '' ORDER BY sortOrder LIMIT 3",
    );
    console.log(name, "withText", withText[0].c);
    for (const r of sample) console.log(" ", r.id, r.instagramId, r.t);
    await conn.end();
  } catch (e) {
    console.log(name, "ERR", e.message);
  }
}
