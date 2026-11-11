// Входной модуль проверяет одновременно статический alias и динамический TS импорт, выводя только синтетический результат.
import config from "@fixture/config.mjs";
const { double } = await import("@fixture/dynamic.mjs");
process.stdout.write(JSON.stringify({ ...config, total: double(6) }));
