import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aestheticGuides } from "../apps/backend/src/content/aesthetic-guides";
import { aestheticContentHashes } from "./fixtures/aesthetic-content-hashes";
import { COTTAGECORE_RESULT } from "../apps/frontend/src/domain/quiz/content/cottagecore-result";
import { GOBLINCORE_RESULT } from "../apps/frontend/src/domain/quiz/content/goblincore-result";
import { WITCHCORE_RESULT } from "../apps/frontend/src/domain/quiz/content/witchcore-result";
import { CASTLECORE_RESULT } from "../apps/frontend/src/domain/quiz/content/castlecore-result";
import { FAIRYCORE_RESULT } from "../apps/frontend/src/domain/quiz/content/fairycore-result";
import { DARK_ACADEMIA_RESULT } from "../apps/frontend/src/domain/quiz/content/darkacademia-result";
import { LIGHT_ACADEMIA_RESULT } from "../apps/frontend/src/domain/quiz/content/lightacademia-result";
const free = {
  cottagecore: COTTAGECORE_RESULT,
  goblincore: GOBLINCORE_RESULT,
  witchcore: WITCHCORE_RESULT,
  castlecore: CASTLECORE_RESULT,
  fairycore: FAIRYCORE_RESULT,
  darkAcademia: DARK_ACADEMIA_RESULT,
  lightAcademia: LIGHT_ACADEMIA_RESULT,
};

describe("Library client privacy", () => {
  it.skipIf(process.env.DARYADARCY_LIBRARY_PRODUCTION_BUILD !== "1")(
    "keeps paid guide text out of the newly built production JS/HTML/RSC",
    async () => {
      async function scan(path: string): Promise<string[]> {
        const entries = await readdir(path, { withFileTypes: true });
        return (
          await Promise.all(
            entries.map((entry) =>
              entry.isDirectory()
                ? scan(join(path, entry.name))
                : /\.(?:js|html|rsc|txt)$/.test(entry.name)
                  ? [join(path, entry.name)]
                  : [],
            ),
          )
        ).flat();
      }
      const files = [
        ...(await scan("apps/frontend/.next/static")),
        ...(await scan("apps/frontend/.next/server/app")),
      ];
      expect(files.length).toBeGreaterThan(20);
      const payload = await Promise.all(
        files.map((file) => readFile(file, "utf8")),
      );
      const served = payload
        .join("\n")
        .replace(/\\u([a-f0-9]{4})/gi, (_, hex: string) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
      for (const guide of Object.values(aestheticGuides)) {
        for (const marker of [
          guide.style.intro,
          guide.space.intro,
          guide.blog.intro,
        ])
          expect(served.includes(marker)).toBe(false);
      }
      expect(served.includes("disk.yandex.ru/i/nDfsd5ptLO1xRA")).toBe(false);
    },
  );
  it.each(Object.keys(free) as (keyof typeof free)[])(
    "keeps exactly the original five free fields for %s",
    (key) => {
      expect(
        createHash("sha256").update(JSON.stringify(free[key])).digest("hex"),
      ).toBe(aestheticContentHashes[key].free);
    },
  );
  it("ships no paid guide text or external pattern fallback in either consumer's browser bundle", async () => {
    const bundle = await build({
      entryPoints: [
        "apps/frontend/src/features/library/aesthetics-screen.tsx",
        "apps/frontend/src/features/quiz/quiz-result.tsx",
        "apps/frontend/src/features/library/patterns-screen.tsx",
        "apps/frontend/src/features/library/library-screen.tsx",
      ],
      outdir: "unused",
      write: false,
      bundle: true,
      platform: "browser",
      packages: "external",
      charset: "utf8",
      metafile: true,
      tsconfig: "apps/frontend/tsconfig.json",
      loader: {
        ".scss": "empty",
        ".webp": "empty",
        ".png": "empty",
        ".jpg": "empty",
        ".jpeg": "empty",
        ".svg": "empty",
      },
    });
    const js = bundle.outputFiles.map((file) => file.text).join("\n");
    for (const paid of Object.values(aestheticGuides))
      expect(js.includes(paid.style.intro)).toBe(false);
    // The public static image catalog still inventories old assets; closing those
    // objects is a separate, explicitly excluded migration, not this text move.
    expect(js.includes("disk.yandex.ru/i/nDfsd5ptLO1xRA")).toBe(false);
    expect(
      Object.keys(bundle.metafile.inputs).filter((path) =>
        path.startsWith("apps/backend/"),
      ),
    ).toEqual([]);
  });
});
