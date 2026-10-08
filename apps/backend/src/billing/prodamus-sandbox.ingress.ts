import express, { type Express } from "express";

export const prodamusSandboxPath = "/api/prodamus/sandbox/webhook";

/** Preserve bounded HMAC bytes before any generic or Nest body parser. */
export function registerProdamusSandboxBody(http: Express): void {
  http.post(prodamusSandboxPath, (req, res, next) => {
    express.raw({ type: () => true, limit: "64kb" })(req, res, (error) => {
      if (error) {
        res.status(error.status === 413 ? 413 : 400).json({
          error: "Invalid sandbox notification",
        });
        return;
      }
      next();
    });
  });
}
