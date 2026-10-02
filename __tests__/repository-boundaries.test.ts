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

  it("declares application and package workspace globs", () => {
    const workspace = readFileSync(
      resolve(repositoryRoot, "pnpm-workspace.yaml"),
      "utf8",
    );

    expect(workspace).toContain("apps/*");
    expect(workspace).toContain("packages/*");
  });
});
