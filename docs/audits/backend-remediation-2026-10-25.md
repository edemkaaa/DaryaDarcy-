# Backend: локальное исправление аудита 24 октября

Дата: 25 октября 2026. Ветка `feature/stage-one-completion-2026-10-10`.
Это локальная проверка, не отчёт о выпуске на staging и не полная приёмка договора.

Дополнение перед push в Git: frontend-коммит `8f610f6` включён через merge
`f37a7ad`; все53 незакоммиченных локальных файла восстановлены побайтно из
страховочного stash. FE01/FE02 исправления пришли от фронтендера; вручную не
переписывались. Пользователь отдельно разрешил обновить generated API-контракт.
Push не означает выкладку: рабочая БД, флаги, S3 и сервер не переключаются.

Подготовленные отдельные коммиты: c3ef120 (schema/history),6bd59b1 (club filters),
b9341ae (bounded reads),08b1579 (public photo recovery),a0dc077 (library slots),
ca8a032 (generated wire types). Общий прогон после merge сначала получил ENOSPC
при загрузке одного frontend-navigation suite:3179pass/1718skip, это не GREEN
полного прогона. Отдельный повтор navigation/capabilities/client API/tRPC:
71tests pass; проверки типов backend/frontend, backend build и check:api прошли.
Серверная БД при этих командах не используется. SQL-репетиции ниже относятся
к предшествующей проверке тех же backend-байтов на disposable MySQL.

## Что реализовано

- B07: `canBlockAuthor` в жалобах вычисляется для actor/author. Внутренние роли
  не попадают в ответ; блокировка повторно проверяет актуальное право под locks.
- B02: `club.listByCategory` фильтрует рубрику и тег до pagination. Shared alias/
  precedence, numeric offset, strict input, bounded empty response сохранены.
- B06: `admin.paymentsPage`, стабильная пара createdAt/id, страницы за пределами
  legacy50. Расчёты, платежи и выдача подписки не меняются.
- B03: `feed.interactionsForPosts` (до50 ID); `admin.articlesPage` (без sections)
  и `admin.articleDetail` (полный объект/null). Legacy сохранены, consumers
  перечислены в handoff; их retirement ещё не выполнен.
- B04: четыре non-unique индекса миграцией0042; никакой дедупликации данных.
- B05: после отдельного согласования — durable public-photo receipts0043 и
  четыре additive upload/status метода. Новый immutable public-purpose key,
  HEAD/metadata recovery, row-lock checks до intent и перед avatar bind;
  stale operation не перезаписывает новый avatar. Автоочистки/DELETE/cron нет.
  Отвязка actor при retirement не удаляет техническое доказательство/объект.
- B01: подготовлены семь aesthetic-* materialKey в существующем механизме
  library bindings. Registry220 слотов валиден; реальные файлы не перенесены.

## SQL и миграции

Docker Desktop перезапущен по разрешению пользователя. Использовался уже
имеющийся native arm64 mysql:8.4: без pull, named volumes или удаления образов.
БД только loopback/backend_test, owner labels, tmpfs, 512MiB на контейнер.
После проверки четыре собственных disposable контейнера audit/history/canonical/
complete удалены по точным ID после повторной проверки owner/image/loopback/
tmpfs/Mounts=[]; отсутствие ID подтверждено. Тестовые tmpfs-данные не сохранялись.
Удалены0 persistent volumes и0 images. Пустой собственный artifacts-каталог убран.
После согласованного перезапуска Docker прежние локальные контейнеры
`atelier-oct25-test-pg` и `daryadarcy-release-20261023-d39n0a` наблюдаются
остановленными с Exited255; их не удалял и не запускал автоматически.

Первоначальная fresh-схема из42 identities была установлена **до** исправления
канонического журнала. После согласования journal обычный read-only preflight
принял её без переписывания SQL/истории. SHA256 первых42 identities:
`51616035e287f221c633d8c7975fef46229d6fbc4ef1e80e586f85e96469684a`.
Отдельно проверены обычный `db:push`42→43→44 и установка всех44 с нуля.
Финальный preflight после обновления: databaseChecked=true,44 identities,
issues=[],pending=[]. При несовпадении двух explicit connection variables
проверка корректно отказала до подключения; после их согласования прошла.
Исходный candidate installer с pinned42 plan не расширялся автоматически:
его прежнее разрешение не означает разрешения применить новый44 plan.
База с исторической дырой0017–0019 всё ещё отклоняется, не «чинится» молча.

EXPLAIN на10 000 синтетических строк в каждой из likes/saved_posts/post_media:

| Запрос | До: key / estimated rows | После: key / estimated rows |
| --- | --- | --- |
| Свои лайки выбранных постов | null / 9921 | likes_user_post_lookup / 11 |
| Сохранения пользователя по дате | null / 9921 | saved_posts_user_post_created / 10 |
| Медиа поста по sortOrder | null / 9546 | post_media_post_order / 10 |

DDL четырёх индексов ~25,5мс на этой небольшой disposable fixture; это **не**
прогноз времени production DDL или latency приложения. До/после ответы и
исторические дубли совпали. Все четыре новых индекса Non_unique=1. Benchmark
удаляет только свои индексы/строки, чтобы реальные миграции записал мигратор.

В B02 при коррелированном EXISTS(JSON_TABLE) локальная MySQL давала ложный
пустой результат тега. Регрессионный случай сохранён, запрос заменён scalar
COUNT subquery. Точная внутренняя причина оптимизатора не доказана.

## Проверка и границы доказательства

- Общий Vitest:243 suites pass,119 suites skip;3185 tests pass,1718 skip.
  SQL/S3/device/browser opt-in skips не засчитывались как пройденные.
- Новый целевой HTTP/JWT/MySQL/loopback прогон:7 suites /42 tests pass.
  Включает восемь public receipt cases и девять library migration cases.
  Public receipt также прочитан в отдельном процессе после потерянного
  application reply; пакеты300КиБ новых upload методов дошли до валидации400,
  а не ошибочного parser413. Синтетические S3-объекты при проверке не удаляются.
- Дополнительная регрессия прежних upload-disconnect, legacy upload guard,
  authenticated retirement, content deletion, saved pages и moderation:
  6 suites /56 tests pass на одноразовой БД.
- Fresh-install без fixture DDL:9 tests pass,44 history identities, ORM columns
  и native HTTP совместимы. Полный backup/restore нового44-образа здесь не запускался.
- tsc, backend build, boundaries, docs и кандидат API-контракта проверены.
- При разработке сначала воспроизводились RED отсутствующие hints/routes/
  индексы/namespace. Первый полный прогон поймал устаревший ожидаемый перечень
  tRPC; он обновлён с сохранением старых методов, повторный полный прогон GREEN.
  Один подготовительный fresh-run использовал неверный loopback-port и получил
  ECONNREFUSED без записи; после проверки Docker binding повтор прошёл.

S3-wire — собственный локальный HTTP-приёмник с настоящими SDK-запросами, не
Timeweb acceptance. На рабочий сервер, настоящие S3-файлы, БД, пользователей,
админские входы, оплату и почту запросы не выполнялись. Frontend и дизайн не
изменены; push/deploy отсутствуют. Образы, volumes и чужие файлы не удалялись.

## Остаток

1. Фронтендеру повторно проверить принятые FE01/FE02 после выкладки и подключить новые методы вместе с cache/
   invalidation/account-switch logic. [Инструкция](../development/audit-remediation-handoff-2026-10-25.md)
   и [кандидат wire-типов](../development/api-contract-audit-2026-10-25.ts).
2. B01: согласованный реальный импорт220 иллюстраций, оба consumers, затем
   адресное закрытие старых originals/variants/build assets. Пока копии публичны.
3. B03: retirement полных legacy-чтений только после миграции поддерживаемых клиентов.
4. B05: ручная безопасная сборка orphan-объектов не реализована/не включена;
   новые receipts дают доказательство владения, но не разрешение удалять данные.
5. Выпуск миграций/кода/клиента и приёмка на стенде — отдельный разрешённый этап.
   Рецепты/Петербург, бесплатные материалы, закрытые и старые файлы не менялись.
