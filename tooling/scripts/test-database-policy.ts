/** Safety guard shared by local tests and isolated CI service readiness. */
export function assertTestDatabase(uri: string): URL {
  const url = new URL(uri);
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  const ciService = process.env.CI === "true" && url.hostname === "backend-mysql" && process.env.BACKEND_TEST_CI_SERVICE === "true";
  if (url.protocol !== "mysql:" || url.pathname !== "/backend_test" || (!local && !ciService)) {
    throw new Error("Tests require disposable backend_test on localhost or the explicitly enabled CI backend-mysql service");
  }
  return url;
}
