import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(__dirname, "..");

describe("repository ownership boundaries", () => {
  it("keeps the legacy Vite client inside the apps workspace", () => {
    expect(existsSync(resolve(repositoryRoot, "apps/legacy-web/src/main.tsx"))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "site"))).toBe(false);
  });

  it("keeps deployment assets outside application source", () => {
    expect(
      existsSync(resolve(repositoryRoot, "infrastructure/deploy/ecosystem.config.cjs")),
    ).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "deploy"))).toBe(false);
  });

  it("owns the API service inside the backend application", () => {
    expect(existsSync(resolve(repositoryRoot, "apps/backend/src/_core/index.ts"))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, "server"))).toBe(false);
  });

  it("owns the schema and migrations inside the database package", () => {
    expect(existsSync(resolve(repositoryRoot, "packages/database/src/schema.ts"))).toBe(
      true,
    );
    expect(
      existsSync(resolve(repositoryRoot, "packages/database/drizzle/meta/_journal.json")),
    ).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "drizzle"))).toBe(false);
  });

  it("owns the universal client inside the frontend application", () => {
    expect(existsSync(resolve(repositoryRoot, "apps/frontend/app/_layout.tsx"))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, "app"))).toBe(false);
    expect(existsSync(resolve(repositoryRoot, "components"))).toBe(false);
  });

  it("owns platform-neutral contracts inside the shared package", () => {
    expect(existsSync(resolve(repositoryRoot, "packages/shared/src/const.ts"))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, "shared"))).toBe(false);
  });

  it("declares application and package workspace globs", () => {
    const workspace = readFileSync(
      resolve(repositoryRoot, "pnpm-workspace.yaml"),
      "utf8",
    );

    expect(workspace).toContain("apps/*");
    expect(workspace).toContain("packages/*");
  });
});
