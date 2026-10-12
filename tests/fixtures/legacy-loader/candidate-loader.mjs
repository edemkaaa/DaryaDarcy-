// Experimental adapter scoped to the isolated Node loader worker, never the
// installed dependency graph. Import the real legacy hooks after substitution.
import Module from "node:module";
import assert from "node:assert/strict";
const require = Module.createRequire(import.meta.url);
const coreEntry = require.resolve("@esbuild-kit/core-utils");
const compiler = require("esbuild");
const originalLoad = Module._load;
let injected = false;
Module._load = function (id, parent, ...rest) {
  if (id === "esbuild" && parent?.filename === coreEntry) {
    injected = true;
    return compiler;
  }
  return originalLoad.call(this, id, parent, ...rest);
};
const hooks = await import("@esbuild-kit/esm-loader");
Module._load = originalLoad;
assert.equal(injected, true);
assert.equal(compiler.version, "0.28.2");
export const { resolve, load, globalPreload } = hooks;
