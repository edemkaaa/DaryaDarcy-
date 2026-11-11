import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { getDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { processScheduledAccountDeletions, runDataRetentionMaintenance } from "../apps/backend/src/platform-db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";
import { WorkerJobs } from "../apps/backend/src/workers/worker-jobs.service";
import { WORKER_OPERATIONS, type WorkerOperations } from "../apps/backend/src/workers/worker-operations";
import { randomUUID } from "node:crypto";
import { requestMemberEmailBinding } from "../apps/backend/src/identity/email-binding";
import { lockPrivateAttachmentActor } from "../apps/backend/src/content/private-attachment-uploads";
import { drizzle } from "drizzle-orm/mysql2";
import { privateReceiptForMedia } from "../apps/backend/src/content/private-attachment-association";
import { maintainPrivateRecovery } from "../apps/backend/src/content/private-recovery-maintenance";
import { privateStorageNamespace } from "../apps/backend/src/media/private-upload-object";

describe.skipIf(!testDatabaseUrl)("account retention on disposable MySQL", () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "retention-http-synthetic-secret-32");
    await conn.query("CREATE TABLE IF NOT EXISTS articles (id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB");
    await conn.query(`CREATE TABLE IF NOT EXISTS push_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,token VARCHAR(256) NOT NULL UNIQUE,userId INT NULL,
      platform VARCHAR(16),enabled BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
  });
  beforeEach(async () => {
    await cleanupRecoveryContent();
    await cleanupBindings();
    await conn.query("DELETE FROM pen_pal_matches WHERE userLowId IN (92101,92103)");
    for (const table of ["billing_profiles", "password_tokens", "access_email_outbox"])
      await conn.query(`DELETE FROM ${table} WHERE userId BETWEEN 92101 AND 92104`);
    await conn.query("DELETE FROM pen_pal_shown WHERE userId=92101 OR matchUserId=92101");
    for (const table of ["club_payments", "pen_pal_profiles", "post_comments", "likes", "saved_posts", "push_tokens"])
      await conn.query(`DELETE FROM ${table} WHERE userId BETWEEN 92101 AND 92104`);
    await conn.query("DELETE FROM comment_reports WHERE reporterUserId=92101");
    await conn.query("DELETE FROM users WHERE id BETWEEN 92101 AND 92104");
    await conn.query(`INSERT INTO users (id,openId,name,email,passwordHash,accountDeletionRequestedAt) VALUES
      (92101,'retention-fixture','Fixture name','retention@example.test','fixture-hash',DATE_SUB(NOW(),INTERVAL 31 DAY)),
      (92102,'retention-neighbor','Neighbor name','neighbor@example.test','neighbor-hash',NULL)`);
    await conn.query(`INSERT INTO pen_pal_profiles (userId,fullName,city,interests,address,active)
      VALUES (92101,'Fixture name','Fixture city',JSON_ARRAY('fixture interest'),'Fixture address',TRUE)`);
    await conn.query(`INSERT INTO pen_pal_matches (userLowId,userHighId,initiatedBy,confirmDeadline)
      VALUES (92101,92102,92101,DATE_ADD(NOW(),INTERVAL 1 DAY))`);
    await conn.query("INSERT INTO pen_pal_shown (userId,matchUserId) VALUES (92101,92102),(92102,92101)");
    await conn.query("INSERT INTO post_comments (postId,userId,text,photos) VALUES (92100,92101,'Fixture personal text',JSON_ARRAY('https://example.test/photo'))");
    await conn.query("INSERT INTO likes (userId,postId) VALUES (92101,92100)");
    await conn.query("INSERT INTO saved_posts (userId,postId) VALUES (92101,92100)");
    // This fixture tests token removal, not delivery; keep it out of the other
    // concurrently running suite's global push audiences.
    await conn.query("INSERT INTO push_tokens (token,userId,enabled) VALUES ('retention-fixture-token',92101,FALSE)");
    await conn.query("INSERT INTO comment_reports (commentId,reporterUserId,reason) VALUES (92100,92101,'Fixture report')");
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (conn) await cleanupRecoveryContent();
    if (conn) await cleanupBindings();
    await conn?.query("DELETE FROM push_tokens WHERE token='retention-fixture-token'");
    await conn?.query("UPDATE users SET accountDeletionRequestedAt=NULL WHERE id BETWEEN 92101 AND 92104");
    if (conn) {
      await conn.query("DELETE FROM pen_pal_matches WHERE userLowId=92103");
      for (const table of ["club_payments", "billing_profiles", "password_tokens", "access_email_outbox"])
        await conn.query(`DELETE FROM ${table} WHERE userId BETWEEN 92101 AND 92104`);
    }
    await conn?.end();
    const database = await getDb();
    await (database as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    vi.unstubAllEnvs();
  });
  async function cleanupBindings() {
    await conn.query("DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b ON b.requestKey=o.requestKey WHERE b.actorUserId=92103");
    await conn.query("DELETE FROM member_email_bindings WHERE actorUserId=92103");
    await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=92103");
  }
  async function cleanupRecoveryContent() {
    await conn.query("DELETE FROM private_attachment_uploads WHERE assetId LIKE '92100000-0000-4000-8000-%'");
    await conn.query("DELETE FROM content_recovery_markers WHERE actorUserId=92102 AND requestKey=REPEAT('b',64)");
    await conn.query("DELETE FROM post_media WHERE postId IN (SELECT id FROM posts WHERE source='r6-content-fixture')");
    await conn.query("DELETE FROM posts WHERE source='r6-content-fixture' OR source='article:92150'");
    await conn.query("DELETE FROM articles WHERE id=92150 OR title='r6-content-fixture'");
    await conn.query("DELETE FROM post_creation_requests WHERE actorUserId=92101");
    await conn.query("DELETE FROM article_creation_requests WHERE actorUserId=92101");
    await conn.query("DELETE FROM content_recovery_markers WHERE actorUserId=92101");
  }
  async function recoveryFixture() {
    await conn.query("INSERT INTO post_creation_requests(requestKey,actorUserId,payloadHash,postId) VALUES(REPEAT('a',64),92101,REPEAT('c',64),92150)");
    await conn.query("INSERT INTO article_creation_requests(requestKey,actorUserId,payloadHash,claimToken,articleId) VALUES(REPEAT('a',64),92101,REPEAT('c',64),'92100000-0000-4000-8000-000000000003',92150)");
    await conn.query("INSERT INTO content_recovery_markers(kind,requestKey,actorUserId,createdAt) VALUES('post',REPEAT('b',64),92101,NOW()),('article',REPEAT('b',64),92102,NOW())");
    await conn.query("INSERT INTO private_attachment_uploads(requestKey,actorUserId,assetId,payloadHash,namespaceHash,type,filename,mimeType,fileSize,state,etag,postId,mediaId) VALUES(REPEAT('a',64),92101,'92100000-0000-4000-8000-000000000001',REPEAT('c',64),REPEAT('d',64),'document','Personal name.pdf','application/pdf',10,'ready','fixture-etag',92150,92150),(REPEAT('b',64),92102,'92100000-0000-4000-8000-000000000002',REPEAT('c',64),REPEAT('d',64),'document','Neighbor.pdf','application/pdf',10,'pending',NULL,NULL,NULL)");
  }
  it("erases retired recovery ownership but preserves bound evidence and neighbor records", async () => {
    vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "true");
    try {
      await recoveryFixture();
      vi.stubEnv("CONTENT_RECOVERY_EXPORT_ENABLED","true");
      const user=await getUserByOpenId('retention-fixture');
      const caller=appRouter.createCaller({user:user!,req:{} as TrpcContext['req'],res:{} as TrpcContext['res']});
      expect((await caller.profileExtras.recoveryExport({kind:'private_attachment'})).items).toHaveLength(1);
      await conn.query("INSERT INTO posts(id,text,photos,tags,source) VALUES(92150,'Keep',JSON_ARRAY(),JSON_ARRAY(),'r6-content-fixture')");
      await conn.query("INSERT INTO post_media(id,postId,type,url) VALUES(92150,92150,'document','/api/media/post-attachments/92150')");
      expect(await processScheduledAccountDeletions()).toBe(1);
      await expect(caller.profileExtras.recoveryExport({kind:'private_attachment'})).rejects.toMatchObject({code:'UNAUTHORIZED'});
      for (const table of ["post_creation_requests", "article_creation_requests", "content_recovery_markers"] as const) {
        const [rows] = await conn.query<RowDataPacket[]>(`SELECT requestKey FROM ${table} WHERE actorUserId=92101`);
        expect(rows).toEqual([]);
      }
      const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM private_attachment_uploads ORDER BY assetId");
      expect(rows.find(row => row.assetId.endsWith('000001'))).toMatchObject({actorUserId:null,filename:'',state:'ready',etag:'fixture-etag',payloadHash:'c'.repeat(64),namespaceHash:'d'.repeat(64),postId:92150,mediaId:92150});
      expect(rows.find(row => row.assetId.endsWith('000002'))).toMatchObject({actorUserId:92102,filename:'Neighbor.pdf',state:'pending'});
      expect(rows.find(row => row.assetId.endsWith('000001'))!.requestKey).not.toBe('a'.repeat(64));
      vi.stubEnv('S3_ENDPOINT','http://127.0.0.1:1');
      vi.stubEnv('S3_BUCKET','r6-fixture');
      await conn.query("UPDATE private_attachment_uploads SET namespaceHash=? WHERE assetId='92100000-0000-4000-8000-000000000001'",[privateStorageNamespace().hash]);
      expect(await privateReceiptForMedia(drizzle(conn),{id:92150,postId:92150,type:'document'})).toMatchObject({key:'feed/documents/private-v1/92100000-0000-4000-8000-000000000001',etag:'fixture-etag'});
    } finally { vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "false"); }
  });
  it.each(["off", "rollback", "partial", "nontransactional", "nonunique"])("keeps recovery links intact on %s retirement", async scenario => {
    await recoveryFixture();
    vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", scenario === "off" ? "false" : "true");
    if (scenario === "rollback") await conn.query("CREATE TRIGGER backend_test_r6_failure BEFORE UPDATE ON users FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture rollback'");
    if (scenario === "partial") await conn.query("RENAME TABLE content_recovery_markers TO backend_test_r6_markers_hold");
    if (scenario === "nontransactional") await conn.query("ALTER TABLE post_creation_requests ENGINE=MyISAM");
    if (scenario === "nonunique") await conn.query("ALTER TABLE private_attachment_uploads DROP PRIMARY KEY");
    try {
      if (scenario === "off") expect(await processScheduledAccountDeletions()).toBe(1);
      else await expect(processScheduledAccountDeletions()).rejects.toThrow();
      const [rows] = await conn.query<RowDataPacket[]>("SELECT actorUserId,filename FROM private_attachment_uploads WHERE assetId='92100000-0000-4000-8000-000000000001'");
      expect(rows).toEqual([{actorUserId:92101,filename:'Personal name.pdf'}]);
      expect((await conn.query<RowDataPacket[]>("SELECT requestKey FROM post_creation_requests WHERE actorUserId=92101"))[0]).toHaveLength(1);
      if (scenario !== "off") expect((await conn.query<RowDataPacket[]>("SELECT sessionVersion,email FROM users WHERE id=92101"))[0][0]).toMatchObject({sessionVersion:0,email:'retention@example.test'});
    } finally {
      if (scenario === "rollback") await conn.query("DROP TRIGGER backend_test_r6_failure");
      if (scenario === "partial") await conn.query("RENAME TABLE backend_test_r6_markers_hold TO content_recovery_markers");
      if (scenario === "nontransactional") await conn.query("ALTER TABLE post_creation_requests ENGINE=InnoDB");
      if (scenario === "nonunique") await conn.query("ALTER TABLE private_attachment_uploads ADD PRIMARY KEY(requestKey)");
      vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED","false");
    }
  });
  it('retires all private receipts across bounded batches without skipping moved keys',async()=>{
    for(let n=1000;n<1101;n++)await conn.query("INSERT INTO private_attachment_uploads(requestKey,actorUserId,assetId,payloadHash,namespaceHash,type,filename,mimeType,fileSize) VALUES(?,92101,?,REPEAT('c',64),REPEAT('d',64),'document','Personal.pdf','application/pdf',10)",[n.toString(16).padStart(64,'0'),`92100000-0000-4000-8000-${n.toString().padStart(12,'0')}`]);
    vi.stubEnv('CONTENT_RECOVERY_RETIREMENT_ENABLED','true');
    try{
      expect(await processScheduledAccountDeletions()).toBe(1);
      const [rows]=await conn.query<RowDataPacket[]>("SELECT actorUserId,filename,recoveryCompactedAt FROM private_attachment_uploads WHERE assetId LIKE '92100000-0000-4000-8000-%'");
      expect(rows).toHaveLength(101);expect(rows.every(row=>row.actorUserId===null&&row.filename===''&&row.recoveryCompactedAt instanceof Date)).toBe(true);
    }finally{vi.stubEnv('CONTENT_RECOVERY_RETIREMENT_ENABLED','false');}
  });
  it("keeps retired orphan evidence without recreating an owner marker during local compaction", async () => {
    await recoveryFixture();
    await conn.query("UPDATE private_attachment_uploads SET postId=NULL,mediaId=NULL,createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=92101");
    vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED","true");
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED","true");
    vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED","true");
    vi.stubEnv("PRIVATE_ORPHAN_CLEANUP_ENABLED","false");
    try {
      expect(await processScheduledAccountDeletions()).toBe(1);
      const result=await maintainPrivateRecovery(drizzle(conn),{limit:100});
      expect(result.failed).toBe(0);
      const [rows]=await conn.query<RowDataPacket[]>("SELECT actorUserId,orphanedAt,etag FROM private_attachment_uploads WHERE assetId='92100000-0000-4000-8000-000000000001'");
      expect(rows[0]).toMatchObject({actorUserId:null,etag:'fixture-etag'});
      expect(rows[0].orphanedAt).toBeInstanceOf(Date);
      expect((await conn.query<RowDataPacket[]>("SELECT requestKey FROM content_recovery_markers WHERE kind='private_attachment'"))[0]).toEqual([]);
    } finally {
      for (const key of ['CONTENT_RECOVERY_RETIREMENT_ENABLED','CONTENT_RECOVERY_RETENTION_ENABLED','CONTENT_RECOVERY_MAINTENANCE_ENABLED']) vi.stubEnv(key,'false');
    }
  });
  async function contentSnapshot() {
    const [posts] = await conn.query<RowDataPacket[]>("SELECT id,text,status FROM posts WHERE source='r6-content-fixture' OR source='article:92150' ORDER BY id");
    const [articles] = await conn.query<RowDataPacket[]>("SELECT id,title FROM articles WHERE id=92150 OR title='r6-content-fixture' ORDER BY id");
    const [postIntents] = await conn.query<RowDataPacket[]>("SELECT requestKey FROM post_creation_requests WHERE actorUserId=92101");
    const [articleIntents] = await conn.query<RowDataPacket[]>("SELECT requestKey FROM article_creation_requests WHERE actorUserId=92101");
    return {posts,articles,postIntents,articleIntents};
  }
  it.each(["post-create-keyed","post-create-legacy","post-edit","post-delete","post-confirm","article-create-keyed","article-create-legacy","article-edit","article-delete"])("refuses stale pre-retirement RPC context for %s before any content effect", async operation => {
    await conn.query("UPDATE users SET role='admin' WHERE id=92101");
    await conn.query("INSERT INTO posts (id,text,photos,tags,source,status,published) VALUES (92150,'Keep original',JSON_ARRAY(),JSON_ARRAY(),'r6-content-fixture','draft',FALSE)");
    await conn.query("INSERT INTO articles (id,title,access,published,sections) VALUES (92150,'Keep original','club',FALSE,JSON_ARRAY())");
    const user = await getUserByOpenId("retention-fixture");
    const caller = appRouter.createCaller({user:user!, req:{} as TrpcContext['req'], res:{} as TrpcContext['res']});
    expect(await processScheduledAccountDeletions()).toBe(1);
    const before = await contentSnapshot();
    const post = {text:"r6-content-fixture",photos:[],tags:[],source:"r6-content-fixture",status:"draft" as const};
    const article = {title:"r6-content-fixture",published:false,sections:[]};
    const invoke = () => {
      switch(operation) {
        case "post-create-keyed": return caller.admin.createPost({...post,idempotencyKey:"r6-content-key-00001"});
        case "post-create-legacy": return caller.admin.createPost(post);
        case "post-edit": return caller.admin.updatePost({id:92150,text:"r6-content-fixture"});
        case "post-delete": return caller.admin.deletePost({id:92150});
        case "post-confirm": return caller.admin.confirmPost({id:92150});
        case "article-create-keyed": return caller.admin.createArticle({...article,idempotencyKey:"cb7e9219-b57b-46ba-8718-a41b61197b10"});
        case "article-create-legacy": return caller.admin.createArticle(article);
        case "article-edit": return caller.admin.updateArticle({id:92150,title:"r6-content-fixture"});
        case "article-delete": return caller.admin.deleteArticle({id:92150});
        default: throw new Error("Unknown fixture operation");
      }
    };
    await expect(invoke()).rejects.toMatchObject({code:"UNAUTHORIZED"});
    expect(await contentSnapshot()).toEqual(before);
  });
  async function queueBinding() {
    vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", Buffer.alloc(32, 33).toString("base64"));
    await conn.query("INSERT INTO users (id,openId,role,sessionVersion) VALUES (92103,'retention-binding-admin','admin',0)");
    await conn.query("UPDATE users SET email=NULL,phone='+70000092101',accountDeletionRequestedAt=NULL WHERE id=92101");
    const requestKey = randomUUID();
    await requestMemberEmailBinding((await getDb())!, { userId: 92103, sessionVersion: 0 }, {
      userId: 92101, email: 'retention-binding@example.test', requestKey,
    });
    await conn.query("UPDATE users SET accountDeletionRequestedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE id=92101");
    return requestKey;
  }
  async function bindingRows(requestKey: string) {
    return (await conn.query<RowDataPacket[]>("SELECT b.*,o.tokenCipher,o.leaseId,o.leaseUntil,o.discardedAt FROM member_email_bindings b JOIN member_email_binding_outbox o ON o.requestKey=b.requestKey WHERE b.requestKey=?", [requestKey]))[0];
  }
  it("cancels and scrubs pending email proofs in the account deletion transaction", async () => {
    const key = await queueBinding();
    expect(await processScheduledAccountDeletions()).toBe(1);
    expect(await bindingRows(key)).toEqual([expect.objectContaining({
      state: 'cancelled', email: null, proofHash: null, tokenCipher: null,
      leaseId: null, leaseUntil: null, completedAt: expect.any(Date), discardedAt: expect.any(Date),
    })]);
    const [audit] = await conn.query<RowDataPacket[]>("SELECT targetId,details FROM admin_audit_log WHERE actorUserId=92103 AND action='cancel_member_email_binding'");
    expect(audit).toEqual([{ targetId: 92101, details: null }]);
  });
  it("rolls back proof scrubbing together with a failed account deletion", async () => {
    const key = await queueBinding();
    const before = await bindingRows(key);
    await conn.query(`CREATE TRIGGER backend_test_retention_failure BEFORE UPDATE ON users FOR EACH ROW
      BEGIN IF OLD.id=92101 AND NEW.openId LIKE 'deleted-%' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture final cleanup failure'; END IF; END`);
    try { await expect(processScheduledAccountDeletions()).rejects.toThrow(); }
    finally { await conn.query("DROP TRIGGER backend_test_retention_failure"); }
    expect(await bindingRows(key)).toEqual(before);
  });
  it("preserves legacy deletion before both binding tables are installed", async () => {
    await conn.query("RENAME TABLE member_email_bindings TO retention_fixture_bindings, member_email_binding_outbox TO retention_fixture_binding_outbox");
    try {
      expect(await processScheduledAccountDeletions()).toBe(1);
      expect((await snapshot()).user[0]).toMatchObject({ email: null, passwordHash: null });
    } finally {
      await conn.query("RENAME TABLE retention_fixture_bindings TO member_email_bindings, retention_fixture_binding_outbox TO member_email_binding_outbox");
    }
  });
  it("refuses partial binding schemas without partially deleting an account", async () => {
    const before = await snapshot();
    await conn.query("RENAME TABLE member_email_binding_outbox TO retention_fixture_binding_outbox");
    try {
      await expect(processScheduledAccountDeletions()).rejects.toMatchObject({ code: 'unavailable' });
      expect(await snapshot()).toEqual(before);
    } finally {
      await conn.query("RENAME TABLE retention_fixture_binding_outbox TO member_email_binding_outbox");
    }
  });
  it("rolls back the account and proof when cancellation audit fails", async () => {
    const key = await queueBinding();
    const before = await snapshot();
    const proof = await bindingRows(key);
    await conn.query(`CREATE TRIGGER backend_test_binding_retention_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW
      BEGIN IF NEW.actorUserId=92103 AND NEW.action='cancel_member_email_binding' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture audit cleanup failure'; END IF; END`);
    try {
      await expect(processScheduledAccountDeletions()).rejects.toMatchObject({ code: 'unavailable' });
      expect(await bindingRows(key)).toEqual(proof);
      expect(await snapshot()).toEqual(before);
    } finally { await conn.query("DROP TRIGGER backend_test_binding_retention_failure"); }
  });
  async function snapshot() {
    const [[user], [profile], [comments], [matches], [shown], [activity]] = await Promise.all([
      conn.query<RowDataPacket[]>("SELECT openId,name,email,passwordHash,accountDeletionRequestedAt FROM users WHERE id=92101"),
      conn.query<RowDataPacket[]>("SELECT fullName,city,interests,address,active FROM pen_pal_profiles WHERE userId=92101"),
      conn.query<RowDataPacket[]>("SELECT text,photos FROM post_comments WHERE userId=92101"),
      conn.query<RowDataPacket[]>("SELECT COUNT(*) n FROM pen_pal_matches WHERE userLowId=92101"),
      conn.query<RowDataPacket[]>("SELECT COUNT(*) n FROM pen_pal_shown WHERE userId=92101 OR matchUserId=92101"),
      conn.query<RowDataPacket[]>(`SELECT
        (SELECT COUNT(*) FROM likes WHERE userId=92101) likes,
        (SELECT COUNT(*) FROM saved_posts WHERE userId=92101) saves,
        (SELECT COUNT(*) FROM push_tokens WHERE userId=92101) pushes,
        (SELECT COUNT(*) FROM comment_reports WHERE reporterUserId=92101) reports`),
    ]);
    return { user, profile, comments, matches, shown, activity };
  }
  it("rolls back every scrub operation when the final account update fails", async () => {
    const before = await snapshot();
    await conn.query(`CREATE TRIGGER backend_test_retention_failure BEFORE UPDATE ON users FOR EACH ROW
      BEGIN IF OLD.id=92101 AND NEW.email IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture final cleanup failure'; END IF; END`);
    try {
      await expect(processScheduledAccountDeletions()).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    } finally { await conn.query("DROP TRIGGER backend_test_retention_failure"); }
  });
  it("revokes the pre-deletion actor epoch so an already authenticated upload cannot resume", async () => {
    await conn.query("UPDATE users SET role='admin',sessionVersion=7 WHERE id=92101");
    expect(await processScheduledAccountDeletions()).toBe(1);
    await expect((await getDb())!.transaction(tx => lockPrivateAttachmentActor(tx,{id:92101,sessionVersion:7}))).rejects.toMatchObject({code:"UNAUTHORIZED"});
    const [rows] = await conn.query<RowDataPacket[]>("SELECT sessionVersion,role FROM users WHERE id=92101");
    expect(rows).toEqual([{sessionVersion:8,role:"admin"}]);
    expect(await processScheduledAccountDeletions()).toBe(0);
    const [again] = await conn.query<RowDataPacket[]>("SELECT sessionVersion FROM users WHERE id=92101");
    expect(again).toEqual([{sessionVersion:8}]);
  });
  it("scrubs password proofs and fences queued access mail without erasing billing evidence", async () => {
    await conn.query(`INSERT INTO password_tokens(userId,email,tokenHash,purpose,expiresAt)
      VALUES (92101,'retention@example.test',REPEAT('a',64),'reset',DATE_ADD(NOW(),INTERVAL 1 HOUR)),
      (92102,'neighbor@example.test',REPEAT('b',64),'setup',DATE_ADD(NOW(),INTERVAL 1 HOUR))`);
    await conn.query(`INSERT INTO access_email_outbox(eventKey,userId,email,kind,payload,sentAt,leaseId,leaseUntil)
      VALUES ('retention-reset',92101,'retention@example.test','password-reset',JSON_OBJECT('tokenCipher','fixture'),NULL,'retention-lease',DATE_ADD(NOW(),INTERVAL 1 MINUTE)),
      ('retention-payment',92101,'retention@example.test','club-access',JSON_OBJECT('orderId','retention-order','tokenCipher','fixture'),NOW(),NULL,NULL),
      ('retention-neighbor',92102,'neighbor@example.test','password-setup',JSON_OBJECT('tokenCipher','neighbor'),NULL,NULL,NULL)`);
    expect(await processScheduledAccountDeletions()).toBe(1);
    const [proofs] = await conn.query<RowDataPacket[]>("SELECT userId FROM password_tokens WHERE userId IN (92101,92102)");
    expect(proofs).toEqual([{ userId: 92102 }]);
    const [mail] = await conn.query<RowDataPacket[]>(`SELECT eventKey,email,payload,sentAt IS NOT NULL AS sent,
      discardedAt IS NOT NULL AS discarded,leaseId,leaseUntil
      FROM access_email_outbox WHERE userId IN (92101,92102) ORDER BY eventKey`);
    expect(mail).toEqual([
      { eventKey: "retention-neighbor", email: "neighbor@example.test", payload: { tokenCipher: "neighbor" }, sent: 0, discarded: 0, leaseId: null, leaseUntil: null },
      { eventKey: "retention-payment", email: "", payload: { orderId: "retention-order" }, sent: 1, discarded: 0, leaseId: null, leaseUntil: null },
      { eventKey: "retention-reset", email: "", payload: {}, sent: 0, discarded: 1, leaseId: null, leaseUntil: null },
    ]);
  });
  it("queues cancellation for an existing deletion request before the paid period ends", async () => {
    await conn.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt)
      VALUES (92101,'retention-fixture-active','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))`);
    await conn.query(`INSERT INTO billing_profiles (profileKey,userId,domain,subscriptionId,profileId,email,amountMinor)
      VALUES ('retention-fixture-active',92101,'fixture.payform.ru','123','1','retention@example.test',79000)`);
    const before = await snapshot();
    expect(await processScheduledAccountDeletions()).toBe(0);
    const [[profile]] = await conn.query<RowDataPacket[]>(
      "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE profileKey='retention-fixture-active'",
    );
    expect(profile).toEqual({ cancelRequestedAt: expect.any(Date), cancelledAt: null });
    expect(await snapshot()).toEqual(before);
  });
  it("continues with a healthy deletion and expired Pen Pals after a separate account fails", async () => {
    await conn.query("UPDATE users SET accountDeletionRequestedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE id=92102");
    await conn.query(`INSERT INTO pen_pal_matches(userLowId,userHighId,initiatedBy,confirmDeadline)
      VALUES (92103,92104,92103,DATE_SUB(NOW(),INTERVAL 1 DAY))`);
    await conn.query(`CREATE TRIGGER backend_test_retention_failure BEFORE UPDATE ON users FOR EACH ROW
      BEGIN IF OLD.id=92101 AND NEW.email IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture isolated cleanup failure'; END IF; END`);
    try {
      await expect(runDataRetentionMaintenance()).rejects.toThrow();
      const [[neighbor]] = await conn.query<RowDataPacket[]>("SELECT email FROM users WHERE id=92102");
      expect(neighbor.email).toBeNull();
      const [expired] = await conn.query<RowDataPacket[]>("SELECT id FROM pen_pal_matches WHERE userLowId=92103");
      expect(expired).toEqual([]);
      expect((await snapshot()).user[0].email).toBe("retention@example.test");
    } finally {
      await conn.query("DROP TRIGGER backend_test_retention_failure");
    }
    expect(await processScheduledAccountDeletions()).toBe(1);
  });
  it("clears the unverified checkout contact when an eligible account is anonymized", async () => {
    await conn.query("UPDATE users SET contactPhone='+79991234567' WHERE id=92101");
    await conn.query("INSERT INTO club_payments(userId,orderId,status,contactPhone) VALUES(92101,'retention-fixture-contact','failed','+79991234567')");
    expect(await processScheduledAccountDeletions()).toBe(1);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT orderId,contactPhone FROM club_payments WHERE orderId='retention-fixture-contact'");
    expect(rows).toEqual([{ orderId: 'retention-fixture-contact', contactPhone: null }]);
    const [owner] = await conn.query<RowDataPacket[]>("SELECT email,contactPhone FROM users WHERE id=92101");
    expect(owner).toEqual([{ email: null, contactPhone: null }]);
  });
  it("completes eligible scrubbing once and retains the discussion structure", async () => {
    expect(await processScheduledAccountDeletions()).toBe(1);
    const state = await snapshot();
    expect(state.user[0]).toMatchObject({ name: "Удалённый аккаунт", email: null, passwordHash: null, accountDeletionRequestedAt: null });
    expect(state.profile[0]).toMatchObject({ fullName: "Удалённый аккаунт", city: "Удалённый аккаунт", address: "Удалённый аккаунт", active: 0 });
    expect(state.comments).toEqual([{ text: "Комментарий удалён", photos: null }]);
    expect(state.matches).toEqual([{ n: 0 }]);
    expect(state.shown).toEqual([{ n: 0 }]);
    expect(state.activity).toEqual([{ likes: 0, saves: 0, pushes: 0, reports: 0 }]);
    expect(await processScheduledAccountDeletions()).toBe(0);
  });
  it.each(["active", "expired-in-grace", "recent-request", "no-request"])("preserves %s accounts", async condition => {
    if (condition === "active" || condition === "expired-in-grace")
      await conn.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt)
        VALUES (92101,'retention-fixture-paid','paid',${condition === "active" ? "DATE_ADD(NOW(),INTERVAL 1 DAY)" : "DATE_SUB(NOW(),INTERVAL 29 DAY)"})`);
    if (condition === "recent-request") await conn.query("UPDATE users SET accountDeletionRequestedAt=NOW() WHERE id=92101");
    if (condition === "no-request") await conn.query("UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=92101");
    const before = await snapshot();
    expect(await processScheduledAccountDeletions()).toBe(0);
    expect(await snapshot()).toEqual(before);
  });
  it("two workers count an eligible account only once", async () => {
    const result = await Promise.all([processScheduledAccountDeletions(), processScheduledAccountDeletions()]);
    expect(result.reduce((sum, count) => sum + count, 0)).toBe(1);
  });
  it("rechecks a renewal committed while cleanup waits for the billing owner lock", async () => {
    const guard = await openContentTestDatabase();
    let running: Promise<number> | undefined;
    const before = await snapshot();
    try {
      await guard.beginTransaction();
      await guard.query("SELECT id FROM users WHERE id=92101 FOR UPDATE");
      running = processScheduledAccountDeletions();
      // Observe the real lock wait; no arbitrary delay or mocked repository.
      await vi.waitFor(async () => {
        const [waiting] = await conn.query<RowDataPacket[]>(`SELECT 1 FROM performance_schema.data_lock_waits w
          JOIN performance_schema.data_locks b ON b.ENGINE_LOCK_ID=w.BLOCKING_ENGINE_LOCK_ID
          WHERE b.OBJECT_SCHEMA=DATABASE() AND b.OBJECT_NAME='users' AND b.LOCK_DATA='92101'`);
        expect(waiting.length).toBeGreaterThan(0);
      }, { timeout: 3000, interval: 20 });
      await guard.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt)
        VALUES (92101,'retention-fixture-renewal','paid',DATE_ADD(NOW(),INTERVAL 31 DAY))`);
      await guard.commit();
      expect(await running).toBe(0);
      expect(await snapshot()).toEqual(before);
    } finally {
      await guard.rollback();
      await running;
      await guard.end();
    }
  });

  // Global maintenance is opt-in and must run alone on a fresh disposable DB.
  describe.skipIf(process.env.BACKEND_RETENTION_WORKER_ACCEPTANCE !== "1")(
    "native maintenance lifecycle and HTTP deletion requests",
    () => {
      it.each(["recent-request", "eligible", "active-club", "club-grace"])(
        "preserves existing retention rules for %s",
        async condition => {
          await conn.query("UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=92101");
          const [neighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
          const app = await createBackendApplication();
          let jobs: WorkerJobs | undefined;
          try {
            jobs = app.get<WorkerJobs>(WorkerJobs);
            await app.listen(0, "127.0.0.1");
            const port = (app.getHttpServer().address() as AddressInfo).port;
            const client = createTRPCProxyClient<AppRouter>({ links: [httpLink({
              url: `http://127.0.0.1:${port}/api/trpc`, transformer: superjson,
              headers: async () => ({ Authorization: `Bearer ${await sdk.createSessionToken("retention-fixture", { sessionVersion: 0 })}` }),
            })] });
            expect(await client.profileExtras.requestAccountDeletion.mutate()).toEqual({ ok: true });
            const requested = await snapshot();
            expect(requested.user[0]).toMatchObject({ email: "retention@example.test", accountDeletionRequestedAt: expect.any(Date) });
            if (condition !== "recent-request")
              await conn.query("UPDATE users SET accountDeletionRequestedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE id=92101");
            if (condition === "active-club" || condition === "club-grace")
              await conn.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES
                (92101,'retention-worker-paid','paid',${condition === "active-club" ? "DATE_ADD(NOW(),INTERVAL 1 DAY)" : "DATE_SUB(NOW(),INTERVAL 29 DAY)"})`);
            const before = await snapshot();
            const operations = app.get<WorkerOperations>(WORKER_OPERATIONS);
            // Only unrelated effects are doubled. The maintenance callback keeps
            // the canonical real SQL implementation; no mail/provider/backup runs.
            vi.spyOn(operations, "publishDueScheduledPosts").mockResolvedValue([]);
            vi.spyOn(operations, "getDb").mockResolvedValue(null);
            vi.spyOn(operations, "processPendingShopDeliveryEmails").mockResolvedValue(undefined);
            vi.spyOn(operations, "runMysqlBackupIfDue").mockResolvedValue(undefined);
            const maintain = operations.runDataRetentionMaintenance;
            let completed = false;
            vi.spyOn(operations, "runDataRetentionMaintenance").mockImplementation(async () => {
              await maintain();
              completed = true;
            });
            jobs.start();
            // Completion barrier, not evidence of scrubbing; persisted rows below
            // must independently distinguish real cleanup from a successful no-op.
            await vi.waitFor(() => expect(completed).toBe(true), { timeout: 3000 });
            if (condition === "eligible") {
              const state = await snapshot();
              expect(state.user[0]).toMatchObject({ name: "Удалённый аккаунт", email: null, passwordHash: null, accountDeletionRequestedAt: null });
              expect(state.profile[0]).toMatchObject({ active: 0, address: "Удалённый аккаунт" });
              expect(state.comments).toEqual([{ text: "Комментарий удалён", photos: null }]);
              expect(state.activity).toEqual([{ likes: 0, saves: 0, pushes: 0, reports: 0 }]);
            } else expect(await snapshot()).toEqual(before);
            const [afterNeighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
            expect(afterNeighbors).toEqual(neighbors);
          } finally {
            await Promise.all((jobs?.stop() ?? []).map(job => job.settled));
            await app.close();
          }
        },
      );
      it("recovers atomic account cleanup on the next maintenance tick after a SQL failure", async () => {
        const before = await snapshot();
        const [neighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
        const app = await createBackendApplication();
        let jobs: WorkerJobs | undefined;
        try {
          jobs = app.get<WorkerJobs>(WorkerJobs);
          await app.listen(0, "127.0.0.1");
          const operations = app.get<WorkerOperations>(WORKER_OPERATIONS);
          vi.spyOn(operations, "publishDueScheduledPosts").mockResolvedValue([]);
          vi.spyOn(operations, "getDb").mockResolvedValue(null);
          vi.spyOn(operations, "processPendingShopDeliveryEmails").mockResolvedValue(undefined);
          vi.spyOn(operations, "runMysqlBackupIfDue").mockResolvedValue(undefined);
          const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
          const maintain = operations.runDataRetentionMaintenance;
          const outcomes: string[] = [];
          vi.spyOn(operations, "runDataRetentionMaintenance").mockImplementation(async () => {
            try {
              await maintain();
              outcomes.push("success");
            } catch (error) {
              outcomes.push("failure");
              throw error;
            }
          });
          await conn.query(`CREATE TRIGGER backend_test_retention_failure BEFORE UPDATE ON users FOR EACH ROW
            BEGIN IF OLD.id=92101 AND NEW.email IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic retention private SQL detail'; END IF; END`);
          // Advance scheduler intervals only; real SQL, clocks and waiting
          // remain untouched. No five-minute wall-clock delay or new retry policy.
          vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
          jobs.start();
          await vi.waitFor(() => expect(outcomes).toEqual(["failure"]), { timeout: 3000 });
          expect(await snapshot()).toEqual(before);
          expect(warnings.mock.calls).toEqual([["[workers] maintenance failed"]]);

          await conn.query("DROP TRIGGER backend_test_retention_failure");
          await vi.advanceTimersByTimeAsync(300_000);
          await vi.waitFor(() => expect(outcomes).toEqual(["failure", "success"]), { timeout: 3000 });
          const scrubbed = await snapshot();
          expect(scrubbed.user[0]).toMatchObject({ email: null, passwordHash: null, accountDeletionRequestedAt: null });
          expect(scrubbed.profile[0]).toMatchObject({ active: 0, address: "Удалённый аккаунт" });
          expect(scrubbed.comments).toEqual([{ text: "Комментарий удалён", photos: null }]);
          expect(scrubbed.matches).toEqual([{ n: 0 }]);
          expect(scrubbed.shown).toEqual([{ n: 0 }]);
          expect(scrubbed.activity).toEqual([{ likes: 0, saves: 0, pushes: 0, reports: 0 }]);

          await vi.advanceTimersByTimeAsync(300_000);
          await vi.waitFor(() => expect(outcomes).toEqual(["failure", "success", "success"]), { timeout: 3000 });
          expect(await snapshot()).toEqual(scrubbed);
          const [afterNeighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
          expect(afterNeighbors).toEqual(neighbors);
          expect(warnings.mock.calls).toEqual([["[workers] maintenance failed"]]);
        } finally {
          await Promise.all((jobs?.stop() ?? []).map(job => job.settled));
          vi.useRealTimers();
          await app.close();
          await conn.query("DROP TRIGGER IF EXISTS backend_test_retention_failure");
        }
      });
    },
  );
});
