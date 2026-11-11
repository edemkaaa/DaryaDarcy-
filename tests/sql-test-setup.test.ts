/** CI SQL setup проверяется настоящими локальными TCP-байтами, подменяя только адрес разрешённого service-host. */
import { afterEach, expect, it, vi } from "vitest";
import net from "node:net";
import { once } from "node:events";
import type { TestProject } from "vitest/node";
import setup from "../tooling/scripts/sql-test-setup";

/** Снимаем net spies и CI/env после сценария. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
/** Минимальный TestProject принимает вычисленный URL для изолированных workers. */
function project() {
  return { config: { env: {} } } as TestProject;
}

/** Локальный/пустой URL не требует CI-туннеля или нового listener. */
it("leaves local connection settings untouched and creates no listener", async () => {
  const createServer = vi.spyOn(net, "createServer");
  const target = project();
  for (const uri of ["", "mysql://fixture:test@localhost:3307/backend_test"]) {
    vi.stubEnv("BACKEND_TEST_DATABASE_URL", uri);
    expect(await setup(target)).toBeUndefined();
  }
  expect(createServer).not.toHaveBeenCalled();
  expect(target.config.env).toEqual({});
});

/** Malformed/external/non-test/options URL отвергаются до сокетов и без утечки пароля. */
it.each([
  "not a URL containing a password",
  "mysql://fixture:test@production.example/backend_test",
  "mysql://fixture:test@127.0.0.1/working_database",
  "mysql://fixture:test@127.0.0.1/backend_test?socketPath=/tmp/mysql.sock",
  "mysql://fixture:test@backend-mysql/backend_test#options",
])("rejects an unsafe URI before creating any connection: %s", async (uri) => {
  vi.stubEnv("CI", "true");
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  vi.stubEnv("BACKEND_TEST_DATABASE_URL", uri);
  const createServer = vi.spyOn(net, "createServer");
  const connect = vi.spyOn(net, "createConnection");
  await expect(setup(project())).rejects.toThrow(
    "SQL tests require the disposable backend_test database",
  );
  expect(createServer).not.toHaveBeenCalled();
  expect(connect).not.toHaveBeenCalled();
});

/** Имя CI service требует одновременно CI и явное разрешение. */
it.each([
  ["false", "true"],
  ["true", "false"],
])("requires both CI permissions (%s, %s)", async (ci, permission) => {
  vi.stubEnv("CI", ci);
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", permission);
  vi.stubEnv(
    "BACKEND_TEST_DATABASE_URL",
    "mysql://fixture:test@backend-mysql/backend_test",
  );
  await expect(setup(project())).rejects.toThrow();
});

/** Echo fixture подтверждает прозрачность bytes/encoded password; cleanup закрывает активный socket и дальнейший доступ к listener. */
it("forwards the allowed CI service over loopback and closes listeners and active sockets", async () => {
  const originalConnect = net.createConnection.bind(net);
  const echo = net.createServer((socket) => socket.pipe(socket));
  echo.listen(0, "127.0.0.1");
  await once(echo, "listening");
  const echoPort = (echo.address() as net.AddressInfo).port;
  const connections: { host: string; port: number }[] = [];
  // Replace only service DNS/transport. Exercise real loopback sockets and bytes.
  vi.spyOn(net, "createConnection").mockImplementation(((
    options: net.NetConnectOpts,
  ) => {
    const address = options as net.TcpNetConnectOpts;
    connections.push({ host: address.host!, port: address.port });
    return originalConnect({ host: "127.0.0.1", port: echoPort });
  }) as typeof net.createConnection);
  vi.stubEnv("CI", "true");
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  vi.stubEnv(
    "BACKEND_TEST_DATABASE_URL",
    "mysql://fixture:p%40ss@backend-mysql:3307/backend_test",
  );
  const target = project();
  let cleanup: Awaited<ReturnType<typeof setup>>;
  let client: net.Socket | undefined;
  try {
    cleanup = await setup(target);
    const configuredUri = target.config.env.BACKEND_TEST_DATABASE_URL;
    expect(configuredUri).toBeDefined();
    const uri = new URL(configuredUri!);
    expect(uri.hostname).toBe("127.0.0.1");
    expect(uri.pathname).toBe("/backend_test");
    expect(uri.password).toBe("p%40ss");
    client = originalConnect({ host: uri.hostname, port: Number(uri.port) });
    await once(client, "connect");
    const bytes = Buffer.from([0, 1, 255, 128, 0, 10]);
    const reply = once(client, "data");
    client.write(bytes);
    expect((await reply)[0]).toEqual(bytes);
    expect(connections).toEqual([{ host: "backend-mysql", port: 3307 }]);
    const closed = once(client, "close");
    await cleanup!();
    cleanup = undefined;
    await closed;
    const rejected = originalConnect({
      host: uri.hostname,
      port: Number(uri.port),
    });
    const [error] = await once(rejected, "error");
    expect(error.code).toBe("ECONNREFUSED");
    rejected.destroy();
  } finally {
    client?.destroy();
    await cleanup?.();
    await new Promise<void>((resolve) => echo.close(() => resolve()));
  }
});
