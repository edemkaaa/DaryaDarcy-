import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

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
