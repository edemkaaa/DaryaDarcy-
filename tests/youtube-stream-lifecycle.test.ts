import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
describe("legacy API video streaming on isolated loopback processes", () => {
  let directory: string;
  beforeAll(async () => {
    directory = mkdtempSync(resolve("node_modules/.cache-yt-stream-"));
    await build({
      stdin: {
        resolveDir: process.cwd(),
        contents: `
        import assert from 'node:assert/strict';
        import express from 'express';
        import {createServer,get} from 'node:http';
        import {once} from 'node:events';
        import {registerYoutubeStream} from './apps/backend/src/youtube-stream';
        const mode=process.argv[2]; let sourceClosed=false;
        const upstream=createServer((req,res)=>{
          res.writeHead(200,{'content-type':'video/mp4','content-length':'100000'});res.write('first bytes');
          if(mode==='broken'){const t=setTimeout(()=>res.destroy(),80);res.once('close',()=>clearTimeout(t));}
          else {const t=setInterval(()=>res.write('next bytes'),20);res.once('close',()=>clearInterval(t));}
          res.once('close',()=>{sourceClosed=true});
        });
        upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
        globalThis.__fixtureUpstream='http://127.0.0.1:'+upstream.address().port+'/video';
        const app=express();registerYoutubeStream(app);app.get('/health',(_q,r)=>r.json({ok:true}));
        const server=app.listen(0,'127.0.0.1');await once(server,'listening');
        const base='http://127.0.0.1:'+server.address().port;
        const guard=setTimeout(()=>process.exit(12),2500);
        await new Promise(resolve=>{
          const q=get(base+'/api/yt/fixture001',res=>{
            res.on('data',()=>{if(mode==='disconnect')res.destroy();});
            res.on('end',resolve);res.on('close',resolve);res.on('error',resolve);
          });q.on('error',resolve);
        });
        await new Promise(resolve=>setTimeout(resolve,350));
        const health=await fetch(base+'/health');assert.equal(health.status,200);
        console.log(JSON.stringify({alive:true,sourceClosed}));
        clearTimeout(guard);server.closeAllConnections();upstream.closeAllConnections();
        await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))]);
      `,
      },
      outfile: join(directory, "child.mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      plugins: [
        {
          name: "synthetic-catalog-and-extractor",
          setup(builder) {
            builder.onResolve({ filter: /^\.\/db$/ }, (args) =>
              args.importer.endsWith("youtube-stream.ts")
                ? { path: "catalog", namespace: "fixture" }
                : undefined,
            );
            builder.onResolve({ filter: /^node:child_process$/ }, () => ({
              path: "extractor",
              namespace: "fixture",
            }));
            builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
              contents:
                args.path === "catalog"
                  ? 'export async function getVideoByYoutubeId(){return {published:true,provider:"youtube",access:"public"}}'
                  : 'export const execFile=Object.assign(()=>{throw Error("unexpected callback")},{[Symbol.for("nodejs.util.promisify.custom")]:async()=>({stdout:globalThis.__fixtureUpstream,stderr:""})});',
            }));
          },
        },
      ],
    });
  });
  afterAll(() => {
    if (directory) {
      rmSync(join(directory, "child.mjs"));
      rmdirSync(directory);
    }
  });
  it.each(["broken", "disconnect"])(
    "survives %s and releases the upstream connection",
    async (mode) => {
      const { stdout } = await run(
        process.execPath,
        [join(directory, "child.mjs"), mode],
        { timeout: 5000 },
      );
      expect(JSON.parse(stdout)).toEqual({ alive: true, sourceClosed: true });
    },
  );
});
