// Историческая эвристика считает посты без instagramId тестовыми. Она может затронуть вручную созданный контент, поэтому не подходит для очистки рабочей БД.
import { getDb } from '../../apps/backend/src/db';
import { posts } from '../../packages/database/src/schema';
import { isNull, eq } from 'drizzle-orm';

async function deleteTestPosts() {
  // Опасная историческая эвристика удаляет все посты без instagramId, включая ручные; запускать для очистки рабочей БД нельзя.

  const db = await getDb();
  if (!db) { console.log('No DB connection'); process.exit(1); }

  // Find posts that don't have an instagramId (these are test/manual posts)
  const testPosts = await db.select({ id: posts.id, text: posts.text, instagramId: posts.instagramId })
    .from(posts)
    .where(isNull(posts.instagramId));

  console.log(`Found ${testPosts.length} non-Instagram posts:`);
  for (const p of testPosts) {
    const preview = (p.text || '').substring(0, 60);
    console.log(`  ID ${p.id}: "${preview}..."`);
  }

  if (testPosts.length === 0) {
    console.log('No test posts to delete.');
    process.exit(0);
  }

  // Delete them
  for (const p of testPosts) {
    await db.delete(posts).where(eq(posts.id, p.id));
  }

  console.log(`\nDeleted ${testPosts.length} test posts.`);

  // Verify
  const remaining = await db.select({ id: posts.id }).from(posts);
  console.log(`Remaining posts in database: ${remaining.length}`);
  process.exit(0);
}

deleteTestPosts();
