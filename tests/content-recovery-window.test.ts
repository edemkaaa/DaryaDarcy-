/** Проверяем точную временную границу повторов операций контента с подставленными часами. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertContentRecoveryWindow } from "../apps/backend/src/content/recovery-window";

/** Восстанавливаем Date.now и флаги retention. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Матрица отделяет допустимую запись за границей срока от точного момента истечения. */
describe("content recovery window", () => {
  /** Одна миллисекунда вокруг границы должна давать правильный допуск или CONFLICT. */
  it.each([
    ["2026-09-14T00:00:00.001Z", undefined],
    ["2026-09-14T00:00:00.000Z", "CONFLICT"],
    ["2026-09-13T23:59:59.999Z", "CONFLICT"],
  ])(
    "recorded at %s is refused exactly at its recovery boundary",
    (recordedAt, code) => {
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      vi.spyOn(Date, "now").mockReturnValue(
        Date.parse("2026-10-14T00:00:00.000Z"),
      );
      const call = () => assertContentRecoveryWindow(new Date(recordedAt));
      if (code) expect(call).toThrow(expect.objectContaining({ code }));
      else expect(call).not.toThrow();
    },
  );
  /** Неверная дата журнала не разрешает повтор и даёт инфраструктурный отказ. */
  it("an invalid recording timestamp fails closed when enabled", () => {
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    expect(() => assertContentRecoveryWindow(new Date(NaN))).toThrow(
      expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }),
    );
  });
  /** Неопределённое время сервера нельзя использовать как доказательство свежести операции. */
  it("an invalid server clock never approves replay", () => {
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    vi.spyOn(Date, "now").mockReturnValue(NaN);
    expect(() => assertContentRecoveryWindow(new Date())).toThrow(
      expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }),
    );
  });
  /** Явно отключённый retention сохраняет согласованное старое восстановление. */
  it("disabled mode retains legacy recovery for old records", () => {
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
    expect(() => assertContentRecoveryWindow(new Date(0))).not.toThrow();
  });
});
