import { lstat, mkdtemp, realpath, rm } from "node:fs/promises";
import { join } from "node:path";

function busy() {
  return Object.assign(new Error("video preparation busy"), { code: "BUSY" });
}

/** Owns only directories created inside a private, non-shared cache mount. */
export async function createVideoCache({
  root,
  prepare,
  maxBytes = 128 * 1024 ** 2,
  maxFileBytes = 112 * 1024 ** 2,
  ttlMs = 30 * 60 * 1000,
  prepareTimeoutMs = 150_000,
  now = Date.now,
}) {
  const rootInfo = await lstat(root);
  if (
    !rootInfo.isDirectory() ||
    rootInfo.isSymbolicLink() ||
    rootInfo.uid !== process.getuid() ||
    rootInfo.mode & 0o022
  )
    throw new Error("cache must be privately owned");
  root = await realpath(root);
  const entries = new Map();
  let job;
  let closed = false;

  async function remove(entry) {
    if (entries.get(entry.id) !== entry) return;
    entries.delete(entry.id);
    await rm(entry.directory, { recursive: true, force: true });
  }

  async function prepareEntry(id, signal) {
    let directory;
    try {
      const ordered = [...entries.values()].sort((a, b) => a.used - b.used);
      let bytes = ordered.reduce((total, entry) => total + entry.size, 0);
      for (const entry of ordered) {
        if (
          !entry.readers &&
          (entry.expires <= now() || bytes + maxFileBytes > maxBytes)
        ) {
          await remove(entry);
          bytes -= entry.size;
        }
      }
      if (bytes + maxFileBytes > maxBytes) throw busy();
      directory = await mkdtemp(join(root, `${id}-`));
      await prepare(id, directory, signal);
      signal.throwIfAborted();
      const path = join(directory, "video.mp4");
      const info = await lstat(path);
      if (!info.isFile() || info.size <= 0 || info.size > maxFileBytes)
        throw new Error("invalid prepared video");
      const entry = {
        id,
        directory,
        path,
        size: info.size,
        readers: 0,
        used: now(),
        expires: now() + ttlMs,
      };
      entries.set(id, entry);
      return entry;
    } catch (error) {
      if (directory) await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async function acquire(id, signal) {
    if (!/^[\w-]{11}$/.test(id)) throw new Error("invalid video id");
    signal?.throwIfAborted();
    if (closed) throw busy();
    let entry = entries.get(id);
    if (entry?.expires <= now()) {
      if (entry.readers) throw busy();
      await remove(entry);
      entry = undefined;
    }
    if (!entry) {
      if (job && job.id !== id) throw busy();
      if (!job) {
        const current = { id, controller: new AbortController(), users: 0 };
        job = current;
        const timer = setTimeout(
          () =>
            current.controller.abort(
              new DOMException("preparation deadline", "TimeoutError"),
            ),
          prepareTimeoutMs,
        );
        current.promise = prepareEntry(id, current.controller.signal).finally(
          () => {
            clearTimeout(timer);
            if (job === current) job = undefined;
          },
        );
      }
      const current = job;
      current.users++;
      let onAbort;
      try {
        entry = await Promise.race([
          current.promise,
          new Promise((_resolve, reject) => {
            onAbort = () => reject(signal.reason);
            signal?.addEventListener("abort", onAbort, { once: true });
            if (signal?.aborted) onAbort();
          }),
        ]);
      } finally {
        if (onAbort) signal?.removeEventListener("abort", onAbort);
        current.users--;
        if (!current.users && job === current) current.controller.abort();
      }
    }
    signal?.throwIfAborted();
    entry.used = now();
    entry.readers++;
    let released = false;
    return {
      path: entry.path,
      release() {
        if (!released) {
          released = true;
          entry.readers--;
        }
      },
    };
  }

  async function close() {
    closed = true;
    clearInterval(sweeper);
    job?.controller.abort();
    await job?.promise.catch(() => {});
  }
  const sweeper = setInterval(
    () => {
      for (const entry of entries.values()) {
        if (!entry.readers && entry.expires <= now())
          remove(entry).catch(() =>
            console.error("[video] cache cleanup failed"),
          );
      }
    },
    Math.min(ttlMs, 30_000),
  );
  sweeper.unref();
  return { acquire, close };
}
