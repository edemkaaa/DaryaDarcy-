import { afterEach, expect, it, vi } from "vitest";
import { attachmentBase64 } from "../apps/frontend/src/shared/media/read-attachment";
import { uriToBase64 } from "../apps/frontend/src/shared/media/image-upload";
import { uploadAdminVideoFromUri } from "../apps/frontend/src/features/admin/media/video-upload";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES,
} from "../apps/frontend/src/shared/browser/file-operations";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import { readResponseBlob } from "../apps/frontend/src/shared/browser/file-operations";
import { createServer } from "node:http";
import { once } from "node:events";

afterEach(() => {
  vi.unstubAllGlobals();
  cancelSessionRequests();
});

// Real Response/ReadableStream; replace only remote transport, never the reader.
it.each([
  ["attachment", MAX_ATTACHMENT_BYTES, attachmentBase64],
  ["photo", MAX_ATTACHMENT_BYTES, uriToBase64],
  [
    "video",
    MAX_VIDEO_BYTES,
    (url: string) => uploadAdminVideoFromUri(url, "clip.mp4"),
  ],
] as const)(
  "stops an oversized %s stream before reading the tail or uploading",
  async (_name, limit, consume) => {
    const chunkBytes = 1024 * 1024;
    let produced = 0,
      cancelled = false,
      requests = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          produced += chunkBytes;
          controller.enqueue(new Uint8Array(chunkBytes));
          if (produced >= limit + 10 * chunkBytes) controller.close();
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    vi.stubGlobal("fetch", async () => {
      requests++;
      return new Response(stream, {
        headers: {
          "Content-Length": "1",
          "Content-Type": "application/octet-stream",
        },
      });
    });
    await expect(
      consume("https://media.example.test/oversized"),
    ).rejects.toThrow(/МБ/);
    expect(cancelled).toBe(true);
    expect(produced).toBeLessThanOrEqual(limit + chunkBytes);
    expect(requests).toBe(1);
  },
);

it.each([undefined, "1", "8"])(
  "preserves bytes and MIME up to the exact limit, headers=%j",
  async (length) => {
    const headers = new Headers({ "Content-Type": "application/pdf" });
    if (length !== undefined) headers.set("Content-Length", length);
    const response = new Response(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), {
      headers,
    });
    const blob = await readResponseBlob(response, 8);
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(blob.type).toBe("application/pdf");
    expect(response.body?.locked).toBe(false);
  },
);

it("rejects an advertised oversize before pulling its first chunk", async () => {
  let pulled = false,
    cancelled = false;
  const response = new Response(
    new ReadableStream(
      {
        pull() {
          pulled = true;
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    ),
    { headers: { "Content-Length": "9" } },
  );
  await expect(readResponseBlob(response, 8)).rejects.toThrow(/МБ/);
  expect(pulled).toBe(false);
  expect(cancelled).toBe(true);
  expect(response.body?.locked).toBe(false);
});

it("cancels a stalled body when the editor operation is aborted", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
  );
  const reading = readResponseBlob(response, 8, controller.signal);
  controller.abort(new Error("editor closed"));
  await expect(reading).rejects.toThrow("editor closed");
  expect(cancelled).toBe(true);
  expect(response.body?.locked).toBe(false);
});

it("does not turn a broken or empty stream into a successful file", async () => {
  const failure = new Error("stream interrupted");
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.error(failure);
      },
    }),
  );
  await expect(readResponseBlob(response, 8)).rejects.toBe(failure);
  expect(response.body?.locked).toBe(false);
  await expect(readResponseBlob(new Response(null), 8)).rejects.toThrow("пуст");
});

it("closes a real chunked loopback HTTP response after reaching the limit", async () => {
  let sent = 0;
  let closed!: () => void;
  const connectionClosed = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "application/pdf");
    const timer = setInterval(() => {
      sent++;
      response.write("test");
      if (sent === 100) {
        clearInterval(timer);
        response.end();
      }
    }, 5);
    response.on("close", () => {
      clearInterval(timer);
      closed();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Loopback fixture required");
    const response = await fetch(`http://127.0.0.1:${address.port}/test-file`);
    expect(response.headers.get("Content-Length")).toBeNull();
    await expect(readResponseBlob(response, 8)).rejects.toThrow(/МБ/);
    await connectionClosed;
    expect(sent).toBeLessThan(100);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
