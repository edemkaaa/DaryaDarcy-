import { build } from "esbuild";
import { createServer, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";

/** Real pending HTTP bodies, with browser cache enabled and no page.route. */
export async function startPictureHttpFixture() {
  // Собирает настоящий Picture и отдаёт незавершённое HTTP-тело при включённом браузерном кэше; route interception не подменяет поведение загрузчика.

  const requests: string[] = [];
  const pending = new Set<ServerResponse>();
  let aborted = 0;
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      // Строка приложения использует настоящий Picture с контролируемым источником; это fixture input, её байты не меняются пояснениями.
      contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {Picture} from './apps/frontend/src/shared/media/image';
        const mode=new URLSearchParams(location.search).get('mode')||'direct';
        const uri=mode==='preview'
          ?'https://s3.twcstorage.ru/daryadarcy-s3/feed/pending-fixture.jpg'
          :'/photo.svg?signature=keep%2Fexact';
        createRoot(document.getElementById('root')).render(
          <Picture source={uri} loading="eager" showRetryButton
            aria-label="Fixture photo" style={{width:320,height:200}}
            srcSet={mode==='srcset'?'/photo.svg?signature=keep%2Fexact 1x, /photo-2.svg?signature=keep%2Fexact 2x':undefined}/>
        );
        setInterval(async()=>{
          document.getElementById('state').textContent=JSON.stringify(await(await fetch('/state')).json());
        },250);
      `,
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    loader: { ".scss": "empty" },
    tsconfig: resolve("apps/frontend/tsconfig.json"),
    plugins: [
      {
        name: "fixture-catalog",
        setup(plugin) {
          // Подменяет только статический каталог и type-only UI barrel, оставляя реализацию Picture и DomImage настоящей.

          plugin.onResolve({ filter: /static-image-catalog$/ }, () => ({
            path: "catalog",
            namespace: "fixture",
          }));
          plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              "export const STATIC_IMAGE_URLS={};export const STATIC_IMAGE_VARIANTS={};",
          }));
          // BoxProps is a type; Picture only consumes the real DomImage export.
          plugin.onResolve({ filter: /^@\/shared\/ui\/elements$/ }, () => ({
            path: resolve("apps/frontend/src/shared/ui/dom-image.tsx"),
          }));
        },
      },
    ],
    logLevel: "silent",
  });
  const state = () => /* Отдаёт копию списка запросов и состояние незавершённых тел для независимых утверждений браузерного теста. */ ({
    requests: [...requests],
    pending: pending.size,
    aborted,
  });
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'none'",
    );
    if (url.pathname === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(
        '<h1>Local pending-photo regression</h1><div id="root"></div><pre id="state"></pre><script src="/bundle.js"></script>',
      );
    }
    if (url.pathname === "/bundle.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(bundle.outputFiles[0].contents);
    }
    if (url.pathname === "/state") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      return res.end(JSON.stringify(state()));
    }
    if (!["/photo.svg", "/photo-2.svg", "/_next/image"].includes(url.pathname))
      return void res.writeHead(404).end();
    requests.push(req.url!);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    // Первый ответ начинает тело с заведомо незавершённой длиной; следующий отдаёт декодируемый SVG для проверки ручного восстановления.
    if (requests.length === 1) {
      pending.add(res);
      res.once("close", () => {
        pending.delete(res);
        aborted++;
      });
      res.setHeader("Content-Length", "10000");
      return void res.write("<svg ");
    }
    res.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#d8c7ac"/></svg>',
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    state,
    close: () =>
      /* Закрывает удерживаемые HTTP-соединения собственного сервера, чтобы тест не висел после проверки. */ new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
