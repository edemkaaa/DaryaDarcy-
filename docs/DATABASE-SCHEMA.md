# Database Schema (без персональных данных)

Engine: **MySQL 8**, charset **utf8mb4** (колонка `posts.text` — обязательно utf8mb4 для emoji).

Источник истины: `drizzle/schema.ts`, миграции: `drizzle/*.sql`.

## Таблицы

### users
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| openId | VARCHAR(64) UNIQUE | Внутренний ID auth |
| name | TEXT | *PII — не включать в дампы для аудита* |
| email | VARCHAR(320) | *PII* |
| phone | VARCHAR(16) UNIQUE | *PII* |
| passwordHash | VARCHAR(255) | Хеш, не plaintext |
| loginMethod | VARCHAR(64) | email / sms / … |
| gender | ENUM | female, male |
| avatarUrl | TEXT | URL S3 |
| role | ENUM | user, admin |
| createdAt, updatedAt, lastSignedIn | TIMESTAMP | |

### posts
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| text | LONGTEXT | Текст поста (utf8mb4) |
| photos | JSON | Массив URL |
| tags | JSON | Slug тегов |
| source | VARCHAR | instagram, telegram, manual |
| instagramId | VARCHAR | Shortcode / tg-id |
| sortOrder | INT | Сортировка ленты |
| published | BOOLEAN | Legacy |
| status | ENUM | draft, scheduled, published |
| target | ENUM | feed, club, both |
| scheduledAt, publishedAt | TIMESTAMP | |
| richText | JSON | Форматированный текст |
| createdAt, updatedAt | TIMESTAMP | |

### post_media
Видео/аudio/документы к постам (postId, type, url, filename, …).

### tags
Справочник тегов (slug, label, category: season|topic, sortOrder).

### likes, saved_posts
userId + postId (без текста PII в связях).

### videos
YouTube imports (youtubeId, title, thumbnailUrl, sortOrder, published, …).

### articles
Статьи библиотеки (title, content, locked, sortOrder, …).

### club_subscriptions
Подписки клуба (userId, status, expiresAt, prodamusSubscriptionId, …).

### club_payments
История платежей (userId, orderId, amount, status, …) — *PII через userId*.

### post_comments
Комментарии клуба (postId, userId, text, …).

### pen_pal_profiles, pen_pal_shown
Профили «Почтового отделения» — **содержат адреса (PII)**, не экспортировать.

### push_tokens
Expo push tokens (token, userId?, platform).

### sms_codes
OTP коды (phone, code hash, expires) — *PII*, не экспортировать.

## ER (упрощённо)

```
users ──┬── likes ── posts
        ├── saved_posts ── posts
        ├── club_subscriptions
        ├── club_payments
        ├── post_comments ── posts
        └── pen_pal_profiles

posts ─── post_media
tags (reference) ← posts.tags (JSON slugs)
videos (standalone)
articles (standalone)
```

## Получить только схему (без данных)

```bash
mysqldump --no-data -u user -p database_name > schema_only.sql
```

Для аудита достаточно файлов в `drizzle/` + этот документ.
