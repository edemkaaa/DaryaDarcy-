import { readdir, readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("ships private patterns only through authenticated API bindings, retaining public covers", async () => {
  const frontend = resolve(import.meta.dirname, "../apps/frontend");
  const retired = /18c14e47537e-|958b97c139fc-|ded750bddbeb-|9b32f7b0c8f1-/;
  const publicFiles = await readdir(resolve(frontend, "public/assets"), {
    recursive: true,
  });
  expect(publicFiles.filter((file) => retired.test(file))).toEqual([]);
  for (const file of [
    "image-variants.json",
    "src/shared/ui/static-image-catalog.ts",
  ])
    expect(await readFile(resolve(frontend, file), "utf8")).not.toMatch(
      retired,
    );
  await access(
    resolve(
      frontend,
      "public/assets/responsive/4327bffa91b1-TRkGduziKBAAVhso.w1200.f8dbe5d9ca763eb2.webp",
    ),
  );
  await access(
    resolve(
      frontend,
      "public/assets/responsive/f8a919017d4c-WDRmWxjeWyXWNrto.w900.ea6d6770802512b5.webp",
    ),
  );
});
