/** Общий Vitest setup заменяет бинарные require картинок стабильным marker; код приложения и сетевые вызовы здесь не запускаются. */
import { vi } from "vitest";
import Module from "module";

// Перехват нужен для старых модулей, импортирующих картинки как CommonJS-ресурсы; остальные require делегируются исходному loader.
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
