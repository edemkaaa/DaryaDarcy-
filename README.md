# Daryadarcy App

Приложение бренда Darya Darcy для web, iOS и Android. В проект входят публичная лента, видео, закрытый клуб по подписке, библиотека, магазин и интерактивные разделы.

- Production: [daryadarcy.com](https://daryadarcy.com)
- Основной клиент: Expo Router (`apps/frontend`)
- API: Express + tRPC (`apps/backend`)
- Репозиторий: модульный монолит на pnpm workspaces

## Быстрый старт

### 1. Требования

- Node.js 22 (версия CI и рекомендуемая версия разработки)
- pnpm 9
- MySQL 8 с кодировкой `utf8mb4`

Для обычной разработки доступ к production, VPS и S3 не нужен.

### 2. Установка

```bash
pnpm install
cp .env.example .env
```

В `.env` для локального запуска достаточно указать:

```dotenv
DATABASE_URL=mysql://user:password@127.0.0.1:3306/daryadarcy?charset=utf8mb4
JWT_SECRET=change-me-local-dev-only
PUBLIC_APP_URL=http://localhost:8081
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

Полный список параметров и пояснения находятся в [`.env.example`](.env.example). Не копируйте production-секреты в локальный `.env` и никогда не добавляйте `.env` в Git.

### 3. Запуск

```bash
pnpm dev
```

Команда одновременно запускает:

- основной web-клиент — [http://localhost:8081](http://localhost:8081);
- API — [http://localhost:3000](http://localhost:3000);
- проверку API — [http://localhost:3000/api/health](http://localhost:3000/api/health);
- tRPC — `http://localhost:3000/api/trpc`.

Если нужна только одна часть:

```bash
pnpm dev:metro    # основной Expo-клиент
pnpm dev:server   # только API
pnpm dev:web      # старый Vite-клиент, не production-фронтенд
```

## Структура проекта

```text
apps/
  frontend/          Основной Expo Router клиент: web, iOS, Android
  backend/           Express + tRPC API
  legacy-web/        Старый Vite-клиент, сохранён для совместимости

packages/
  shared/            Общие контракты и платформо-независимые функции
  database/          Drizzle-схема, связи и SQL-миграции

infrastructure/
  deploy/            nginx, PM2, подготовка и артефакты VPS

tooling/
  scripts/           Импорт данных, обслуживание и сценарии деплоя

docs/                Техническая документация и материалы аудита
  decisions/         Архитектурные решения (ADR)

tests/               Дополнительные тестовые сценарии
__tests__/           Основной набор Vitest-тестов
tasks/               План дальнейшего рефакторинга
```

### Границы модулей

- `frontend` использует общие контракты из `packages/shared`; runtime-код API и БД запрещён.
  Узкое исключение для обоих клиентов — только `import type { AppRouter }` для
  tRPC-инференса; этот импорт не попадает в JavaScript-бандл. Expo app.config.ts
  использует один build-only environment loader, не приложение времени выполнения.
- `backend` отвечает за HTTP, tRPC, авторизацию и бизнес-логику; он может использовать `shared` и `database`.
- `database` владеет схемой и миграциями, но не зависит от приложений.
- `infrastructure` и `tooling` не содержат пользовательский интерфейс или бизнес-логику.

Границы проверяются `pnpm check:boundaries` по синтаксическому дереву TypeScript,
включая re-export, require и dynamic import. `pnpm check` дополнительно проверяет типы.
- `legacy-web` не считается основным клиентом и не должен получать новые функции без отдельного решения.

Подробнее: [ADR-0001 — Modular Monorepo](docs/decisions/0001-modular-monorepo.md).

### Куда вносить изменения

| Задача                                     | Папка                      |
| ------------------------------------------ | -------------------------- |
| Экран или маршрут основного приложения     | `apps/frontend/app`        |
| Переиспользуемый UI-компонент              | `apps/frontend/components` |
| Клиентская работа с API                    | `apps/frontend/lib`        |
| API, авторизация или бизнес-логика         | `apps/backend/src`         |
| Таблица, поле или связь БД                 | `packages/database`        |
| Общий тип, контракт или чистая функция     | `packages/shared`          |
| nginx, PM2 или настройка VPS               | `infrastructure/deploy`    |
| Импорт, диагностика или служебная операция | `tooling/scripts`          |

Если задача относится к интерфейсу, начинайте с `apps/frontend`. Папку `apps/legacy-web` меняйте только тогда, когда задача явно касается старого клиента.

## Основные команды

### Разработка

| Команда           | Что делает                                          |
| ----------------- | --------------------------------------------------- |
| `pnpm dev`        | Запускает API и основной Expo web-клиент            |
| `pnpm dev:server` | Запускает только API с автоматической перезагрузкой |
| `pnpm dev:metro`  | Запускает основной Expo-клиент                      |
| `pnpm android`    | Открывает Expo-клиент для Android                   |
| `pnpm ios`        | Открывает Expo-клиент для iOS                       |
| `pnpm dev:web`    | Запускает старый Vite-клиент                        |

### Проверка качества

| Команда       | Что делает                                         |
| ------------- | -------------------------------------------------- |
| `pnpm test`   | Запускает все Vitest-тесты                         |
| `pnpm verify` | Запускает быстрый релизный набор regression + quiz |
| `pnpm check`  | Проверяет TypeScript без сборки                    |
| `pnpm check:boundaries` | Проверяет разрешённые зависимости между папками |
| `pnpm lint`   | Проверяет основной Expo-клиент линтером            |
| `pnpm format` | Форматирует файлы через Prettier                   |

### Сборка

GitLab и GitHub CI запускают проверки с отдельной MySQL `backend_test`, затем
собирают API и веб. Деплой и рабочие миграции из CI не запускаются. Команды
проверены локально; запуск на удалённом runner ещё требует отдельной приёмки.

| Команда               | Результат                                                          |
| --------------------- | ------------------------------------------------------------------ |
| `pnpm build`          | Собирает API в `dist/index.mjs`                                    |
| `pnpm build:web`      | Собирает основной Expo web-клиент в `web-dist/` и архив для деплоя |
| `pnpm build:web:vite` | Собирает старый Vite-клиент в `web-dist/`                          |
| `pnpm start`          | Запускает ранее собранный API                                      |

Перед отправкой изменений рекомендуется выполнить:

```bash
pnpm test
pnpm check
pnpm build
pnpm build:web
```

## База данных

- Схема: [`packages/database/src/schema.ts`](packages/database/src/schema.ts)
- Связи: [`packages/database/src/relations.ts`](packages/database/src/relations.ts)
- Миграции: [`packages/database/drizzle`](packages/database/drizzle)
- Обзор таблиц: [`docs/DATABASE-SCHEMA.md`](docs/DATABASE-SCHEMA.md)

Применение изменений схемы:

```bash
pnpm db:push
```

Сначала проверьте `DATABASE_URL`: команда изменяет указанную базу данных.

## Конфигурация

Все переменные перечислены в [`.env.example`](.env.example) и разделены по назначению:

- БД и авторизация;
- S3 Timeweb;
- Prodamus;
- SMS.ru;
- SMTP;
- Expo Push;
- Admin 2FA;
- параметры деплоя.

S3, платежи, SMS, почта и push-уведомления необязательны для базового локального запуска. Тесты, которым нужны внешние сервисы, пропускаются без соответствующих ключей.

## Деплой

Production работает на VPS под nginx и PM2. Процесс API в PM2 называется `daryadarcy-api`; nginx проксирует `/api/` на `127.0.0.1:3000`.

```bash
pnpm deploy:web   # тесты → сборка → загрузка → обновление VPS → smoke
pnpm deploy:api   # тесты → сборка API → обновление VPS
pnpm smoke        # безопасная HTTP-проверка текущего production
```

> `deploy:web` и `deploy:api` изменяют production. Запускайте их только с разрешённого компьютера, корректным `.env` и доступом к VPS/S3.

Конфигурация деплоя лежит в [`infrastructure/deploy`](infrastructure/deploy), сценарии — в [`tooling/scripts`](tooling/scripts).

## Документация

- [Оплаты клуба, пароли и письма: реализация и запрет выпуска](docs/BACKEND-BILLING-IDENTITY-STAGE.md)
- [Серверный аудит и оставшиеся блокеры](docs/BACKEND-AUDIT-2026-10-02.md)
- [Обзор API](docs/API-OVERVIEW.md)
- [Схема базы данных](docs/DATABASE-SCHEMA.md)
- [Интеграции](docs/INTEGRATIONS.md)
- [Push-уведомления](docs/PUSH-NOTIFICATIONS.md)
- [S3 backup](docs/S3-BACKUP.md)
- [Известные проблемы](docs/KNOWN-ISSUES.md)
- [Пакет для аудита](docs/AUDIT-PACKAGE.md)
- [План рефакторинга](tasks/plan.md)

## Правила безопасной работы

- Не коммитьте `.env`, пароли, токены, приватные ключи и выгрузки пользовательских данных.
- Не меняйте публичные tRPC-процедуры без проверки обратной совместимости.
- Не смешивайте структурный рефакторинг с изменениями оплаты или авторизации в одном коммите.
- После изменения путей проверяйте основной Expo web build и отдельно legacy Vite build.
- Новую общую логику размещайте в `packages/shared`, а работу с БД — в `packages/database` или бэкенде.
