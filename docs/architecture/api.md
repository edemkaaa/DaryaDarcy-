# API и границы модулей

API построен на Express + tRPC. Точка запуска — [src/\_core/index.ts](../../apps/backend/src/_core/index.ts), состав tRPC — [routers.ts](../../apps/backend/src/routers.ts). Этот документ описывает исходный код, не подтверждает состояние сервера.

## tRPC

Базовый путь: /api/trpc. Имена процедур и типы проверяются [тестом контракта](../../__tests__/trpc-contract.test.ts); полный список не дублируется вручную.

| Область                       | Модуль                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------- |
| Вход, текущий пользователь    | [identity/router.ts](../../apps/backend/src/identity/router.ts)                 |
| Профиль и дополнительные поля | [profile/router.ts](../../apps/backend/src/profile/router.ts)                   |
| Лента                         | [content/feed-router.ts](../../apps/backend/src/content/feed-router.ts)         |
| Статьи                        | [content/articles-router.ts](../../apps/backend/src/content/articles-router.ts) |
| Видео                         | [content/videos-router.ts](../../apps/backend/src/content/videos-router.ts)     |
| Клуб и подписка               | [club/router.ts](../../apps/backend/src/club/router.ts)                         |
| Уведомления                   | [notifications/router.ts](../../apps/backend/src/notifications/router.ts)       |
| Жалобы                        | [moderation/router.ts](../../apps/backend/src/moderation/router.ts)             |
| Администрирование             | [admin/router.ts](../../apps/backend/src/admin/router.ts)                       |
| Почтовое отделение            | [pen-pals/router.ts](../../apps/backend/src/pen-pals/router.ts)                 |
| Магазин                       | [shop/router.ts](../../apps/backend/src/shop/router.ts)                         |

Общие проверки сессии, роли и доступа к клубу находятся в [\_core/trpc.ts](../../apps/backend/src/_core/trpc.ts). Материалы и обсуждения клуба не являются публичными. Блокировка аккаунта и актуальная роль проверяются сервером.

Ручное admin.confirmPost сохраняет ответ {success:true} при повторе и отсутствующем
ID, но анонсирует только свою завершённую публикацию. Транзакция с блокировкой
поста находится в [content/publication.ts](../../apps/backend/src/content/publication.ts).
Подтверждение до scheduledAt разрешено, existing publishedAt сохраняется.
admin.updatePost сохраняет пост и замену видео одной транзакцией в
[content/post-editor.ts](../../apps/backend/src/content/post-editor.ts), с той же
блокировкой поста. Ошибка вложения откатывает весь edit. Поле videos отсутствует —
вложения сохраняются; [] удаляет только видео. Анонс использует сохранённый текст
и аудиторию и возвращается только владельцу перехода в публикацию после commit.
admin.createPost сохраняет новый пост и начальные видео одной транзакцией в
[content/post-creator.ts](../../apps/backend/src/content/post-creator.ts).
Числовой ID возвращается после commit; незавершённый пост невидим читателям и
планировщику. Ошибка видео откатывает весь create, без анонса публикации.
Это не очередь доставки push. Отдельные uploadMedia и legacy-создание тизеров
не объединены с другими операциями. Конфликты версий редактора не выявляются;
повтор createPost после потери ответа небезопасен: новый запрос создаёт новый пост.

## HTTP вне tRPC

- POST /api/auth/register — регистрация через письмо, ответ 202 без сессии.
- POST /api/auth/login, /api/auth/logout, /api/auth/session; GET /api/auth/me — вход и сессия, см. [\_core/oauth.ts](../../apps/backend/src/_core/oauth.ts).
- POST /api/auth/password/request, /api/auth/password/complete; GET /api/auth/password — установка/восстановление пароля.
- POST /api/admin/access-email/resend — повторное письмо администратором. См. [identity/routes.ts](../../apps/backend/src/identity/routes.ts).
- GET /api/launch-config; GET и PUT /api/admin/launch-settings — настройки запуска, см. [launch/routes.ts](../../apps/backend/src/launch/routes.ts).
- GET /api/capabilities — фактические серверные флаги, см. [launch/capabilities.ts](../../apps/backend/src/launch/capabilities.ts).
- Обработчики Prodamus и операций с файлами зарегистрированы в [точке запуска](../../apps/backend/src/_core/index.ts); протокол платежей — [prodamus.ts](../../apps/backend/src/prodamus.ts).

SMS-маршруты существуют, но выключены без ENABLE_SMS_LOGIN=true. Онлайн-оплата магазина и Web Push отключены серверной политикой.

## Платежи и безопасность изменений

Checkout не авторизует пользователя по email. claimPending не выдаёт подписку. Продление и выдача доступа идут через проверенную обработку платежа; подтверждение отмены учитывается отдельно. Состояние платежей, писем и повторных попыток хранится в БД.

[База данных](database.md) · [интеграции](integrations.md) · [инструкция бэкенда](../../apps/backend/README.md). При изменении контракта обновляйте тесты и все затронутые клиенты.
