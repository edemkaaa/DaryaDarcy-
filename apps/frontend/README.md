# Фронтенд Daryadarcy

Основной веб-клиент использует Next.js 16, React и TypeScript. [Сохранённый Expo-клиент](../legacy-expo/) служит эталоном перенесённых сценариев, текстов и дизайна; [legacy-web](../legacy-web/) — более ранний Vite-клиент. Клиент работает с отдельным Express + tRPC API. Expo находится вне workspace. Команды сборки Next.js не собирают приложения iOS/Android.

## Где менять

- [src/app/](src/app/) — маршруты App Router и layout.
- [src/features/](src/features/) — экраны и сценарии разделов.
- [src/domain/](src/domain/) — сессия, подписка, профиль и обработка контента.
- [src/shared/](src/shared/) — API, навигация, браузерные функции и общие компоненты.
- [public/](public/) — изображения, шрифты, манифест и юридические страницы.
- [e2e/](e2e/) — браузерные приёмочные тесты.
- [next.config.mjs](next.config.mjs) — конфигурация Next.js и прокси API.

Общие контракты находятся в [packages/shared](../../packages/shared/). Типы tRPC в [src/shared/api/contract.ts](src/shared/api/contract.ts) генерируются из API. После изменения серверного контракта используйте `pnpm api:contract`, затем `pnpm check:api`. Клиент не импортирует серверный runtime или код БД. При изменении API согласовывайте контракт и обновляйте тестовые ответы. Текущий объём работ, результаты проверок и незавершённые задачи — в [WORK_PLAN.md](WORK_PLAN.md).

## Локальный запуск

Используйте Node.js 22 и pnpm 9.12.0, указанный в корневом `package.json`. Из корня репозитория:

```sh
pnpm install --frozen-lockfile
test -f apps/frontend/.env || cp apps/frontend/.env.example apps/frontend/.env
pnpm dev:frontend
```

Фронтенд: http://127.0.0.1:8081. В `.env` пустой `NEXT_PUBLIC_API_BASE_URL` оставляет запросы на том же origin; `API_PROXY_TARGET=http://127.0.0.1:3000` направляет `/api` и `/media` на локальный сервер. Запросы остаются на том же браузерном origin; HttpOnly cookie не требуют ослабления CORS. Next.js также читает `.env.local`; существующий `.env` можно сохранить. `EXPO_PUBLIC_API_BASE_URL` новый клиент не читает. `API_PROXY_TARGET` должен быть настроен и при сборке, и при запуске. После изменения переменных перезапустите Next.js. Не помещайте секреты в `NEXT_PUBLIC_*`.

Сам Next.js запускается без бэкенда, но данные и авторизация требуют доступного API. Браузерные регрессии ниже используют тестовые ответы и позволяют проверять фронтенд без сервера и базы. Запуск и переработка бэкенда не входят в текущую работу над фронтендом; общий `pnpm dev` запускает оба процесса; `pnpm dev:server` запускает только API на 3000. Подготовка локального API описана в [инструкции запуска](../../docs/development/getting-started.md).

## Сборка и проверки

Команды из корня:

```sh
pnpm --filter @daryadarcy/frontend typecheck
pnpm lint
pnpm verify
pnpm build:frontend  # pnpm build:web — тот же Next.js build, результат в apps/frontend/.next
pnpm start:frontend
```

Для браузерных проверок сначала соберите фронтенд и установите Chromium для Playwright:

```sh
pnpm --filter @daryadarcy/frontend exec playwright install chromium
pnpm build:frontend
pnpm test:frontend
```

Playwright запускает production-сервер на 8081, если порт свободен. При уже запущенном сервере используется он; для проверки именно новой сборки предварительно остановите прежний процесс. Можно выбрать установленный Chromium через `PLAYWRIGHT_EXECUTABLE_PATH`.

Проверки настоящего API выключены по умолчанию. `RUN_REAL_API_TESTS=1` включает отдельные интеграционные сценарии, включая запись черновика, и требует специально подготовленного тестового API. Успешные тесты с подставными ответами не подтверждают серверные права доступа, реальные платежи или работу на всех устройствах.

## Ограничения выпуска

Прежний статический `web-dist` и старый `deploy:web` не подходят для Next.js: защитная проверка останавливает этот деплой. Запуск процесса Next.js за nginx, маршруты `/api` и `/media`, переменные сборки/запуска и rollback ещё требуют отдельной проверки и согласования. Локальная сборка не является разрешением production-релиза.

[Ограничения push](../../docs/architecture/push.md) · [рабочий процесс](../../docs/development/workflow.md) · [задачи](../../tasks/todo.md)
