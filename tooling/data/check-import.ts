// Сверяет результат импорта через общую SQL-схему. Загрузка окружения выбирает подключение, поэтому запуск требует проверки целевой БД.
import "../scripts/load-env.js";
import { drizzle } from "drizzle-orm/mysql2";
import { posts } from "../../packages/database/src/schema";
import { desc, asc, sql } from "drizzle-orm";

async function check() {
  // Считает посты и показывает крайние строки по историческому sortOrder; это диагностика БД, а не актуальной хронологии API.

  const db = drizzle(process.env.DATABASE_URL!);
  
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(posts);
  console.log("Total posts in DB:", countResult[0].count);

  const newest = await db.select().from(posts).orderBy(asc(posts.sortOrder), desc(posts.createdAt)).limit(3);
  console.log("\nNewest 3 posts (shown first in feed):");
  for (const p of newest) {
    console.log(`  #${p.id} | sortOrder: ${p.sortOrder} | tags: ${JSON.stringify(p.tags)} | text: ${p.text.slice(0, 60)}...`);
  }

  const oldest = await db.select().from(posts).orderBy(desc(posts.sortOrder)).limit(3);
  console.log("\nOldest 3 posts (shown last in feed):");
  for (const p of oldest) {
    console.log(`  #${p.id} | sortOrder: ${p.sortOrder} | instagramId: ${p.instagramId} | text: ${p.text.slice(0, 60)}...`);
  }

  process.exit(0);
}

check().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
