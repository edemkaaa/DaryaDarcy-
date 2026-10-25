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
Повторный полный последовательный прогон после исправления условий запуска:
244suites pass/119skip,3207tests pass/1718skip. Это GREEN локального default
Vitest; opt-in SQL/S3/browser/device skips по-прежнему не сквозная приёмка.

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

## Подготовка разрешённого выпуска — ночь 25–26 октября

Пользователь разрешил узкую security-правку, очистку только собственного кэша и
обновление staging с сохранением БД, администраторов, backups и rollback images.
Код выпуска: `35574446fc21c5bd72e520c5bf232d1b3ca3f53a`, normal push и exact
remote SHA проверены. Компоненты/дизайн/frontend config/public assets не менялись.

- GHSA-27r3-jxmh-p828: глобальная HTTP-граница теперь отвечает 415 до любого
  JSON/raw/form parser для Content-Encoding, отличного от identity. Обычные
  запросы и callbacks без сжатия сохранены. Это workaround, не обновление
  body-parser. Безопасные gzip fixtures проверены только локально/изолированно;
  аварийный payload на живой API не отправлялся.
- GHSA-mrhx-c7xc-m3w5: Zod 4.2.1 → 4.6.6, frozen install с отключёнными scripts.
  RED: массив из 1000 недопустимых элементов создавал 1001 issue; GREEN: одна
  ошибка размера до обхода элементов. Lockfile manager-generated; сопутствующие
  peer Zod 4.6.7 и optional terser→acorn 8.19.0 просмотрены, общий build/test GREEN.
- Финальная полная регрессия: **245 suites /3217 pass/1718 opt-in skips**.
  Первый прогон имел одну устаревшую проверку compressed fallback; контракт
  изменён намеренно на 415 до auth/SQL/S3, целевой35 и полный повтор GREEN.
  Types/E2E types, API102, lint, boundaries773, docs92, backend/TEST builds GREEN.
  Frontend production29 routes: прежние пять public flags и VK thumbnails=true.
- Удалены только webpack caches текущей сборки, её успешного повтора и собственной
  предыдущей release-копии. Изображения/базы/backups/rollback images не удалялись.

### Dependency audit: не объявлять чистым

После исправления остаются **9 advisory:2 critical/4 high/3 moderate**.
Проверка reachability и компенсирующих мер обязательна на каждом новом образе;
следующий review — **27 октября 2026**, до добавления новых upload handlers,
Server Actions или Cache Components. Обновление Next отдельное, не выполнено.

- [Next SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw): официальный
  workaround sharp>=0.35.5; native probe всех трёх образов подтвердил 0.35.5.
  dangerouslyAllowSVG=false и ограниченный image allowlist сохранены.
- [Next cache](https://github.com/advisories/GHSA-673q-mjm6-r5xr): Cache Components
  выключены, use-cache функций нет. [Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r)
  не используются, compiled server-reference manifest пуст. Это не исправленная
  версия Next и не разрешение впоследствии включить эти возможности.
- [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828): обе версии
  прикрыты общей ранней границей; Nest defaults отключены (bodyParser:false).
- [Multer](https://github.com/advisories/GHSA-q7qp-rjg7-q26m): multipart/fileFilter
  и Multer interceptors в приложении не зарегистрированы; используется raw/JSON.
- Три moderate Nodemailer остаются задачей отдельного совместимого обновления;
  почта, адресаты и отправка в этом выпуске не менялись и не проверялись письмом.

Перед переключением: native dependency checks3, offline API6, offline web7,
read-only migration preflight42→44, candidate HTTP13. Проблемы подготовки
(700 на bind-mounted каталоге исходников; неверное ожидание items вместо posts
в operator probe) исправлены только в закрытых инструментах, не в API-контракте.
Backup40 tables/487641 bytes проверен gzip+SHA на сервере и Mac; сохраняется
в закрытом release-каталоге вне Git. Финальный исход выкладки фиксируется ниже.

## Выпуск подтверждён — 26 октября

- На `daryadarcy.dev.reeskeen.ru` установлены API/web/restricted TEST из source
  `35574446fc21c5bd72e520c5bf232d1b3ca3f53a`. Frontend BUILD_ID
  `SN4xEtOjIl5Jj1Va1EJJH`. Новый API image `sha256:eff783b83a5f49c5b21e78a4a9a1ea2c5a5a2ecf6511f0ec725155ce4eea59b0`,
  web `sha256:a2cb8dc8d95eef2ef5a5ab140493ed62631ad9740d916277228f4fccb3bdeadc`,
  TEST `sha256:1ae44a24235c39f370b8f3b9f2859ca7e0321d790d5ad828d4fe65238a025804`.
- Нормальный Drizzle migrator применил только0042/0043 после exact-history
  preflight и проверенного backup. История44 сопоставлена по hash/timestamp;
  все4индекса присутствуют, public_photo_uploads создана пустой. Старая история
  не переписана, текущая БД не заменена, reverse migrations/restore не было.
- До переключения новые receipts/status и остальные чтения проверены15HTTP
  cases на новой схеме. После переключения15live cases подтвердили bounded
  pages, missing detail/status, club category, reactions empty, guest401,
  gzip415. Проверки выполнялись в отдельном192MiB контейнере без WorkerJobs,
  не дополнительным Node-процессом в live API256MiB. Нагрузочные лимиты не менялись.
- В финальной проверке **actual runtime bytes** API совпали, TEST — нет:
  readonly mount указывал на release-pagination-20261023, маскируя новый image.
  До объявления успеха изменён только PRODAMUS_TEST_BUNDLE на новый versioned
  файл в том же защищённом release-каталоге. Старый файл не перезаписан/не удалён.
  Повторно пересоздан только TEST, nginx reload обновил upstream DNS. Все
  остальные Compose поля/egress/flags/resources сохранены. Это штатное
  завершение artifact rollout, не новый checkout или изменение провайдера.
- TEST5: два запрещённых GET404 и три encoded POST415 на разрешённых
  transport paths; ни checkout, ни webhook не принят. Оба actual runtime
  bundles теперь побайтно совпали с release manifest (docker cp, без Node
  внутри live API). Все3сервиса healthy/restart0/OOM=false.
- HTTPS64:8страниц, capabilities/auth, guest denials, gzip415,22VK cards/22image
  responses, VK embed contract и26compiled JS SHA exact. Это не физическое
  воспроизведение22роликов, звук или device acceptance.
- Браузер после reload сохранил действующую admin session;932posts/929published/
  1scheduled/2drafts, обе статьи, календарь и чтение раздела оплат доступны.
  Формы записи/удаления/платежа не отправлялись. Обычный response compression
  не отключался: ограничение касается только encoded request bodies.
- Финально: прежние40таблиц/колонки и все их существующие строки сохранены,
  кроме штатных users.lastSignedIn/updatedAt при authenticated GET. Новые
  migration rows исключены из сравнения старого row digest и проверены отдельно.
  Парольные hashes/роли/sessionVersion/профили/аватары/3администратора сохранены.
  Остальные27container identities/images/start times прежние. Существующие
  S3-объекты и приложение/провайдер flags не менялись.

Backup40tables/487641bytes/SHA
`ec4333ad6b1c9758f8c1858d43a67deed6ee961e26dc0c895881cc2c880c1177`
сохранён на сервере и Mac, gzip completion проверена. Все3rollback images
доступны. Два temporary env файла с копиями credentials удалены; закрытые
backups/before-config snapshots сохранены. Никаких image/volume/DB prune нет.

Code-only rollback подготовлен в закрытом операторе
`/home/edem/apps/daryadarcy-staging/release-secure-20261025.DTNjvn/release.py rollback`.
Он проверяет отсутствие более позднего config drift, возвращает прежние три
image pins и старый TEST bundle pointer, пересоздаёт только три сервиса и
reload nginx. **SQL не восстанавливается и additive schema44 остаётся.**
Этот rollback не запускался; проверен разбор/guards, не приёмка downtime/restore.
Доказательства и backup локально: `.local-artifacts/staging-secure-20261025.jKhrNV`
рядом с репозиторием, не в Git. Остатки B01/B03/B05/реальные оплаты/большие
вложения/devices/pilot и9dependency advisories не объявляются закрытыми выпуском.
