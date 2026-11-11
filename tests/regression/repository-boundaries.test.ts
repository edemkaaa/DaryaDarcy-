/** Проверяем владение каталогами монорепозитория и отсутствие прежних дублей в корне. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(__dirname, "../..");

/** Наличие канонического пути проверяется вместе с отсутствием прежней корневой копии. */
describe("repository ownership boundaries", () => {
  /** Сборка образов, запуск сервисов и спецификации имеют отдельные канонические каталоги. */
  it("separates build definitions, runtime configuration and specifications", () => {
    for (const file of [
      "infrastructure/build/compose.build.yaml",
      "infrastructure/build/Dockerfile",
      "infrastructure/build/Dockerfile.backend",
      "infrastructure/build/Dockerfile.video",
      "infrastructure/deploy/teamassist/compose.yaml",
      "docs/specifications/SPEC-private-files.md",
      "docs/development/frontend-work-plan.md",
    ]) expect(existsSync(resolve(repositoryRoot, file))).toBe(true);
    for (const previous of [
      "__tests__",
      "SPEC-private-files.md",
      "apps/frontend/WORK_PLAN.md",
      "infrastructure/deploy/teamassist/compose.build.yaml",
    ]) expect(existsSync(resolve(repositoryRoot, previous))).toBe(false);
  });

  /** Архивный веб-клиент хранится в apps, поэтому старый корневой site не должен возвращаться. */
  it("keeps the legacy Vite client inside the apps workspace", () => {
    expect(existsSync(resolve(repositoryRoot, "apps/legacy-web/src/main.tsx"))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "site"))).toBe(false);
  });

  /** Инфраструктура отделена от прикладных исходников и прежней корневой deploy. */
  it("keeps deployment assets outside application source", () => {
    expect(
      existsSync(resolve(repositoryRoot, "infrastructure/deploy/ecosystem.config.cjs")),
    ).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "deploy"))).toBe(false);
  });

  /** Единственная действующая точка входа сервера находится в приложении backend. */
  it("owns the API service inside the backend application", () => {
    expect(existsSync(resolve(repositoryRoot, "apps/backend/src/_core/index.ts"))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, "server"))).toBe(false);
  });

  /** Схема и журнал миграций принадлежат общему пакету базы, а не корню. */
  it("owns the schema and migrations inside the database package", () => {
    expect(existsSync(resolve(repositoryRoot, "packages/database/src/schema.ts"))).toBe(
      true,
    );
    expect(
      existsSync(resolve(repositoryRoot, "packages/database/drizzle/meta/_journal.json")),
    ).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "drizzle"))).toBe(false);
  });

  /** Текущий Next и сохранённый Expo должны оставаться разными деревьями. */
  it("owns the Next.js client and preserves the Expo source separately", () => {
    expect(existsSync(resolve(repositoryRoot, "apps/frontend/src/app/layout.tsx"))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, "apps/legacy-expo/app/_layout.tsx"))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, "app"))).toBe(false);
    expect(existsSync(resolve(repositoryRoot, "components"))).toBe(false);
  });

  /** Общие контракты находятся в packages/shared без старой корневой копии. */
  it("owns platform-neutral contracts inside the shared package", () => {
    expect(existsSync(resolve(repositoryRoot, "packages/shared/src/const.ts"))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, "shared"))).toBe(false);
  });

  /** Проверяем, что пакетный менеджер видит обе группы workspaces. */
  it("declares application and package workspace globs", () => {
    const workspace = readFileSync(
      resolve(repositoryRoot, "pnpm-workspace.yaml"),
      "utf8",
    );

    expect(workspace).toContain("apps/*");
    expect(workspace).toContain("packages/*");
  });

  /** Автоматизация собирается под tooling; старый корневой scripts не должен возникать снова. */
  it("keeps repository automation under tooling", () => {
    expect(existsSync(resolve(repositoryRoot, "tooling/scripts/load-env.js"))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, "scripts"))).toBe(false);
  });
});
