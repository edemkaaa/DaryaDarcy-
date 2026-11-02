import { expect, it, vi } from "vitest";
import type { ScryptOptions } from "node:crypto";

const control = vi.hoisted(() => ({ failure: new Error("synthetic crypto failure") }));
vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:crypto")>();
  return {
    ...original,
    scrypt: (_password: string, _salt: Buffer, _length: number, _options: ScryptOptions,
      callback: (error: Error | null, result: Buffer) => void) => {
      queueMicrotask(() => callback(control.failure, Buffer.alloc(0)));
    },
  };
});
import { verifyPassword } from "../apps/backend/src/_core/password";

it.each([
  new Error("synthetic crypto failure"),
  Object.assign(new Error("synthetic allocation failure"), { code: "ENOMEM" }),
  new RangeError("synthetic range failure without a recognized code"),
])("propagates unexpected crypto failure %s rather than denying credentials", async (failure) => {
  control.failure = failure;
  const stored = `scrypt$16384$8$1$${Buffer.alloc(16, 7).toString("base64")}$${Buffer.alloc(32, 9).toString("base64")}`;
  await expect(verifyPassword("synthetic-password", stored)).rejects.toBe(failure);
});
