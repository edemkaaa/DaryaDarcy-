// Собирает отдельный клиентский вариант гостевой оплаты и проверяет встроенные флаги. Переменные окружения запущенного Next не могут заменить эти build-time значения.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  normalGuestFlags,
  assertNormalGuestBuild,
} from "./normal-guest-profile.mjs";

// Run in an isolated checkout for verification. This builds .next in the cwd;
// it neither selects a backend nor changes flags on a running website.
// Сборка изменяет локальный .next; профиль окружения передаётся только дочернему процессу.
const child = spawnSync("pnpm", ["build:web"], {
  env: { ...process.env, NODE_ENV: "production", ...normalGuestFlags },
  stdio: "inherit",
});
if (child.error || child.status !== 0) process.exit(child.status || 1);
// После успешной сборки проверяется manifest встроенных флагов, а не доступность платежей сервера.
assertNormalGuestBuild(
  JSON.parse(
    readFileSync("apps/frontend/.next/required-server-files.json", "utf8"),
  ),
);
console.log("NORMAL/GUEST build-time flags verified.");
