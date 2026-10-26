# Backend: локальное исправление аудита 24 октября

## Dependency follow-up — 26 октября, локальные исправления

Повторное поручение завершить backend позволило досрочно закрыть серверную
часть dependency follow-up. Исходная база `5263d51`; три отдельных коммита:
`e09b8ce` (Nodemailer), `a27f58e` (body-parser), `bcb0b6c` (Multer).
Настройки SMTP, адресаты, frontend source, рабочие БД/S3 и стенд не менялись.
Нет push/deploy, внешних писем или платежей.

### Что изменено и почему

| Зависимость | Было → стало | Проверка исходной ошибки |
| --- | --- | --- |
| Nodemailer | 10.0.13 → 10.1.4, root и backend | Три synthetic address cases меняли домен SMTP envelope: nested comment, semicolon group comment, quoted localpart с angle bracket. RED3 → GREEN3; streamTransport, без SMTP |
| body-parser Express4 | 1.20.6 → 1.20.9 | Маленький gzip + trailing bytes вызывал необработанную ошибку decoder и завершение отдельного процесса. После обновления процесс жив и health отвечает |
| body-parser Nest/Express5 | 2.3.0 → 2.4.0 | Та же проверка второй реально установленной ветки; RED crash → GREEN |
| Multer в Nest | 2.4.0 → 2.5.0 | Поздний fileFilter callback после teardown приводил к unhandled error. RED crash → GREEN; multipart-маршруты не добавлялись |

Источники: [Nodemailer release](https://github.com/nodemailer/nodemailer/releases/tag/v10.1.4),
[parser advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828),
[Multer advisory](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m).
Перед установкой проверены upstream releases и registry integrity/scripts/engines,
наличие signature/provenance metadata. Криптографическая проверка подписи отдельно
не выполнялась. Lockfile сгенерирован pnpm9.12.0, install scripts отключены.
Транзитивное изменение qs6.16.1 у body-parser2.4.0 принято после проверки diff;
остальные версии не обновлялись массово.

Ранняя общая граница Content-Encoding415 остаётся прежней. Ошибки parser/Multer
воспроизводились только в собственных 96MiB дочерних процессах с маленькими
данными/loopback; это не доказательство эксплуатации текущего публичного API.
Multer handlers приложением не зарегистрированы, его исправление профилактическое.

### Проверки и оставшаяся граница

Целевые серии: Nodemailer35/5files, parser100/8files, Multer57/3files — прошли.
Backend build и tsc прошли после каждого среза. Frozen install со scripts disabled
прошёл без изменения lockfile. API102/42120bytes, docs93 и boundaries773 GREEN.
Первые два общих Vitest:3222pass/1fail/1718skip; единственный fail — таймаут
старого oEmbed body-deadline теста. Отдельный набор55/55 проходил, но общий
сбой воспроизвёлся. Установлена граница: после headers сборщик полагался на
транспортный abort без собственной отмены reader. Два новых теста с зависшим
body и headers до/после deadline стабильно показали RED. Коммит `f3af07d`
добавляет abort listener/cancel, проверку уже истёкшего signal и снятие listener;
оба RED → GREEN, все57collection tests/types/build прошли. Внешний VK не
вызывался, API-контракт/плеер/frontend не менялись. Финальный общий прогон:
**3225passed,248suites,0fail;1718tests/119suites skipped**. Пропуски внешних
проверок не считаются успешной приёмкой. Backend/TEST builds, types и формат
пяти затронутых TS-файлов прошли; новые dependency tests только отформатированы.

Свежие81native HTTP/SQL cases в9suites прошли уже с обновлёнными зависимостями:
registration retry/subscription flow, cancellation pending/confirmed,
moderation locks/audit, content deletion, article consistency, public upload
lost-ACK receipts. Собственный localhost/backend_test MySQL на tmpfs, только
loopback mail/payment/S3 substitutes. Контейнер проверен по owner/image/ID и
удалён; инвентарь других контейнеров совпал, образы/volumes не удалялись.

Повторный native production audit: **9 → 3 advisory**, все шесть серверных
предупреждений отсутствуют. Оставшиеся2critical/1high относятся к Next16.3.8;
audit exit1 сохранён и не назван чистым. Нужен frontend upgrade16.4.1 с
проверкой совместимости, пункт11 единого frontend handoff. SVG allowlist,
отсутствие Server Actions/Cache Components — меры снижения риска, не patched Next.

Не закрыты совместные B01/BE-03/B05 consumers, реальный импорт/отзыв public
visuals и retirement legacy после перехода. Автоочистка не добавлялась.
Артефакты: соседний закрытый `.local-artifacts/backend-security-20261026.NUOh09`,
не Git: audit-before/after, RED/GREEN и full-regression logs, native verification.

## Завершение доступной backend-части — 26 октября

Поручение — доделать backend по аудитам и выдать один документ фронту.
Новых серверных дефектов в проверках ниже не обнаружено; рабочие реализации
повторно не переписывались. Рабочая БД, S3, frontend, настройки и стенд
не менялись. Нет push/deploy/писем/платежей. Это локальная готовность,
а не завершение совместного выпуска/всего договора.

### Свежая проверка на одноразовых БД

Существующий immutable native arm64 mysql:8.4; собственные label/ID контейнеры,
localhost/backend_test, tmpfs512MiB без host mounts. Только loopback S3-wire,
синтетические пользователи и платежные записи; без реальных провайдеров.
Использованы штатные test-schema helpers, не новый прогон всех44миграций.

| Последовательный прогон | Фактически выполнено |
| --- | --- |
| content-write-validation первым suite на пустой БД | 25 passed, 1 файл; TEST-01 не воспроизводится |
| Проекция статей, категории, bounded interactions/articles/saved/members/comments, SQL LIMIT, library migration/read, public receipts, moderation | 139 passed, 14 файлов |
| admin-payments-page отдельно | 6 passed, 1 файл |
| Все220реальных подготовленных иллюстраций через SQL/API/локальный wire | 1 passed, 1 файл |
| Итого | 171 passed, 17 файлов, 0 failed, 0 skipped, все exit0 |

Первый список команды содержал неверное имя payments-page.mysql.test.ts;
Vitest выполнил14файлов вместо15. Расхождение замечено, настоящий
admin-payments-page отдельно запущен и прошёл6тестов. Итог содержит только
реально выполненные проверки. Проверены owner/name/image/tmpfs/Mounts=[],
удалены только три собственных --rm контейнера. Прочие контейнеры, образы,
volumes сохранены. Диагностических процессов в живом API не запускали.

### Реальные иллюстрации: найден и устранён локальный блокер подготовки

Четыре исходных WebP содержали EXIF, и строгий импорт правильно их отклонил:
castlecore/outfits/outfit3, darkacademia/outfits/outfit13,
witchcore/outfits/outfit10 и witchcore/outfits/outfit14 (lossless variants).
Валидация не ослаблена. Созданы отдельные копии без метаданных; raw RGBA bytes,
размеры и alpha совпали. SHA всех220оригиналов сохранены, public не редактирован.

Все7manifest/220files прошли inspectLibraryMigration, каждый namespace≤50.
Registry SHA256: `5e6429281020715866f0e572de26cfd20491a83cd6b0b00e8546e45f4682967f`.
Есть operator input с source/prepared SHA и путями к копиям. Полная репетиция:

- Потерян первый PUT ACK → восстановление, все7операций committed.
- Ровно220объектов/PUT/bindings; повтор manifest не создаёт копий.
- Admin/member list200, полные7материалов без скрытой второй страницы.
- Участник получает все220файлов, SHA HTTP-body совпадает, no-store соблюдён.
- Гость и user без подписки получают404 на7списков и все220direct URLs.
- После окончания синтетического доступа прежние220URL тоже дают404.

Это настоящие SQL/HTTP/SDK bytes с локальной имитацией S3, **не** Timeweb ACL
или production импорт. Начальный helper не запустился из-за CJS/ESM import;
после исправления запуска выявлен EXIF. Неуспешные проходы не считались GREEN.
Артефакты вне Git, права700/600: родительский
`.local-artifacts/backend-audit-finish-20261026.yqS3vS` — native logs/results,
private-visual-copies, visuals-operator-input.json, visuals-result.json,
real-visuals-result.json и воспроизводящие helper scripts.

### Передача и точный остаток

Один актуальный документ: [frontend-audit-final-handoff-2026-10-26.md](../development/frontend-audit-final-handoff-2026-10-26.md).
Контракты, порядок перехода и проверки в нём самодостаточны.
Backend build, tsc --noEmit, check:api102/42120bytes и check:docs93 прошли,
git diff --check без ошибок. Продуктовые API/типы не менялись.

Дальше нужны frontend consumers, затем retirement старых методов;
согласованный реальный импорт220bindings/копий и совместный выпуск обоих
экранов, затем адресное закрытие public copies. До этого BE-03/FE-03/INT-04
целиком не закрыты. Новых API ради отчёта не добавляли; автоочистку не включали.
Dependency follow-up27октября и внешняя приёмка остаются отдельными пунктами.

## Повторное чтение трёх исходных аудитов —26октября

Запрос пользователя — повторно посмотреть аудит, не реализовать или выложить
очередные правки. Прочитаны все находки FE-01…07, BE-01…07, INT-01…05,
TEST-01 и ограничения проверок из файлов23октября/be029ed. Приложения с
реестрами файлов не выдаются за новую построчную ревизию каждого файла.
HEAD и remote refs/heads/staging совпадают:093bdcb; незакоммиченные документы
предыдущего прогона сохранены. Код, frontend, настройки, БД и S3 не менялись;
push/deploy/письма/платежи/живые записи не выполнялись.

| Исходный пункт | Текущая оценка | Доказательство и граница |
| --- | --- | --- |
| BE-01, moderator→admin/self/staff | Исходная ошибка исправлена | platform-db вызывает lockUserModerationTarget до block/unblock. Актуальные роли под row locks в порядке ID, self запрещён, moderator только→user. Реальная HTTP/SQL матрица подтверждена предыдущим сегодняшним81-test прогоном; в этом повторе она не запускалась заново |
| BE-02 / INT-02, бесконечный public PUT | Сетевая часть исправлена | Свежие3loopback теста: зависший PUT завершается примерно10s без второго запроса, S3/Forge отменяются. AbortSignal/deadline/maxAttempts1/destroy есть в коде. Не обещание полной обработки фото за10s; receipt consumer/ручные orphan-процедуры отдельно |
| BE-03, неограниченные чтения | Частично, остаётся | savedPostsPage/membersPage/commentsPage уже реализованы и используются актуальным frontend. VK catalog bounded. Но legacy feed.list/savedPosts/comments/admin members остаются доступны; текущий frontend всё ещё читает полные feed.userInteractions и admin.articles. Готовы interactionsForPosts до50ID, articlesPage/detail; требуется переключение consumers и затем retirement, без тихого truncate. Старый YouTube repository/маршрут в mixed-compatible коде также ещё существует; не объявлять его удалённым |
| BE-04, unavailable выглядит empty | Найденные чтения исправлены | Свежие11availability +40read-error tests:503 при отсутствующей БД и отказ при SQL/media ошибке, recovery после ошибки. Здоровые empty/not found не меняются |
| BE-05, полные sections ради публичных карточек | Исправлено в коде | ContentReadService.listArticles вызывает listPublishedArticleCards с явными4колонками, без sections. SQL projection proof уже описан в отчёте23октября, в этой сверке SQL не повторяли. Полный admin list остаётся отдельным BE-03 |
| BE-06, недостающие индексы | Реализовано и ранее выпущено | schema/0042 содержат likes(userId,postId), два saved_posts owner indexes и post_media(postId,sortOrder). EXPLAIN/ночная установка44history описаны ниже. Не делали новый production EXPLAIN/DDL или дедупликацию в этом повторе |
| BE-07, crash при разрыве upstream | Исходная ошибка исправлена | Свежие2изолированных Node/loopback теста: разрыв источника и получателя не завершают API, upstream закрывается; pipeline/abort/finally присутствуют. Это старый YouTube fallback, не причина/доказательство исправности внешнего VK-плеера |
| TEST-01, зависимость content validation от порядка SQL suites | Fixture исправлен в коде | Suite теперь openContentTestDatabase + CREATE articles перед cleanup. Исторические25ошибок не считать25текущими дефектами API. Новый standalone SQL-прогон в этой сверке не проводился |

### Что остаётся между готовым backend и frontend

- FE-02/INT-05: listByCategory реализован, но ClubSubscribed всё ещё читает
  club.list без category/tag и догружает пустой локальный фильтр. Полный polling
  архива уже исправлен useCursorPages: обновляется только голова, старый тезис
  о повторе всех сохранённых страниц устарел.
- FE-03/INT-04: публичный клубный visual всё ещё доступен. Свежий anonymous GET
  к /assets/results/cottagecore/moodboards/moodboard1.webp:200,image/webp,63044bytes.
  Защищённые slots готовы, но реальные bindings/оба consumers/старые копии ещё
  не переключены. Бесплатные материалы и обложки не относятся к закрытию.
- Новые public avatar/cover receipts готовы, но текущие use-profile-avatar и
  articles-admin ещё вызывают legacy uploadAvatar/uploadPhoto. Deadline не равен
  восстановлению результата потерянного ответа. Автоочистку не включать.
- FE-01/04/05/06/07 и INT-01/03 исправлены в текущем коде;
  [точная таблица статусов и границ](../development/frontend-audit-remediation-2026-10-23.md).
  Не поручать повторное исправление старых строк без воспроизведения.

### Свежая проверка в этой сверке

Один worker, санитарное окружение без рабочих credentials/БД;9файлов,
**114passed,0failed,0skipped**,exit0,14.51s:
public-storage-lifecycle3,post-media-read-errors40,youtube-stream-lifecycle2,
content-read-availability11,trpc-batch-admission3,frontend-media-safety23,
frontend-navigation-intent27,frontend-cursor-pages4,staff-role1.
Провайдеры только loopback/моки; рабочие БД/S3 не подключались. Это не новый
браузерный прогон cropper/NORMAL/renewal и не production отказ БД.

Свежие anonymous GET /privacy200 и /privacy.html200: обе содержат
daryadarcy19@gmail.com, старого daryadarcyapp@yandex.ru нет. Тем самым FE-07
устарел и на стенде. Изображение проверено одним read-only GET, без файловых
операций S3. Свежий check:api прошёл:102процедуры,42120bytes,exit0; старые90 —
историческая цифра. check:docs прошёл для92документов, git diff --check без ошибок.

Нет основания объявлять исходный аудит целиком закрытым. Приоритет — платные
публичные иллюстрации, server-side club filters, переход на bounded reads и
public receipts; отдельно ранее найденные VK controls/оглавление/счётчики.
Реальные оплаты/SMTP/device/PWA/pilot и отложенные большие файлы не становятся
принятыми из-за114локальных тестов. Старые49frontend failures нельзя суммировать
с текущими дефектами: сам аудит содержит классификацию fixtures/режимов/timeout.
Скан зависимостей из исходного аудита не заменён этим прогоном; поздний
dependency-follow-up27октября остаётся в действующем плане.

## Исторический протокол25октября и последующего выпуска

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
