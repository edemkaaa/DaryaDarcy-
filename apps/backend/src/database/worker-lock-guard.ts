/** Проверяет непрерывное владение worker-lock и останавливает процесс, потерявший право на внешние эффекты. */
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

/** Контролирует только уже захваченную блокировку фоновой задачи. */
export async function runWithWorkerLock(
  connection: PoolConnection,
  lockName: string,
  run: () => Promise<void>,
): Promise<void> {
  let active = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending: Promise<void> | undefined;

  const lost = () => {
    if (!active) return;
    // Отклонение Promise не отменяет callback: он может продолжать отправлять
    // письма или писать через другие соединения. Не ждём graceful drain после
    // потери права на работу; supervisor должен перезапустить этот API.
    console.error("[WorkerLock] Ownership lost; terminating API process");
    process.exit(1);
  };
  const verify = async () => {
    try {
      const [rows] = await connection.query<RowDataPacket[]>({
        sql: "SELECT IS_USED_LOCK(?) = CONNECTION_ID() AS owned",
        values: [lockName],
        timeout: 3000,
      });
      if (Number(rows[0]?.owned) !== 1) lost();
    } catch {
      // Неизвестное владение тоже запрещает дальнейшую работу.
      lost();
    }
  };

  connection.on("error", lost);
  connection.on("end", lost);
  try {
    // Закрываем промежуток между GET_LOCK и подпиской на события соединения.
    await verify();
    timer = setInterval(() => {
      if (pending) return;
      pending = verify().finally(() => {
        pending = undefined;
      });
    }, 1000);
    timer.unref();
    await run();
  } finally {
    active = false;
    clearInterval(timer);
    // Проверка не должна дожить до возврата соединения в пул и проверить
    // уже чужую работу. Сбой после завершения callback не требует остановки.
    await pending;
    connection.off("error", lost);
    connection.off("end", lost);
  }
}
