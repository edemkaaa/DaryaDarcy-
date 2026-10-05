# Daryadarcy

Монорепозиторий Daryadarcy: основной веб-клиент Next.js, сервер Express + tRPC и архивные клиенты Expo и Vite. Нативный клиент Expo сохранён, но исключён из активного workspace.

## С чего начать

- [Карта документации](docs/README.md) — где искать инструкции, решения и отчёты.
- [Полная инструкция запуска](docs/development/getting-started.md) — окружение, настройки и команды.
- [Правила работы с репозиторием](docs/development/workflow.md) — ветки, проверки и безопасная работа с данными.
- [Бэкенд](apps/backend/README.md) / [фронтенд](apps/frontend/README.md) — устройство приложений.
- [Текущий план](tasks/plan.md) и [чеклист](tasks/todo.md) — незавершённые работы.
- [Аудиты](docs/audits/README.md) — результаты проверок и ограничения выпуска.

## Структура

```text
apps/
  frontend/       основной веб-клиент: Next.js
  backend/        API: Express + tRPC, доменные модули
  legacy-web/     предыдущий веб-клиент: Vite, не основной интерфейс
  legacy-expo/    прежний Expo-клиент, вне активного workspace
packages/
  shared/         общие контракты и утилиты
  database/       Drizzle-схема и SQL-миграции
infrastructure/
  deploy/         конфигурация развёртывания и инфраструктурные сценарии
tooling/          инструменты сборки, проверок и обслуживания
__tests__/        автоматические тесты
tests/            дополнительные тестовые сценарии
docs/             актуальная документация и отдельно архив
tasks/            рабочий план и чеклист
```

## Локальный запуск

Нужны Node.js 22, pnpm 9.12.0 и локальная MySQL 8. Подробности — в инструкции запуска.

```sh
pnpm install --frozen-lockfile --ignore-scripts
cp .env.example .env
cp apps/frontend/.env.example apps/frontend/.env.local
# Заполните .env локальными настройками, не данными production.
pnpm dev
```

Клиент: http://localhost:8081. API: http://localhost:3000, проверка доступности: /api/health. Подготовка схемы локальной БД описана отдельно; запуск не означает автоматическую миграцию.

## Проверки

```sh
pnpm check:boundaries
pnpm check:docs
pnpm check
pnpm test
pnpm build
pnpm build:web
pnpm verify
```

Без отдельной тестовой MySQL часть интеграционных тестов пропускается. Как запустить их полностью — в [рабочем процессе](docs/development/workflow.md).

Единственный рабочий lockfile — pnpm-lock.yaml. Команды запускаются из корня репозитория.

## Статус выпуска

Локальные проверки не заменяют приёмку. До выпуска остаются проверки платёжной песочницы, доставки писем, устройств, миграций и защиты платных материалов. Источники статуса: [чеклист](tasks/todo.md) и [результаты серверного этапа](docs/audits/content-launch.md).

Деплой, миграции production, массовые импорты и операции с S3 требуют отдельного согласования. Архивные инструкции не следует выполнять как текущие.
