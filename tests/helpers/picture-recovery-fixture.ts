import { build } from "esbuild";
import { createServer } from "node:http";
import { resolve } from "node:path";
export async function startPictureRecoveryFixture() {
  // Проверяет восстановление настоящего Picture после двух временных отказов превью и отсутствие лишнего polling у ленивых изображений.

  const requests: string[] = [];
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      // Строковая мини-страница сохраняется дословно: она считает lazy-poll и переключает источник, а не имитирует внутреннее состояние Picture.
      contents: `
import React,{useState} from 'react';
import{createRoot}from'react-dom/client';
import{Picture}from'./apps/frontend/src/shared/media/image';
const mode=new URLSearchParams(location.search).get('mode')||'preview';
let polls=0; const interval=window.setInterval.bind(window);
window.setInterval=(cb,delay,...args)=>{if(delay===100)polls++;return interval(cb,delay,...args)};
function App(){const[visible,setVisible]=useState(mode!=='poll');const[source,setSource]=useState(0);return <><button onClick={()=>setVisible(v=>!v)}>Toggle visible</button><button onClick={()=>setSource(s=>s+1)}>Change source</button><div style={{height:visible?0:10000}}/><div>{Array.from({length:mode==='poll'?18:1},(_,i)=><Picture key={i} source={mode==='poll'?'/pending.svg?i='+i:'https://s3.twcstorage.ru/daryadarcy-s3/feed/fixture-'+source+'.jpg'} loading={mode==='poll'?'lazy':'eager'} loadingFallback={null} showRetryButton aria-label={'Photo '+i} style={{width:320,height:200}}/>)}</div></>}
createRoot(document.getElementById('root')).render(<App/>);
async function report(){const r=await(await fetch('/state')).json();document.getElementById('status').textContent=JSON.stringify({...r,polls,images:[...document.images].map(x=>({src:x.getAttribute('src'),complete:x.complete,width:x.naturalWidth})),failure:document.body.textContent.includes('Не удалось загрузить изображение')});setTimeout(report,500)}report();
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
        name: "catalog",
        setup(p) {
          // Убирает несвязанный статический каталог из тестовой сборки, сохраняя реальный DOM-адаптер изображения.

          p.onResolve({ filter: /static-image-catalog$/ }, () => ({
            path: "catalog",
            namespace: "fixture",
          }));
          p.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              "export const STATIC_IMAGE_URLS={};export const STATIC_IMAGE_VARIANTS={};",
          }));
          p.onResolve({ filter: /^@\/shared\/ui\/elements$/ }, () => ({
            path: resolve("apps/frontend/src/shared/ui/dom-image.tsx"),
          }));
        },
      },
    ],
    logLevel: "silent",
  });
  const server = createServer((req, res) => {
    const u = new URL(req.url!, "http://127.0.0.1");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'none'",
    );
    if (u.pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      return res.end(
        '<h1>Picture recovery regression</h1><div id="root"></div><pre id="status"></pre><script src="/bundle.js"></script>',
      );
    }
    if (u.pathname === "/bundle.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(bundle.outputFiles[0].contents);
    }
    if (u.pathname === "/state") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ requests }));
    }
    requests.push(req.url!);
    // Первые два preview HTTP намеренно отказывают; последующие ответы проверяют восстановление и cache без настоящего storage.
    if (
      u.pathname === "/_next/image" &&
      requests.filter((x) => x.startsWith("/_next/image")).length <= 2
    ) {
      res.writeHead(503);
      return res.end("temporary preview failure");
    }
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public,max-age=3600");
    res.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#c8b69d"/></svg>',
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Loopback fixture required");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      /* Завершает локальные соединения и сервер после сценария восстановления. */ new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
