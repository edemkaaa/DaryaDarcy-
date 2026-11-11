# Редакторы, админка и таблицы: проверка 29–30 октября

Поручение владельца: проверить действия админки, конфликты, потерю ответа,
сохранность ввода и запись таблиц. Только свои временные данные; frontend source,
существующий контент и админские входы сохраняются. Строгий content-режим не включать.
Исходная локальная версия d50ff29a; код стенда 681bcec5.

## Итог локальных проверок

| Уровень | Результат и ограничения |
| --- | --- |
| Unit | 3667 pass,78skip. В том числе HTTP-границы сервисов; это не подмена SQL |
| Полный MySQL | 1511 pass,299opt-in skips,93passed/22skipped files. Своя loopback/tmpfs MySQL8.4, последовательные suites; внешние провайдеры и рабочая БД не используются |
| Свежая схема | Штатный fresh installer применил48 миграций без pending. 40 прикладных таблиц + __drizzle_migrations; имена/SQL-типы/nullable всех колонок совпали с Drizzle |
| Сквозной HTTP на свежей схеме | 466 проверок. Настоящие Nest/tRPC/JWT/SQL, два синтетических администратора и участница. Согласованность данных и связанных удалений, отсутствие изменений в посторонних таблицах |
| Browser текущего клиента | 171pass/3fail из174 Chromium сценариев на production-сборке. API синтетический, реальная SQL проверяется отдельными слоями выше; это не приёмка физических устройств |
| Диагностика трёх browser-отказов | Изолированная копия тестов с актуальными fixture/ожиданием безопасного отказа:3pass. Основные frontend файлы не менялись, исходные3fail не названы зелёными |
| Сборка и контракты | Root/frontend/E2E types, lint, API105, boundaries854, backend/Prodamus TEST bundles прошли |

## Живой стенд и рабочая БД

После fresh backup41 таблицы и проверки SHA второй копии на Mac выполнены
18 HTTPS-проверок на настоящем стенде. Созданы только два временных admin-fixture
без пароля и короткие5-минутные сессии; существующие три администратора не менялись.
Один временный пост и одна статья оставались черновиками: публикаций, файлов,
уведомлений, писем и платежей не было. Четыре успешных ответа намеренно отброшены
после commit: create/update поста и статьи. Те же ключи вернули прежние ID,
проверки конфликтов второго администратора409 и чтение после потери ACK прошли.
Черновики, их creation/recovery journals и два тестовых аккаунта удалены.

Первая попытка article-probe использовала не-UUID ключ и корректно получила400
до создания статьи; свою проверку исправили на UUIDv4, runtime не меняли.
Очистка первой попытки подтверждена отдельным read-only inspect:0fixture users,
0posts,0articles. Между контрольными точками лайки5→4 и сохранения4→5 изменились
параллельно вне этого probe; наши сценарии не вызывают reaction mutations.
Изменения не откатывались. Сделаны новая контрольная копия и повторный полный
прогон. В финале39 других таблиц совпали, хеши обеих reaction tables также
совпали с новой точкой; все41 схемы/индексы и3admin credential hashes сохранены.
Strict остался false, код/образы сайта не перевыкладывались.

Затем отдельный read-only scan настоящей БД:40 прикладных таблиц+ledger,
все358 колонок (имя/SQL-type/nullable) совпали с моделью, история48.
29 проверок целостности дали0 нарушений: родительские ссылки media/comments/
likes/saved/reports/payments, reply→тот же пост, article teaser, активные private
привязки и enabled Library assets, etag готовых объектов, дубли реакций и
нормализованного email, contactPhone обоих хранилищ, неотрицательные версии,
дата scheduled и срок paid. Запросы выполнялись в read-only транзакции,
значения персональных полей не выводились. Это проверка перечисленных
инвариантов, не утверждение о ручной проверке каждого пользовательского текста.
Исторические creation receipts могут переживать удаление родителя по контракту;
они не объявлялись ошибочными «сиротами» и не чистились вне своих fixtures.

Закрытые доказательства: editor-live2-backup.json/editor-live2-before.sql.gz,
editor-live2-result.json и db-quality-20261030.json в каталоге предыдущего выпуска
phone-merge-release-20261029-f8b0bbef на сервере и Mac. SHA256 свежей второй копии:
`c6607220a1b531788f6f29924d0d931e4c431ed84340bb55d4ed59dd8cba82f3`.
Секретные dump/env в архив для DevOps не входят. Исходные backup и старые образы сохраняются.

Финальный read-only status: API/TEST/web на прежних принятых images, healthy,
OOM=false/restarts0; три администратора,48ledger,0fixture users,strictOFF.
Результат admin-final-status-20261030.json сохранён закрыто.

## Что проверено в редакторах

- Полный и быстрый пост: исходная версия,409/412, две вкладки/два администратора,
  сохранность текста и вложений после reload, ручное сравнение/повтор, смена аккаунта.
- Создание поста и статьи после потери ответа: тот же ключ возвращает прежний ID,
  строки и журналы не дублируются. Отредактированный текст не откатывается replay.
- Потеря ответа после update: успешный ответ намеренно отбрасывается после
  настоящего commit; повторное чтение подтверждает результат. Устаревшая версия
  не может перезаписать более новый текст.
- Статья: заголовок/блоки, draft/published/access, синхронизация ровно одного
  клубного анонса после публикации, отсутствие анонса у черновика.
- Пост: draft/scheduled/published, scheduledAt/publishedAt, календарь, ручное
  подтверждение публикации; поля статуса согласованы с SQL.
- Удаление статьи убирает её анонс, комментарии, жалобы, лайки и сохранения;
  удаление поста убирает связанные post_media. Replay старого create не воскрешает
  удалённый пост: штатный контракт возвращает первоначальный ID без нового INSERT.
- UTF-8 пределы и некорректные входы, отзыв роли/блокировка сессии, атомарный отказ
  при ошибке дочерней записи, приватные receipt/bind/recovery сценарии.

## Карта действий админки

| Раздел | Проверенные пути | Доказательства |
| --- | --- | --- |
| Посты | Создание/ключ повтора, полный detail, изменение текста/фото/порядка/вложений, черновик/план/публикация, confirm/delete | content-edit-conflicts, post-creation-idempotency, nest-admin-content, manual-publication, nest-content-deletion, post-video-reconciliation + browser |
| Статьи | Create/status/replay, detail/страницы, блоки/access/published, конфликт, teaser/unpublish/delete | nest-admin-articles, article-creation-recovery, admin-article-page + browser |
| Календарь/статистика | Ограниченные страницы, период, counts/статусы/даты и повторное чтение после действий | admin-statistics/admin-post-page-input и native content reads; admin-paged-reads/admin-statistics browser |
| Участницы | Безопасные поля и contactPhone, страницы/expiry, ручная выдача, block/unblock с отзывом сессии/аудитом | members-page, admin-membership-reads, club-grants, moderation-user-audit; admin-action-results browser |
| Жалобы/комментарии | Список, dismiss/delete, права moderator/admin, атомарный audit и очистка связей | moderation-report-audit/moderation-comment-audit и comment suites |
| Оплаты | История/страницы/статусы/сроки, синтетический grant, повтор/отмена и роль | admin-payments-page, registration-subscription-flow и billing suites; реальные списания не выполнялись |
| Сезоны/почта менеджера | GET/PUT, четыре набора, revision/CAS, конфликт, отказы и сохранность ввода | launch-settings.mysql и club-seasons browser; рабочие настройки не менялись |
| Видео | Импорт/валидация/пагинация/порядок, транзакционный rollback и повтор, VK metadata/обложки | video/bulk import/publication/VK suites; не новая приёмка внешнего playback всех22 |
| Загрузки | Receipts/status/привязки/повторы/отказ/роль/вложения в полном и быстром редакторах | private/public photo/media SQL и admin-attachments/post-upload-recovery browser. Opt-in реальные S3 suites не включались |
| Служебные операции | Границы cleanupMediaNames/deleteMedia/purge push, авторизация/отказы | maintenance/notifications/retention suites. Рабочая автоочистка и выключенные функции не включались |

Проверка API-действия не означает, что все выключенные возможности или внешние
провайдеры стали рабочими. UI-экспериментами на существующем контенте это не заменялось.

## Таблицы и правильность записи

Проверены все40 прикладных таблиц по схеме, а бизнес-операции — по применимым
наборам. Не требуется искусственно создавать данные в каждой выключенной функции.

| Группа | Таблицы |
| --- | --- |
| Контент/повторы | posts,post_media,articles,post_creation_requests,article_creation_requests,content_recovery_markers,tags,videos |
| Вложения/библиотека | private_attachment_uploads,private_content_files,library_file_bindings,library_file_migrations,public_photo_uploads |
| Реакции/обсуждения | likes,saved_posts,post_comments,comment_creation_requests,comment_likes,comment_reports |
| Идентичность/аудит | users,password_tokens,user_consent_events,admin_audit_log |
| Подписка/письма | club_payments,billing_checkout_intents,normal_checkout_requests,billing_receipts,billing_profiles,member_email_bindings,member_email_binding_outbox,access_email_outbox |
| Настройки/магазин | launch_settings,shop_purchases,shop_delivery_emails |
| Выключенные возможности | push_tokens,push_consent_events,pen_pal_profiles,pen_pal_shown,pen_pal_matches,sms_codes |

Проверены нормализованный contactPhone у пользователя и снимок в club_payments,
без изменения auth phone; точные строки и дочерние связи после CRUD, недублирование
журналов, отказ при stale version, rollback, удаления и отсутствие посторонних
mail/receipt/token записей. На свежем HTTP-цикле отдельная проверка counts всех
не затронутых операциями таблиц прошла. Схема/история свежей БД не подменяет
проверку фактического наполнения рабочей БД; серверная сохранность фиксируется отдельно.

## Что исправлено в проверках

Первый полный SQL-прогон:5fail/1506pass. Четыре ожидания старого состава полей
не учитывали уже согласованный contactPhone, а один NORMAL fixture не передавал
обязательный номер. Обновлены только test inputs/ожидания; отдельно50pass,
добавлены точные SQL assertions contactPhone у пользователя и заказа.

Во втором полном прогоне обнаружен нестабильный SQL barrier старого bulk import:
InnoDB может ждать на первом INSERT в том же unique-index gap, а тест считал
только второй INSERT общего элемента. Теперь наблюдаются оба реальных INSERT
синтетической партии до снятия барьера. Assertions победителя/полного rollback
проигравшего и безопасного повтора сохранены. Третий полный прогон1511pass.
Продуктовые SQL/транзакции ради теста не менялись.

Первый дополнительный fresh probe ошибочно ожидал ошибку replay удалённого поста.
Сверка контракта показала возвращение прежнего ID без воскрешения; probe исправлен
и заново прошёл. Первоначальный неуспех не выдаётся за дефект приложения.
Все собственные локальные MySQL-контейнеры/tmpfs/env удалены; OOM=false,
образы/базы других проектов не удалялись.

## Остаток фронтендеру

1. editor-safety.spec.ts:316 не задаёт admin.postDetail. Возвращать тот же полный
   synthetic post; тест сейчас падает до проверки сохранения/загрузки.
2. post-draft-recovery.spec.ts:91 — quick undefined/null media. Клиент уже
   безопасно отклоняет некорректный detail до открытия формы. Проверять отказ,
   ноль writes/отсутствие editor, затем восстановить полноценный media response
   и повторно открыть; не возвращать прежнее небезопасное открытие формы.
3. session-safety fixture launch-config из предыдущего handoff остаётся отдельным.

[Единый документ фронтендеру](../development/frontend-audit-handoff-2026-10-27.md)
обновлён. Strict OFF сохраняется; полный remote CI и физические устройства не приняты.

## Docker-пакет

[Инструкция и файлы сборки](../../infrastructure/build/README.md):
явные build-time флаги Next, API+TEST bundle, versioned build-only Compose,
image-only runtime overlay и безопасный порядок backup/migration/rollout/rollback.
Четыре build-contract проверки и пять существующих Compose merge проверок прошли;
build --check API/web/legacy-video прошёл без предупреждений. Новые полные Docker-образы на
native amd64 builder ещё не собраны/не запущены: на Mac около1,6GiB диска,
на рабочем сервере сборка не выполнялась. Это явно оставленный gate DevOps,
не утверждение о завершённой production сборке. Текущие сервисы не перевыкладывались.

## Артефакты и границы

Закрытый локальный каталог `.local-artifacts/admin-acceptance-20261029-936e95ab`
родительского workspace: fresh-install/fresh-report/fresh-cleanup и исходные логи,
три диагностические копии browser-сценариев. Доступ к нему не требуется приложению.
Архив для DevOps содержит только инструкции/конфигурации без секретных env или БД.
Нового push/deploy и включения строгого режима нет.
