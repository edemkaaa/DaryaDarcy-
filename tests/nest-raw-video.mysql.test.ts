import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";

const storage = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("../apps/backend/src/storage", () => ({ storagePut: storage.put }));
describe.skipIf(!testDatabaseUrl)(
  "raw public upload retirement with a real database",
  () => {
    let conn: Connection, app: INestApplication, base: string, bearer: string;
    let ownsFixture = false;
    beforeAll(async () => {
      conn = await openTestDatabase();
      const [occupied] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id=9020",
      );
      if (occupied.length) throw new Error("Raw fixture ID occupied");
      await conn.query(
        "INSERT INTO users(id,openId,role,sessionVersion,lastSignedIn) VALUES(9020,'native-raw-video-admin','admin',0,'2000-01-01')",
      );
      ownsFixture = true;
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-raw-video-fixture-secret-32-characters");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-raw-video-admin", {
        sessionVersion: 0,
      });
    });
    afterAll(async () => {
      await app?.close();
      if (ownsFixture)
        await conn.query(
          "DELETE FROM users WHERE id=9020 AND openId='native-raw-video-admin'",
        );
      await conn?.end();
      vi.unstubAllEnvs();
    });
    it.each(["anonymous", "admin", "invalid"])(
      "%s receives 404 without storage or session activity",
      async (actor) => {
        const [before] = await conn.query<RowDataPacket[]>(
          "SELECT * FROM users WHERE id=9020",
        );
        const response = await fetch(base + "/api/admin/upload-video", {
          method: "POST",
          headers: {
            "content-type": "video/mp4",
            ...(actor === "anonymous"
              ? {}
              : {
                  authorization: `Bearer ${actor === "admin" ? bearer : "invalid"}`,
                }),
          },
          body: "synthetic bytes",
        });
        expect(response.status).toBe(404);
        expect(storage.put).not.toHaveBeenCalled();
        const [after] = await conn.query<RowDataPacket[]>(
          "SELECT * FROM users WHERE id=9020",
        );
        expect(after).toEqual(before);
      },
    );
  },
);
