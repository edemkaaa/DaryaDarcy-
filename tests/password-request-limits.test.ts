/** Валидация восстановления пароля не должна расходовать общую ёмкость чужих rate-limit buckets. */
import { beforeEach, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { PasswordService } from "../apps/backend/src/identity/password.service";

/** Новый импорт сбрасывает process-local счётчики для независимых сценариев. */
beforeEach(() => vi.resetModules());

/** Вызываем настоящий контроллер с фиктивным response и локальным service spy, сохраняя только HTTP-статус. */
async function requestPassword(email: string) {
  const { PasswordController } =
    await import("../apps/backend/src/identity/password.controller");
  const request = {
    body: { email },
    ip: "198.51.100.10",
    headers: {},
  } as Request;
  let status = 200;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  const passwords = { request: vi.fn() } as unknown as PasswordService;
  await new PasswordController(passwords).request(request, response);
  return status;
}

/** Массовые некорректные email не должны вытеснить лимит входа другого IP. */
it("does not let rejected password requests exhaust login capacity", async () => {
  const { checkRateLimit } =
    await import("../apps/backend/src/_core/rate-limit");
  for (let index = 0; index < 10005; index++) {
    await requestPassword(`invalid-${index}`);
  }
  expect(checkRateLimit("auth:login:198.51.100.20", 20, 900000)).toEqual({
    ok: true,
  });
});

/** Даже почти заполненный лимитер не получает новый email-bucket от невалидного адреса; ответ остаётся нейтральным 202. */
it("does not allocate a recipient bucket for an invalid email", async () => {
  const { checkRateLimit } =
    await import("../apps/backend/src/_core/rate-limit");
  for (let index = 0; index < 9998; index++) {
    checkRateLimit(`other:${index}`, 1, 3600000);
  }
  expect(await requestPassword("invalid-address")).toBe(202);
  expect(checkRateLimit("auth:login:198.51.100.20", 20, 900000)).toEqual({
    ok: true,
  });
});
