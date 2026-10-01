import { getDb } from '../server/db';
import { posts } from '../drizzle/schema';

async function verify() {
  const db = await getDb();
  if (!db) { console.log('No DB connection'); process.exit(1); }
  const allPosts = await db.select().from(posts);
  let s3Count = 0;
  let igCount = 0;
  let totalPhotos = 0;
  
  for (const post of allPosts) {
    const images = post.photos as string[];
    if (!images || images.length === 0) continue;
    totalPhotos += images.length;
    
    const hasS3 = images.some(url => url.includes('s3.twcstorage.ru') || url.includes('timeweb'));
    const hasIG = images.some(url => url.includes('instagram') || url.includes('cdninstagram'));
    
    if (hasS3) s3Count++;
    if (hasIG) igCount++;
  }
  
  console.log('=== Verification ===');
  console.log('Total posts:', allPosts.length);
  console.log('Posts with S3 photos:', s3Count);
  console.log('Posts still with Instagram CDN:', igCount);
  console.log('Total photo URLs:', totalPhotos);
  process.exit(0);
}
verify();
