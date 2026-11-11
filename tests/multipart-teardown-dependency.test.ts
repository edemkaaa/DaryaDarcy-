/** Проверяем teardown установленного multer в отдельном процессе; multipart-обработчик приложения этим не включается. */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, it } from "vitest";

// Multipart is not enabled by the app. Characterize Nest's installed dependency
// without adding a production handler or allowing a late stream error to kill Vitest.
/** Поздний callback после отказа должен закрыть parser и вызвать завершение один раз без падения процесса. */
it("keeps a late multipart filter callback from crashing after teardown", () => {
  const backend = createRequire(path.resolve("apps/backend/package.json"));
  const entry = createRequire(
    backend.resolve("@nestjs/platform-express"),
  ).resolve("multer");
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=96",
      "-e",
      String.raw`
    const assert=require('node:assert/strict');
    const {PassThrough}=require('node:stream');
    const multer=require(process.argv[1]);
    const req=new PassThrough();let resume,parser,calls=0;
    const refusal=new Error('fixture refusal');
    const body=['alpha','beta'].map(name=>'--FixtureBoundary\r\nContent-Disposition: form-data; name="'+name+'"; filename="file.txt"\r\nContent-Type: text/plain\r\n\r\nX').join('\r\n');
    req.headers={'content-type':'multipart/form-data; boundary=FixtureBoundary','content-length':Buffer.byteLength(body)};
    const upload=multer({fileHwm:1,
      streamHandler:(request,stream)=>{parser=stream;request.pipe(stream);},
      fileFilter:(request,file,done)=>{
        if(file.fieldname==='alpha')resume=done;
        else request.once('end',()=>setImmediate(()=>done(refusal)));
      }
    }).any();
    upload(req,null,error=>{
      assert.equal(error,refusal);calls++;
      setImmediate(()=>{
        parser.once('close',()=>{
          assert.equal(calls,1);assert.deepEqual(req.files,[]);
          console.log(JSON.stringify({lateParserClosed:true}));
        });
        resume(null,true);
      });
    });
    req.end(body);
  `,
      entry,
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ lateParserClosed: true });
});
