/** Проверяем QR CLI в собственном временном каталоге без записи в рабочий корень. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = path.resolve(
  import.meta.dirname,
  "../../tooling/scripts/generate_qr.mjs",
);
let sandbox: string;
/** Каждый запуск получает отдельный временный cwd, чтобы результат не зависел от прежних артефактов. */
beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "daryadarcy-qr-test-"));
});
/** Удаляем только каталог, созданный текущим тестом. */
afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/** Запускаем настоящий CLI и проверяем файл результата, не ограничиваясь сообщением stdout. */
describe("local QR tool", () => {
  /** Проверяем сигнатуру PNG, расположение tmp и отсутствие лишнего файла в корне. */
  it("writes a real PNG to the generated-artifacts folder, not the project root", () => {
    const output = execFileSync(
      process.execPath,
      [script, "exps://example.invalid/local-preview"],
      {
        cwd: sandbox,
        encoding: "utf8",
      },
    );
    const png = fs.readFileSync(path.join(sandbox, "tmp/expo-qr-code.png"));
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(fs.existsSync(path.join(sandbox, "expo-qr-code.png"))).toBe(false);
    expect(output).toContain("tmp/expo-qr-code.png");
  });

  /** Ошибка аргументов должна завершить процесс до создания файлов. */
  it("fails without a URL and creates no artifacts", () => {
    expect(() =>
      execFileSync(process.execPath, [script], { cwd: sandbox, stdio: "pipe" }),
    ).toThrow();
    expect(fs.readdirSync(sandbox)).toEqual([]);
  });
});
