// Ограничивает SQL-тесты одноразовой backend_test на разрешённых адресах. Параметры URI не должны обходить ограничение через Unix socket.
/** Safety guard shared by local tests and isolated CI service readiness. */
export function assertTestDatabase(uri: string): URL {
  // Разрешает backend_test только на loopback либо явном CI-сервисе без URI-параметров, способных перенаправить драйвер.

  const url = new URL(uri);
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  const ciService = process.env.CI === "true" && url.hostname === "backend-mysql" && process.env.BACKEND_TEST_CI_SERVICE === "true";
  // URI query options can select a Unix socket even when the hostname is local.
  // Driver settings belong in the trusted connection object, never in this URL.
  if (url.protocol !== "mysql:" || url.pathname !== "/backend_test" || url.search !== "" || url.hash !== "" || (!local && !ciService)) {
    throw new Error("Tests require disposable backend_test on localhost or the explicitly enabled CI backend-mysql service, without URL query or fragment");
  }
  return url;
}
