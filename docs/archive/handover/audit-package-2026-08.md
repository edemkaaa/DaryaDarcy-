# Пакет для независимого аудита — Daryadarcy App

> Исторический пакет августа 2026. Описывает прежнее состояние, не является текущей инструкцией и не предоставляет разрешения на операции с production. Актуальная передача материалов — [docs/audits/package.md](../../audits/package.md).

Дата сборки: август 2026  
Версия приложения: 1.0.0  
Production: **https://daryadarcy.com**

---

## 1. Окружения

| Окружение | URL | Назначение |
|-----------|-----|------------|
| **Production** | https://daryadarcy.com | Боеевой сайт/PWA + API `/api/` |
| **Локальная разработка** | http://localhost:8081 (web), http://localhost:3000 (API) | Полный стек у разработчика |
| **Отдельный staging** | *нет* | Отдельного тестового домена пока не развёрнуто |

Smoke-тест production: `npm run smoke` (проверяет `/`, `/feed`, `/api/health`, tRPC tags).

---

## 2. Роли пользователей

В приложении нет отдельной таблицы «ролей» — права определяются комбинацией полей:

| Роль | Как определяется | Что доступно |
|------|------------------|--------------|
| **Гость** | Не авторизован | Лента, видео, магазин, лендинг клуба, библиотека (часть материалов) |
| **Пользователь** | `users.role = user`, без подписки | + профиль, лайки/сохранения, SMS/email вход |
| **Подписчик клуба** | Активная запись в `club_subscriptions` | Контент клуба, комментарии, pen pals |
| **Администратор** | `users.role = admin` (владелец проекта) | Админ-панель, CRUD постов/видео/статей, модерация |

Тестовые аккаунты для аудита передаются **отдельно** (не в этом документе) — см. `docs/audits/templates/accounts.md`.

---

## 3. Доступ к репозиторию

Read-only доступ к Git нужно выдать аудитору отдельно (GitHub/GitLab invite или архив исходников).

**Архив исходников** (без секретов): `daryadarcy_app_backup_YYYYMMDD.zip` в комплекте поставки.

Исключено из архива: `.env`, `node_modules/`, `web-dist/`, `.git/`, production-пароли.

---

## 4. Установка, запуск, сборка, тесты

См. корневой [`README.md`](../../../README.md).

Кратко:

```bash
npm install
cp .env.example .env   # заполнить локальными значениями
npm run dev            # API + Metro web
npm run verify         # 30 автотестов
npm run build:web      # production PWA
npm run build          # API bundle
```

---

## 5. Технологический стек

| Слой | Технологии |
|------|------------|
| **Клиент** | React Native 0.81, Expo 54, Expo Router, TypeScript |
| **Web** | Expo export (PWA), React Native Web |
| **API** | Node.js, Express, tRPC 11, Zod, superjson |
| **БД** | MySQL 8 (Timeweb), Drizzle ORM, utf8mb4 |
| **Файлы** | S3-compatible (Timeweb S3) |
| **Auth** | JWT cookie (web) / Bearer (native), SMS.ru OTP, email+password |
| **Платежи клуба** | Prodamus |
| **Деплой** | VPS Timeweb, nginx, PM2, скрипты в `tooling/scripts/` |
| **Тесты** | Vitest |

---

## 6. Архитектура (высокий уровень)

```
┌─────────────────────────────────────────────────────────┐
│  Клиент (Expo / PWA)                                     │
│  app/(tabs) — feed, videos, club, shop, library…        │
│  lib/trpc.ts → HTTP /api/trpc                           │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  VPS: nginx → Node API (server/_core/index.ts)          │
│  tRPC routers (server/routers.ts)                       │
│  server/db.ts → MySQL                                     │
└──────────┬─────────────────────────────┬────────────────┘
           │                             │
    ┌──────▼──────┐               ┌──────▼──────┐
    │ MySQL       │               │ S3 Timeweb  │
    │ posts, users│               │ photos, media│
    └─────────────┘               └─────────────┘

Внешние сервисы: YouTube (превью/метаданные), Prodamus (оплата), SMS.ru (OTP).
```

Основные модули API: `auth`, `profile`, `feed`, `videos`, `club`, `admin`, `articles`, `shop`, `penPals`, `notifications`.

---

## 7. API

Type-safe tRPC, базовый URL: `https://daryadarcy.com/api/trpc/`

Полный перечень процедур: [`docs/architecture/api.md`](../../architecture/api.md).

Health check: `GET /api/health` → `{ ok: true, timestamp }`.

---

## 8. Схема базы данных

Описание таблиц без персональных данных: [`docs/architecture/database.md`](../../architecture/database.md).

SQL-миграции: `drizzle/*.sql`, актуальная схема: `drizzle/schema.ts`.

---

## 9. Интеграции

См. [`docs/architecture/integrations.md`](../../architecture/integrations.md).

---

## 10. Автоматические тесты

| Файл | Что проверяет |
|------|----------------|
| `__tests__/regression.test.ts` | UI-регрессии (feed, shop, club tags, photo viewer, rich text…) |
| `__tests__/quiz-data.test.ts` | Данные интерактивного квиза |
| `__tests__/screens.test.ts` | Наличие ключевых экранов |
| `__tests__/s3-connection.test.ts` | S3 (требует env, опционально) |

Запуск: `npm run verify` (без S3 и без production DB).

---

## 11. Логи ошибок (обезличенные)

Production API логи: PM2 на VPS (`pm2 logs daryadarcy-api`).
**Не передаются** в пакете аудита — по запросу можно выгрузить фрагмент за N дней с редактированием IP/email.

Типичные сообщения (без PII):

```
[Database] Failed to connect: …
[Database] connection error: …
Deploy aborted at step: …
```

---

## 12. Известные ограничения и технический долг

См. [`docs/archive/issues-2026-08.md`](../issues-2026-08.md).

---

## 13. Правила аудита

### Разрешено на production (read-only / безопасные действия)

- Просмотр публичных разделов: лента, видео, магазин, лендинг клуба, библиотека
- Вход в **выданные тестовые** аккаунты (не admin owner)
- Лайки/сохранения/комментарии **только** на тестовых постах, созданных для аудита
- Просмотр UI на iPhone/Android PWA и desktop
- Запуск `npm run smoke` с локальной машины

### Запрещено или нежелательно на production

- Создание/удаление/редактирование **реальных** постов владельца без согласования
- Массовые запросы к API (нагрузочное тестирование)
- Реальные платежи Prodamus (использовать тестовый аккаунт клуба с `grantClub` от admin)
- Доступ к `.env`, SSH, БД production, S3-ключам
- Деплой (`npm run deploy:web`) без согласования с разработчиком
- Экспорт персональных данных пользователей (email, телефоны, pen pal адреса)

### Рекомендуется для глубокого аудита

- Локальный запуск с `.env.example` + дамп схемы БД без данных
- Code review по архиву и read-only git

---

## 14. Что не входит в пакет (намеренно)

- Файл `.env` и production-пароли
- JWT_SECRET, ключи S3, Prodamus, SMS.ru
- Персональные данные пользователей и платёжные реквизиты
- Полные server logs с IP/email

---

## Контакты

По доступам и вопросам аудита — к разработчику проекта (Иван).
