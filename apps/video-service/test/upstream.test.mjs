// Проверяет ограничение и разбор ответов внешних источников без доверия произвольному JSON или клиентскому URL.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createServer } from "node:http";
import { readPublicCatalog, readPublicYoutubeState, readThumbnail } from "../upstream.mjs";

const servers = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
});
async function upstream(handler) {
  // Создаёт локальный источник ответов tRPC и записывает сервер для последующей очистки.

  const server = createServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

// Сценарий: Компактный контракт строго связывает publication с запрошенным ID.
test("reads only strict compact publication authority for the requested identifier", async () => {
  let published = true;
  const url = await upstream((req, res) => {
    const input = JSON.parse(new URL(req.url, "http://fixture.invalid").searchParams.get("input"));
    assert.deepEqual(input, { json: { youtubeId: "sq7pY1H_fYU" } });
    res.end(JSON.stringify({ result: { data: { json: { published } } } }));
  });
  assert.equal(await readPublicYoutubeState(url, "sq7pY1H_fYU"), true);
  published = false;
  assert.equal(await readPublicYoutubeState(url, "sq7pY1H_fYU"), false);
  await assert.rejects(readPublicYoutubeState(url, "../invalid"), /invalid video id/);
});
// Сценарий: Повреждённый, слишком большой и redirected compact-ответ получает отказ.
test("compact authority fails closed on malformed, oversized and redirected responses", async () => {
  for (const state of [[], null, { published: "true" }, { published: true, access: "club" }]) {
    const url = await upstream((_req, res) => res.end(JSON.stringify({ result: { data: { json: state } } })));
    await assert.rejects(readPublicYoutubeState(url, "sq7pY1H_fYU"), /invalid publication state/);
  }
  const oversized = await upstream((_req, res) => res.end(" ".repeat(4097)));
  await assert.rejects(readPublicYoutubeState(oversized, "sq7pY1H_fYU"), /upstream reply too large/);
  const redirect = await upstream((_req, res) => { res.writeHead(302, { location: "http://127.0.0.1:1/private" }); res.end(); });
  await assert.rejects(readPublicYoutubeState(redirect, "sq7pY1H_fYU"));
});

// Сценарий: Из tRPC-каталога сохраняются только необходимые поля публикации.
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
// Сценарий: Явно клубный источник не нормализуется в публичный.
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

// Сценарий: Ошибки, неверные ID и неboolean publication отклоняются.
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

// Сценарий: Redirect каталога не следует к другому сервису.
test("does not follow a catalog redirect to a different service", async () => {
  const url = await upstream((_req, res) => {
    res.writeHead(302, { Location: "http://127.0.0.1:1/private" });
    res.end();
  });
  await assert.rejects(readPublicCatalog(url));
});

// Сценарий: Фактические байты ответа ограничены даже без Content-Length.
test("bounds catalog reply bytes even without Content-Length", async () => {
  const url = await upstream((_req, res) => {
    res.write(" ".repeat(2 * 1024 ** 2));
    res.end(" ");
  });
  await assert.rejects(readPublicCatalog(url));
});

// Сценарий: URL обложки строится из строгого ID без credentials.
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

// Сценарий: HTML, redirects, произвольные ID и большие файлы не признаются обложкой.
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
