# Интеграции

| Сервис | Назначение | Где в коде | Секреты |
|--------|------------|------------|---------|
| **Timeweb MySQL** | Основная БД | `server/db.ts`, `DATABASE_URL` | Не передаются |
| **Timeweb S3** | Фото, аватары, медиа | `lib/s3.ts`, `S3_*` env | Не передаются |
| **Timeweb VPS** | Хостинг API + nginx | `tooling/scripts/deploy-*`, PM2 | SSH — отдельно |
| **SMS.ru** | OTP вход по SMS | `server/sms.ts` | `SMSRU_API_ID` |
| **Prodamus** | Оплата подписки клуба | `server/prodamus.ts`, `club.createCheckout` | Webhook secret |
| **YouTube** | Импорт/превью видео | `server/youtube.ts`, `/media/yt-thumb/` | Публичный API |
| **Instagram (legacy)** | Импорт постов | `tooling/scripts/import-instagram.ts`, JSON backfill | Нет API в prod |
| **Expo Push** | Push-уведомления | `notifications.registerToken` | Expo credentials |
| **Google Fonts** | EB Garamond и др. | `app/_layout.tsx`, web | Публично |

## Потоки данных

### Авторизация SMS
Клиент → API → SMS.ru → пользователь вводит код → JWT cookie/Bearer.

### Оплата клуба
Клиент → `club.createCheckout` → Prodamus → webhook → `club_subscriptions` обновляется.

### Медиа
Upload (admin) → API → S3 → URL в `posts.photos` / `post_media`.

### YouTube
Admin добавляет youtubeId → превью через proxy `/media/yt-thumb/:id/:quality.jpg`.

## Что не используется в production

- TiDB (старая БД, недоступна)
- Instagram oEmbed (блокируется с VPS)
