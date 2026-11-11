/** Сравниваем реальные sync/async преобразования прежнего core-utils и кандидатного esbuild без изменения установленного графа. */
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

// Characterize the deprecated migration loader's actual transformer before any
// dependency override. The candidate is injected only in a separate child;
// this does not change the installed graph or prove whole-loader compatibility.
/** Подменяем compiler только внутри дочернего процесса, исполняем синтетический результат в VM и сверяем карту и warnings. */
it.each([false, true])(
  "preserves core-utils sync/async TypeScript transforms (candidate: %s)",
  (candidate) => {
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `const Module = require('node:module');
         const vm = require('node:vm');
         const assert = require('node:assert/strict');
         const entry = require.resolve('@esbuild-kit/core-utils');
         const localRequire = Module.createRequire(entry);
         const originalLoad = Module._load;
         let injected = false;
         const compiler = process.argv[1] === 'true'
           ? require('esbuild') : localRequire('esbuild');
         if (process.argv[1] === 'true') {
           Module._load = function(id, parent, ...rest) {
             if (id === 'esbuild' && parent?.filename === entry) { injected = true; return compiler; }
             return originalLoad.call(this, id, parent, ...rest);
           };
         }
         const core = require(entry);
         Module._load = originalLoad;
         assert.equal(injected, process.argv[1] === 'true');
         const source = 'enum Role { Member = 1, Admin = 2 }; interface Item { value: number }; export const result = {role:Role.Member,total:[1,2,3].map((value:number)=>value*2).reduce((a,b)=>a+b,0)};';
         function verify(transformed) {
           const sandbox = {module:{exports:{}},exports:{}};
           vm.runInNewContext(transformed.code, sandbox, {timeout:1000});
           assert.equal(sandbox.module.exports.result.role, 1);
           assert.equal(sandbox.module.exports.result.total, 12);
           const map = typeof transformed.map === 'string'
             ? JSON.parse(transformed.map) : transformed.map;
           assert.equal(map.version, 3);
           assert.ok(map.sources.some(value => value.endsWith('synthetic-core-utils.ts')));
           assert.ok(map.sourcesContent.includes(source));
           assert.equal(transformed.warnings?.length ?? 0, 0);
         }
         (async()=>{
           verify(core.transformSync(source, '/synthetic-core-utils.ts', {format:'cjs'}));
           verify(await core.transform(source, '/synthetic-core-utils.ts', {format:'cjs'}));
           process.stdout.write(JSON.stringify({version:compiler.version,sync:true,async:true}));
         })().catch(error=>{process.stderr.write(String(error));process.exitCode=1});`,
        String(candidate),
      ],
      {
        env: { ...process.env, ESBK_DISABLE_CACHE: "1" },
        timeout: 10_000,
        encoding: "utf8",
        maxBuffer: 64 * 1024,
      },
    );
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      version: candidate ? "0.28.2" : "0.18.20",
      sync: true,
      async: true,
    });
  },
);
