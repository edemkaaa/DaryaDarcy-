// Даёт тестам временный loopback-маршрут к разрешённому CI MySQL. Защита production maintenance от произвольных удалённых адресов при этом не ослабляется.
import net from "node:net";
import type { TestProject } from "vitest/node";
import { assertTestDatabase } from "./test-database-policy";

/** Keep destructive SQL fixtures serial and local-only, including GitLab's service. */
export default async function setup(project: TestProject) {
  const uri = process.env.BACKEND_TEST_DATABASE_URL;
  if (!uri) return;

  let upstream: URL;
  try {
    upstream = assertTestDatabase(uri);
  } catch {
    // Neither URL parser errors nor test-runner diagnostics may expose credentials.
    throw new Error(
      "SQL tests require the disposable backend_test database on an allowed test host",
    );
  }
  if (upstream.hostname !== "backend-mysql") return;

  // Production maintenance deliberately rejects remote hosts. Expose only the
  // explicitly allowed CI service over a run-scoped loopback socket instead of
  // weakening that guard. Forward bytes; do not interpret SQL or log the URI.
  const sockets = new Set<net.Socket>();
  const server = net.createServer((client) => {
    const remote = net.createConnection({
      host: upstream.hostname,
      port: Number(upstream.port || 3306),
    });
    for (const socket of [client, remote]) {
      sockets.add(socket);
      socket.on("close", () => {
        sockets.delete(socket);
        client.destroy();
        remote.destroy();
      });
      socket.on("error", () => {
        client.destroy();
        remote.destroy();
      });
    }
    client.pipe(remote).pipe(client);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as net.AddressInfo;
  const local = new URL(upstream);
  local.hostname = "127.0.0.1";
  local.port = String(address.port);
  project.config.env.BACKEND_TEST_DATABASE_URL = local.href;

  // Дожидаемся закрытия своих сокетов, чтобы следующий SQL-прогон не унаследовал активный туннель.
  return async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  };
}
