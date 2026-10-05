# Фронтенд Daryadarcy

Основной веб-клиент — Next.js App Router и React. Работает с отдельным Express + tRPC API. Эта сборка не создаёт приложения iOS/Android; прежний Expo-клиент сохранён в [legacy-expo](../legacy-expo/), вне workspace.

## Где менять

- src/app/ — маршруты Next.js и корневые layout.
- src/features/ — экраны и компоненты функций (клуб, админка, профиль).
- src/domain/ — состояние сессии, редактор и другая клиентская логика.
- src/shared/ — UI, браузерные операции и клиент API.
- public/ — статические изображения, шрифты, манифест и privacy.
- e2e/ — браузерные приёмочные тесты.

Типы tRPC находятся в src/shared/api/contract.ts и генерируются из API.
После изменения серверного контракта: pnpm api:contract, затем pnpm check:api.
Клиент не импортирует серверный runtime или код БД.

## Запуск из корня

```sh
cp apps/frontend/.env.example apps/frontend/.env.local
pnpm dev
```

В .env.local для локальной разработки: API*PROXY_TARGET=http://127.0.0.1:3000,
NEXT_PUBLIC_API_BASE_URL оставьте пустым. Запросы /api и /media идут через
Next.js к API на том же браузерном origin; HttpOnly cookie не требуют ослабления CORS.
EXPO_PUBLIC_API_BASE_URL новый клиент не читает.
Не кладите серверные секреты в NEXT_PUBLIC*\*.

```sh
pnpm dev:frontend     # только Next.js, порт 8081
pnpm dev:server       # только API, порт 3000
pnpm build:web        # Next.js production build, apps/frontend/.next
pnpm start:frontend   # запуск собранного Next.js
pnpm test:frontend    # браузерные тесты; сначала build:web
```

API_PROXY_TARGET должен быть настроен и при сборке, и при запуске.
Для тестов с настоящим API: подготовьте только локальную dev-базу по
[инструкции запуска](../../docs/development/getting-started.md), запустите API и
задайте RUN_REAL_API_TESTS=1. Без этого три соответствующих теста пропускаются.

## Ограничения выпуска

Прежний статический web-dist и старый deploy:web не подходят для Next.js:
защитная проверка останавливает этот деплой. Запуск процесса Next.js за nginx,
маршруты /api и /media, переменные сборки/запуска и rollback ещё требуют отдельной
проверки и согласования. Не считать локальную сборку разрешением production-релиза.

[Push: ограничения](../../docs/architecture/push.md) · [рабочий процесс](../../docs/development/workflow.md) · [задачи](../../tasks/todo.md).
