import { vi } from "vitest";
import Module from "module";

// Intercept require calls for image files
const originalRequire = Module.prototype.require;
// @ts-ignore
Module.prototype.require = function (id: string) {
  if (
    /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(id)
  ) {
    return "mock-image";
  }
  return originalRequire.apply(this, arguments as any);
};
