/** Переключает HTTP-лимиты между локальным и общим MySQL-режимом без обхода отказавшего хранилища. */
import { checkRateLimit } from "./rate-limit";
import { coordinationMode } from "../database/coordination";
import {
  checkSharedRateLimit,
  type LimitDecision,
} from "../database/shared-limits";

/** Все HTTP-квоты ждут выбранное хранилище; сбой общей БД не разрешает обойти лимит. */
export async function checkRequestRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<LimitDecision> {
  return coordinationMode() === "mysql"
    ? checkSharedRateLimit(key, max, windowMs)
    : checkRateLimit(key, max, windowMs);
}
