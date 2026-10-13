import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createServer } from "node:http";
import { readPublicCatalog, readThumbnail } from "../upstream.mjs";

const servers = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
});
async function upstream(handler) {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test("reads the real tRPC catalog shape and retains only publication fields", async () => {
  const url = await upstream((_req, res) =>
    res.end(
      JSON.stringify({
        result: {
          data: {
            json: [
              {
                youtubeId: "sq7pY1H_fYU",
                published: true,
                title: "untrusted title",
                videoUrl: "http://127.0.0.1",
              },
            ],
          },
        },
      }),
    ),
  );
  assert.deepEqual(await readPublicCatalog(url), [
    { youtubeId: "sq7pY1H_fYU", published: true },
  ]);
});
test("never launders an explicit club source into public worker authority", async () => {
  const url = await upstream((_req, res) =>
    res.end(
      JSON.stringify({
        result: {
          data: {
            json: [
              {
                youtubeId: "sq7pY1H_fYU",
                published: true,
                access: "club",
                provider: "youtube",
              },
              {
                youtubeId: "_RZRJgVSD8Y",
                published: true,
                access: "public",
                provider: "youtube",
              },
            ],
          },
        },
      }),
    ),
  );
  assert.deepEqual(await readPublicCatalog(url), [
    { youtubeId: "_RZRJgVSD8Y", published: true },
  ]);
});

test("rejects errors, invalid shapes, invalid IDs and false publication types", async () => {
  for (const payload of [
    "bad json",
    { result: { data: { json: {} } } },
    {
      result: {
        data: { json: [{ youtubeId: "../outside", published: true }] },
      },
    },
    {
      result: {
        data: { json: [{ youtubeId: "sq7pY1H_fYU", published: "true" }] },
      },
    },
  ]) {
    const url = await upstream((_req, res) =>
      res.end(typeof payload === "string" ? payload : JSON.stringify(payload)),
    );
    await assert.rejects(readPublicCatalog(url));
  }
  const unavailable = await upstream((_req, res) => {
    res.writeHead(503);
    res.end();
  });
  await assert.rejects(readPublicCatalog(unavailable));
});

test("does not follow a catalog redirect to a different service", async () => {
  const url = await upstream((_req, res) => {
    res.writeHead(302, { Location: "http://127.0.0.1:1/private" });
    res.end();
  });
  await assert.rejects(readPublicCatalog(url));
});

test("bounds catalog reply bytes even without Content-Length", async () => {
  const url = await upstream((_req, res) => {
    res.write(" ".repeat(2 * 1024 ** 2));
    res.end(" ");
  });
  await assert.rejects(readPublicCatalog(url));
});

test("thumbnail request is derived only from an exact ID and omits credentials", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const thumbnail = await readThumbnail(
    "sq7pY1H_fYU",
    undefined,
    async (url, options) => {
      assert.equal(url, "https://i.ytimg.com/vi/sq7pY1H_fYU/hqdefault.jpg");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers, undefined);
      return new Response(jpeg, { headers: { "content-type": "image/jpeg" } });
    },
  );
  assert.deepEqual(thumbnail, jpeg);
});

test("thumbnail rejects arbitrary IDs, HTML, redirects and oversized files", async () => {
  await assert.rejects(readThumbnail("../private"));
  for (const response of [
    new Response("<html>not an image</html>", {
      headers: { "content-type": "image/jpeg" },
    }),
    new Response("", { status: 302 }),
    new Response(Buffer.alloc(1024 ** 2 + 1), {
      headers: { "content-type": "image/jpeg" },
    }),
  ])
    await assert.rejects(
      readThumbnail("sq7pY1H_fYU", undefined, async () => response),
    );
});
