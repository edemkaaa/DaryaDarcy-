/** Проверяем минимальное синтетическое окружение API-кандидата без ослабления production-проверки origin. */
import { afterEach, expect, it, vi } from "vitest";
import express from "express";
import { candidateApiEnvironment } from "../tooling/scripts/candidate-api-environment";
import { registerHttpSecurity } from "../apps/backend/src/_core/http-security";

/** После проверки восстанавливаем переменные процесса. */
afterEach(() => vi.unstubAllEnvs());
/** Проверяем состав разрешённых переменных и сохранение NODE_ENV=production; это не подключение к настоящей БД-кандидату. */
it("composes the candidate under production origin validation without relaxing security", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
  const settings = candidateApiEnvironment("synthetic-candidate-uri");
  for (const [key, value] of Object.entries(settings)) vi.stubEnv(key, value);
  expect(() => registerHttpSecurity(express())).not.toThrow();
  expect(process.env.NODE_ENV).toBe("production");
  expect(settings.DATABASE_URL).toBe("synthetic-candidate-uri");
  expect(Object.keys(settings).sort()).toEqual([
    "DATABASE_URL",
    "JWT_SECRET",
    "PUBLIC_APP_URL",
  ]);
});
