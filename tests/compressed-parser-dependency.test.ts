import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, it } from "vitest";

const root = createRequire(path.resolve("package.json"));
const backend = createRequire(path.resolve("apps/backend/package.json"));
const parsers = [
  {
    name: "Express 4",
    entry: createRequire(root.resolve("express")).resolve("body-parser"),
  },
  {
    name: "Nest Express",
    entry: createRequire(backend.resolve("@nestjs/platform-express")).resolve(
      "body-parser",
    ),
  },
];

// The application already refuses encoded requests before parsing. This narrow
// upstream regression also verifies the installed decoder remains safe itself.
// Run the tiny fixture in an isolated child: a vulnerable parser must not crash Vitest.
it.each(parsers)(
  "$name survives a late error after a compressed frame",
  ({ entry }) => {
    const result = spawnSync(
      process.execPath,
      [
        "--max-old-space-size=96",
        "-e",
        String.raw`
    const assert=require('node:assert/strict');
    const {createServer,request}=require('node:http');
    const {gzipSync}=require('node:zlib');
    const parse=require(process.argv[1]).json();
    (async()=>{
      const server=createServer((req,res)=>{
        if(req.url==='/health'){res.end('alive');return;}
        parse(req,res,error=>{res.statusCode=error?400:200;res.end('finished');});
      });
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const port=server.address().port;
      const body=Buffer.concat([gzipSync('{}'),Buffer.from([0]),Buffer.alloc(64*1024,88)]);
      await new Promise(resolve=>{
        const req=request({host:'127.0.0.1',port,method:'POST',headers:{'content-type':'application/json','content-encoding':'gzip','content-length':body.length}},res=>{res.resume();res.on('end',resolve);});
        req.on('error',resolve);req.end(body);
      });
      await new Promise(resolve=>setTimeout(resolve,200));
      assert.equal(await(await fetch('http://127.0.0.1:'+port+'/health')).text(),'alive');
      server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
      console.log(JSON.stringify({alive:true}));
    })().catch(()=>process.exit(9));
  `,
        entry,
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ alive: true });
  },
);
