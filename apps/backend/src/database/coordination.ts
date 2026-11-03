import { createHash } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDb } from "./connection";

export function coordinationMode(): "local" | "mysql" {
  const count = Number(process.env.API_REPLICA_COUNT || "1");
  const mode = process.env.API_COORDINATION_MODE || "local";
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    (mode !== "local" && mode !== "mysql") ||
    (count > 1 && (mode !== "mysql" || process.env.ENABLE_SMS_LOGIN === "true"))
  )
    throw new Error("Invalid API coordination configuration");
  return mode;
}

export const coordinationUnavailable = () =>
  new ServiceUnavailableException(
    "Сервис временно недоступен. Попробуйте позже.",
  );

async function borrowConnection(): Promise<PoolConnection> {
  const db = await getDb();
  if (!db) throw coordinationUnavailable();
  const pool = (db as typeof db & { $client: Pool }).$client;
  // A saturated shared pool must not leave an ingress request queued forever.
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pool.getConnection().then((connection) => {
        if (expired) {
          connection.release();
          throw coordinationUnavailable();
        }
        return connection;
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(coordinationUnavailable());
        }, 3000);
      }),
    ]);
  } catch {
    throw coordinationUnavailable();
  } finally {
    clearTimeout(timer);
  }
}

/** One MySQL server, one checked-out session for the entire named lock.
 * Never return a possibly locked connection to the pool. No local fallback.
 */
export async function withDatabaseLock<T>(
  scope: string,
  waitSeconds: number,
  run: (connection: PoolConnection) => Promise<T>,
): Promise<{ acquired: false } | { acquired: true; value: T }> {
  const connection = await borrowConnection();
  let locked = false;
  let reusable = false;
  let name = "";
  try {
    const [rows] = await connection.query<RowDataPacket[]>({
      sql: "SELECT DATABASE() AS db",
      timeout: 5000,
    });
    if (!rows[0]?.db) throw coordinationUnavailable();
    name = createHash("sha256")
      .update(JSON.stringify(["darcy-coordination-v1", rows[0].db, scope]))
      .digest("hex");
    const [result] = await connection.query<RowDataPacket[]>({
      sql: "SELECT GET_LOCK(?, ?) AS acquired",
      values: [name, waitSeconds],
      timeout: 5000,
    });
    if (Number(result[0]?.acquired) === 0 && result[0]?.acquired !== null) {
      reusable = true;
      return { acquired: false };
    }
    if (Number(result[0]?.acquired) !== 1) throw coordinationUnavailable();
    locked = true;
    return { acquired: true, value: await run(connection) };
  } finally {
    if (locked) {
      try {
        const [released] = await connection.query<RowDataPacket[]>({
          sql: "SELECT RELEASE_LOCK(?) AS released",
          values: [name],
          timeout: 5000,
        });
        reusable = Number(released[0]?.released) === 1;
      } catch {
        reusable = false;
      }
    }
    if (reusable) connection.release();
    else connection.destroy();
  }
}

/** Executable/app startup only; importing modules never connects or schedules. */
export async function verifyApiCoordination(): Promise<void> {
  if (coordinationMode() === "local") return;
  try {
    const probe = await withDatabaseLock(
      "startup-probe",
      1,
      async (connection) => {
        await connection.query({
          sql: "SELECT kind,keyHash,attempts,expiresAt,nextAllowedAt,generation FROM api_rate_limits LIMIT 0",
          timeout: 5000,
        });
      },
    );
    if (!probe.acquired) throw coordinationUnavailable();
  } catch {
    throw coordinationUnavailable();
  }
}

export async function runExclusiveWorker(
  name: string,
  run: () => Promise<void>,
): Promise<void> {
  if (coordinationMode() === "local") {
    await run();
    return;
  }
  await withDatabaseLock(`worker:${name}`, 0, run);
}
