import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const publicDirectories = ["public", "apps/frontend/public"];
const originalHtml = '<html><head></head><body><div id="root"></div></body></html>';
let fixture: string;

function packageFixture() {
  return spawnSync(process.execPath, [join(fixture, "tooling/scripts/compress-web-dist.mjs")], {
    encoding: "utf8",
    cwd: fixture,
  });
}

function publicSource(name: string) {
  const directory = publicDirectories.find((candidate) => existsSync(join(repository, candidate, name)));
  if (!directory) throw new Error(`Repository public resource missing: ${name}`);
  return readFileSync(join(repository, directory, name));
}

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), "daryadarcy-web-assets-test-"));
  mkdirSync(join(fixture, "tooling/scripts"), { recursive: true });
  copyFileSync(
    join(repository, "tooling/scripts/compress-web-dist.mjs"),
    join(fixture, "tooling/scripts/compress-web-dist.mjs"),
  );
  // Mirror the repository layout, so a misplaced public directory is observable.
  for (const directory of publicDirectories) {
    if (existsSync(join(repository, directory))) {
      cpSync(join(repository, directory), join(fixture, directory), { recursive: true });
    }
  }
  mkdirSync(join(fixture, "apps/frontend/assets/images"), { recursive: true });
  copyFileSync(
    join(repository, "apps/frontend/assets/images/icon.png"),
    join(fixture, "apps/frontend/assets/images/icon.png"),
  );
  mkdirSync(join(fixture, "web-dist"));
  writeFileSync(join(fixture, "web-dist/index.html"), originalHtml);
});

afterEach(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe("web public resource packaging", () => {
  it("ships manifest, unchanged privacy page and mobile icon alongside HTML references", () => {
    const result = packageFixture();
    expect(result.status, result.stderr).toBe(0);
    for (const name of ["manifest.webmanifest", "privacy.html"]) {
      const output = join(fixture, "web-dist", name);
      expect(existsSync(output), `Missing packaged ${name}`).toBe(true);
      expect(readFileSync(output)).toEqual(publicSource(name));
    }
    const manifest = JSON.parse(readFileSync(join(fixture, "web-dist/manifest.webmanifest"), "utf8"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons[0].src).toBe("/apple-touch-icon.png");
    expect(readFileSync(join(fixture, "web-dist/apple-touch-icon.png"))).toEqual(
      readFileSync(join(repository, "apps/frontend/assets/images/icon.png")),
    );
    expect(readFileSync(join(fixture, "web-dist/index.html"), "utf8")).toContain('/manifest.webmanifest');
  });

  it.each(["privacy.html", "manifest.webmanifest"])(
    "fails before modifying build output if required %s is absent",
    (name) => {
      for (const directory of publicDirectories) {
        rmSync(join(fixture, directory, name), { force: true });
      }
      const result = packageFixture();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(name);
      expect(readFileSync(join(fixture, "web-dist/index.html"), "utf8")).toBe(originalHtml);
      expect(existsSync(join(fixture, "web-dist/apple-touch-icon.png"))).toBe(false);
      expect(existsSync(join(fixture, "web-dist/privacy.html"))).toBe(false);
      expect(existsSync(join(fixture, "web-dist/manifest.webmanifest"))).toBe(false);
    },
  );
});
