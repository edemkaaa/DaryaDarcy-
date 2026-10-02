# Daryadarcy App

Мобильное и веб-приложение бренда Darya Darcy: лента, видео, клуб по подписке, библиотека, магазин, интерактив (квиз, moodboard).

Production: https://daryadarcy.com

## Требования

- Node.js 20+
- npm или pnpm
- MySQL 8+ (utf8mb4) для локального API
- Доступ к S3 Timeweb (только для полного локального запуска с медиа)

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env   # заполнить без production-секретов
npm run dev            # API :3000 + Metro web :8081
```

Отдельно для web-only (статика + production API):

```bash
npm run build:web
npx serve web-dist
```

## Сборка и деплой

| Команда | Назначение |
|---------|------------|
| `npm run verify` | Регрессионные тесты перед релизом |
| `npm run build:web` | Сборка PWA (Expo export → `web-dist/`) |
| `npm run build` | Сборка API (`dist/index.mjs`) |
| `npm run deploy:web` | verify → build → S3 → VPS (nginx) |
| `npm run smoke` | Smoke-тест production |

API на VPS: PM2 `daryadarcy-api`, nginx проксирует `/api/` → `127.0.0.1:3000`.

## Тестирование

```bash
npm run verify          # regression + quiz (30 тестов)
npm run test            # все vitest-тесты
npm run test:regression
npm run smoke           # HTTP smoke production
```

## Структура проекта

```
apps/             Клиентские и серверные приложения
  frontend/       Expo Router: web, iOS и Android
  backend/        Express + tRPC API
  legacy-web/     Альтернативный Vite-клиент (legacy)
packages/
  shared/         Общие контракты и чистые утилиты
  database/       Drizzle-схема и SQL-миграции
infrastructure/   Конфигурация окружения и деплоя
  deploy/         nginx, PM2 и подготовка VPS
scripts/          Временные служебные скрипты (переносятся в tooling/)
docs/decisions/   Архитектурные решения
web-dist/         Собранный фронт (генерируется, не в git)
docs/             Документация для аудита
```

## Документация для аудита

См. [`docs/AUDIT-PACKAGE.md`](docs/AUDIT-PACKAGE.md) — полный пакет для независимого аудита.

## Переменные окружения

Шаблон: `.env.example` (без секретов). Production `.env` на VPS, **не включать в архивы и репозиторий**.
