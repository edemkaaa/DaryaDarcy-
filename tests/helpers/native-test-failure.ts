/** Sources belong to our local fixtures, never to a child process or payload. */
export function nativeTestNames(
  sources: readonly string[],
): ReadonlySet<string> {
  // Доверенные имена берутся только из собственных исходников тестов, а не из потенциально чувствительного вывода процесса.

  return new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/\btest\(\s*"([^"\r\n]{1,240})"/g)].map(
        (match) => match[1],
      ),
    ),
  );
}

/** Child output may contain signed URLs or credentials. Never attach its cause. */
export function nativeTestFailure(
  failure: unknown,
  trustedNames: ReadonlySet<string>,
): Error {
  // Возвращает лишь тип сбоя и ограниченный список доверенных имён; stdout, cause и параметры с доступами в ошибку не попадают.

  const captured =
    typeof failure === "object" && failure !== null ? failure : {};
  const kind =
    "killed" in captured && captured.killed === true
      ? "deadline"
      : "code" in captured &&
          captured.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
        ? "output limit"
        : "failed";
  const names = new Set<string>();
  if ("stdout" in captured && typeof captured.stdout === "string") {
    for (const line of captured.stdout.slice(0, 1024 * 1024).split("\n")) {
      const name = /^\s*not ok \d+ - ([^\r\n]{1,240})$/.exec(line)?.[1];
      if (name && trustedNames.has(name)) names.add(name);
      if (names.size === 8) break;
    }
  }
  return new Error(
    `Native test suite ${kind}${names.size ? `: ${[...names].join("; ")}` : ""}`,
  );
}
