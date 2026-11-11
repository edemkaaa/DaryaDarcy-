/** Проверяем копирование симлинков установленным @humanfs/node в собственном временном дереве. */
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

/** До рекурсивной очистки проверяет владельца, режим 0700 и тип корня; ссылки удаляет без разыменования. */
async function removeOwnedFixture(root: string) {
  const rootStat = await fs.lstat(root);
  if (
    !rootStat.isDirectory() ||
    rootStat.isSymbolicLink() ||
    rootStat.uid !== process.getuid?.() ||
    (rootStat.mode & 0o777) !== 0o700
  ) {
    throw new Error("Refusing cleanup of an unowned fixture");
  }
  /** Обходит только реальные дочерние каталоги; симлинк удаляется как запись, его цель не читается. */
  async function removeDirectory(directory: string) {
    for (const name of await fs.readdir(directory)) {
      const child = join(directory, name);
      const stat = await fs.lstat(child);
      if (stat.isDirectory() && !stat.isSymbolicLink())
        await removeDirectory(child);
      else await fs.unlink(child); // Does not follow copied links.
    }
    await fs.rmdir(directory);
  }
  await removeDirectory(root);
}

/** copy/copyAll должны сохранить саму ссылку и обычный файл. Проверка не объявляет ссылку безопасной песочницей и не открывает её цель. */
it.each(["copy", "copyAll"] as const)(
  "%s preserves symlinks instead of materializing out-of-tree contents",
  async (operation) => {
    const root = await fs.mkdtemp(join(tmpdir(), "dd-humanfs-proof-"));
    try {
      const source = join(root, "source");
      const destination = join(root, "destination");
      const marker = join(root, "outside.txt");
      await fs.mkdir(source);
      await fs.writeFile(marker, "SYNTHETIC-OUTSIDE-COPY-MARKER");
      await fs.symlink(marker, join(source, "link.txt"));
      await fs.writeFile(join(source, "ordinary.txt"), "ordinary fixture");
      const { NodeHfs } = await import("@humanfs/node");
      const hfs = new NodeHfs();
      if (operation === "copy") {
        await fs.mkdir(destination);
        await hfs.copy(join(source, "link.txt"), join(destination, "link.txt"));
        await hfs.copy(
          join(source, "ordinary.txt"),
          join(destination, "ordinary.txt"),
        );
      } else {
        await hfs.copyAll(source, destination);
      }
      const copiedLink = join(destination, "link.txt");
      expect((await fs.lstat(copiedLink)).isSymbolicLink()).toBe(true);
      expect(await fs.readlink(copiedLink)).toBe(marker);
      expect(await fs.readFile(join(destination, "ordinary.txt"), "utf8")).toBe(
        "ordinary fixture",
      );
      // The retained link can still resolve outside; this is NOT a sandbox.
      // Never dereference it or inspect any user file during this proof.
    } finally {
      await removeOwnedFixture(root);
    }
  },
);
