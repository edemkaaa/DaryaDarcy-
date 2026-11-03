import { checkRateLimit } from "./rate-limit";
import { coordinationMode } from "../database/coordination";
import {
  checkSharedRateLimit,
  type LimitDecision,
} from "../database/shared-limits";

/** All HTTP admissions await the same mode; never bypass a failed shared store. */
export async function checkRequestRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<LimitDecision> {
  return coordinationMode() === "mysql"
    ? checkSharedRateLimit(key, max, windowMs)
    : checkRateLimit(key, max, windowMs);
}
