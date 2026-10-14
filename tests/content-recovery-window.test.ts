import { afterEach, describe, expect, it, vi } from "vitest";
import { assertContentRecoveryWindow } from "../apps/backend/src/content/recovery-window";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("content recovery window", () => {
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
  it("an invalid recording timestamp fails closed when enabled", () => {
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    expect(() => assertContentRecoveryWindow(new Date(NaN))).toThrow(
      expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }),
    );
  });
  it("an invalid server clock never approves replay", () => {
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    vi.spyOn(Date, "now").mockReturnValue(NaN);
    expect(() => assertContentRecoveryWindow(new Date())).toThrow(
      expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }),
    );
  });
  it("disabled mode retains legacy recovery for old records", () => {
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
    expect(() => assertContentRecoveryWindow(new Date(0))).not.toThrow();
  });
});
