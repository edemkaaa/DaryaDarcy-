# Передача изменений бэкенда фронтендеру

## 20 октября — logout и nullable admin detail, локально, ещё не dev

- REST `POST /api/auth/logout` и tRPC `auth.logout` сохраняют `{success:true}`,
  но до очистки cookie отзывают **все сессии текущего аккаунта** через существующий
  sessionVersion. Новых таблиц/миграций нет. Выбор доверен пользователем;
  это не точечный выход одного устройства. Другие аккаунты не затрагиваются.
- Повтор старого logout после потери ответа не отзывает новый login. Отсутствующая,
  недействительная или уже отозванная сессия допускает идемпотентную очистку cookie.
  Инфраструктурная ошибка проверки/записи — не успех: REST503, tRPC500 с generic
  error, без clear-cookie; клиент не должен выдавать это за подтверждённый отзыв.
- `admin.postDetail({id})` по-прежнему возвращает full post/media либо null;
  теперь null присутствует и в серверном, и в штатно сгенерированном клиентском
  типе. Missing post не стал404, формат успешного объекта не менялся.
- Проверено локально:58 native HTTP/JWT/SQL без skips,55 focused и2654 full
  regression pass. Это не выпуск: работающий dev остаётся RELEASE-D7.
- Upload availability и платная Библиотека не закрыты этими исправлениями.
  Точный остаток и безопасная очередь — в начале [чек-листа](../../tasks/todo.md).

## 19 октября — RELEASE-D4, актуальный staging и dev

Code/runtime `b7d7338`: свежий frontend9e933d2 сохранён, AUTH-S2/VCAT-C1 включены
в выпуск. Generated API types синхронизированы, API86/32138 проходит. Normal push
в staging и image-only обновление dev выполнены. Реальные HTTPS checks20 и CUA
videos20 cards pass, прежний admin password сохранён. DB/schema/flags/S3 не менялись.
Доказательства и rollback — [runbook](../operations/candidate-backend-image-rollback.md).
Записи ниже «локально/не обновляли dev» описывают предыдущие срезы до D4.
Реальные платежи, внешние письма и полный договор2.1 этим выпуском не приняты.

## 19 октября — совместимость пагинации видеокаталога, до RELEASE-D4

VCAT-C1: сервер `videos.catalog` теперь принимает необязательное
`direction: "forward"`, автоматически добавляемое текущим tRPC infinite-query
клиентом. Раньше первая загрузка получала400 из-за strict input. Формат
`{items,nextCursor}`, порядок и проверки public/club не изменены. Старый вызов
без direction допустим; backward/иные значения/лишние поля отклоняются с400.
Новый режим обратной пагинации не добавлялся.

Native test использует **существующий generated frontend AppRouter**,
настоящие tRPC/QueryClient/InfiniteQueryObserver → loopback Nest → собственную
одноразовую MySQL. Три страницы, скрытая запись, закрытая карточка без источника,
конечный cursor и отсутствие повторного запроса после конца проверены.
Все30 native VK cases pass; дополнительно105 regressions/6 files pass.
Root types/backend build/boundaries pass. SQL fixture DDL не является проверкой
working migration history; реальных VK запросов, S3 и рабочего SQL нет.

**Фронт, включая generated contract.ts, не изменялся по прямому запрету.**
Текущий клиент совместим в runtime, но `pnpm check:api` пока сообщает устаревшие
generated types из-за добавленного optional wire field. Синхронизировать штатной
генерацией только при разрешённой работе над фронтом; не обходить проверку.
Это локальная правка, не обновление dev; push/deploy/flags не выполнялись.

## 19 октября — Библиотека: actual S3 проверка закрыта, контракт прежний

LB4:4/4 native checks/0 skips/80.57s на собственной fresh42 tmpfs БД и шести
новых synthetic фото/документах в Timeweb. Проверены importer lost ACK/restart/
concurrent replay без дублей, direct anonymous GET/HEAD/Range403, защищённые
list/GET/HEAD/Range и byte-exact выдача, отзыв оплаты/сессии/блокировка,
служебный доступ без paid row и guarded operator rollback. Все own objects
удалены/HEAD404, policy прежняя. Runtime и контракт18 октября ниже не менялись.
Это снимает прежний network blocker, но **не** подключает фронт и не переносит
реальные материалы/старые ссылки. Flags выключены в рабочем окружении;
frontend integration, mobile и target release остаются отдельными шагами.
Команда/границы: [операционная заметка](../operations/teamassist-staging.md).

## 18 октября — API закрытых файлов Библиотеки для следующей интеграции

Дополнение к передаче: локальные исходники `774bbe9`, ветка
`feature/stage-one-completion-2026-10-10`. Ниже описан уже реализованный
[контракт LB](../../SPEC-private-files.md), а не новое задание или изменение фронта.
Выкладка, перенос настоящих материалов и включение рабочих флагов не выполнены.
Датированные разделы ниже сохраняют результаты прежних версий.

### Запрос списка и чтение файла

- `GET /api/library/materials/:materialKey/files`, где `materialKey` — только
  `recipes`, `peterburg` или `patterns`. Единственный query-параметр — `cursor`:
  следующий запрос передаёт возвращённый сервером курсор с URL-кодированием,
  без самостоятельного построения. Страница содержит не более 50 файлов,
  порядок — `sortOrder`, затем внутренний ID. Другие/повторные параметры или
  некорректный курсор дают 404, а не пустой успешный список.
- Ответ 200: `{ files: [...], nextCursor: string | null }`. Каждый элемент:
  `fileKey: string`, `sortOrder: number`, `revision: number`, `filename: string`,
  `mimeType: string`, `fileSize: number`, `url: string`. `url` — относительный
  адрес приложения `/api/media/library-files/:materialKey/:fileKey`, не S3 URL.
  `fileKey` брать из ответа; `assetId` и storage key не передаются.
- `GET`/`HEAD` возвращённого `url` используют существующую потоковую выдачу:
  обычное чтение 200, один допустимый Range 206, недопустимый/невыполнимый 416.
  Фото выдаётся inline, документ — attachment. Произвольные query-параметры
  отклоняются с 404; редиректа на хранилище и public fallback нет.
- Используется существующая cookie/Bearer-сессия. Перед чтением повторно
  проверяются текущая сессия, блокировка/удаление аккаунта и доступ к клубу.
  Служебный доступ модератора/администратора допустим, но **не означает оплату**.
  Заголовки ответов: `Cache-Control: private, no-store` и
  `X-Content-Type-Options: nosniff`.

Различать состояния: разрешённый пустой материал — 200 с `files: []` и
`nextCursor: null`; отказ доступа, выключенный флаг, неизвестный материал/файл
или отключённая привязка — 404. Сбой — 503. В частности, активная привязка без
корректного receipt даёт list 503 `{ error: "Файл временно недоступен." }`,
не успешный пустой/частичный список. Проверка списка не обращается к S3.
Точный обработчик — [LibraryFilesController](../../apps/backend/src/content/library-files.controller.ts).

### Что учесть при отдельно разрешённом подключении фронта

- Сохранить существующий дизайн. Защищённый список/файл загружать в контексте
  текущего аккаунта; при смене аккаунта или уходе отменять/игнорировать поздние
  ответы и не сохранять данные прошлого пользователя в общем кэше.
- Разделять пустой результат, недоступность и временную ошибку с повтором.
  На 404/503 не возвращаться к старому публичному URL. Для размытого гостевого
  preview не загружать защищённый original.
- Это REST API: существующие 86 tRPC-процедур и generated contract не расширены.
  `libraryPhoto`/`libraryDocument` **не входят** в upload/status API редакторов.
  Привязки создаёт operator-only importer, не новая форма загрузки фронта.
- Оба флага default-off: `PRIVATE_LIBRARY_FILES_ENABLED` и
  `PRIVATE_CONTENT_FILES_ENABLED`. Нужна additive 0041; fresh-профиль содержит 42
  миграции. Это не разрешение менять рабочую БД, flags или старые ссылки.

### Проверено и что остаётся

Сохранённые результаты 17 октября: 20 focused проверок list/read/import/type,
без skips; отдельно native backup/restore metadata Библиотеки 7/7, без skips,
с 42 миграциями. Это локальные SQL/API/loopback-storage доказательства, не
actual S3 acceptance и не новая браузерная проверка Библиотеки.
[Активный чек-лист](../../tasks/todo.md) содержит точные условия и ограничения.

На18 октября LB4 был незавершённым: preflight установил TCP-соединение с
Timeweb, но завершился TLS-таймаутом до HTTP/авторизации. Этот gate закрыт
настоящим S3/SQL/API прогоном19 октября выше. Реальные
материалы, карта старых URL/совместимость и их перенос требуют отдельного
разрешения; локальный importer сам ничего не переносит. Интеграция Библиотеки
на фронте, устройства и целевой выпуск также не объявлены пройденными.
18 октября изменён только этот handoff и статусы плана: приложение, frontend,
S3, рабочая БД и дизайн не менялись; старые suites не повторялись без причины.

## 17 октября — повторная сверка ТЗ

Current runtime `f1c1a54` проверен без изменений приложения:349 native HTTP/JWT/
SQL checks и372 client checks, включая5 Chromium provider/storage cases,
exit0/skips0. Это локальная проверка с synthetic payments/loopback SMTP,
не работа провайдера или весь UI E2E. [Матрица §2.1/4.1–4.16](../audits/frontend-stage-one-scope-2026-10-03.md)
содержит источники и незакрытые границы. Нового дефекта не выявлено; старые
клубные Yandex URLs/встроенные public assets не закрыты новым upload механизмом.
Второй S3 principal пользователь отложил: не PASS, но не условие продолжения.
Никаких новых S3/working DB/flags/push/deploy действий; own fixture SQL убрана.

## 16 октября — актуальная передача после CF/VU

Проверенный локальный runtime — `a7e46c2` поверх VU/`0e8da4b`, ветка
`feature/stage-one-completion-2026-10-10`. Это версия исходников, не сервера.
Последний проверенный staging — `81e8563`; новый fetch/push/deploy этим
документационным срезом не выполнялся. Нижние датированные разделы — история
контрактов и проверок, а не повторное поручение реализовать уже подключённое.

- F-TEST-1/F-API-1 выполнены; generated contract содержит86 процедур. Private
  audio/document, фото постов/комментариев и материалы статей подключены к existing
  редакторам. FE5/CF-F1b3/CF-F2d/CF-F3d имеют отдельные actual API/SQL/S3 acceptance
  результаты в [активном чек-листе](../../tasks/todo.md), с указанными границами.
- VU1–VU4 выполнены локально: оба редактора используют original File/key,
  owner journal/status-first recovery, binary upload и explicit removal;
  `privateVideoPosters`/`posterUrl` не подменяют галерею. VU4:3/3 native35.77s,
  actual frontend transport/coordinator→API→own fresh41 SQL→Timeweb S3.
  Journal transaction double — НЕ browser reload или UI/playback acceptance.
- Исторический общий прогон до AG9-VU5:2499 pass/1551 opt-in skips/0 fail,
  45.53s; provider3 проверены отдельно выше, skip не засчитывается как приёмка.
  Типы/lint/production29/29 из VU3d применимы к неизменённому runtime. Это
  сохранённые результаты16 октября, не новые прогоны документационного среза.
- Дополнение после разрешения browser/AG9-VU5: единая native матрица обоих
  редакторов **6/6 pass/0 skip,99.09s**, настоящие IndexedDB/File/document reload/
  API/JWT/fresh41 SQL/Timeweb S3. Lost upload/create ACK/no duplicates, account
  switch во время upload/status и возврат владельца; GET/HEAD/Range/playback,
  expiry и explicit video/poster removal подтверждены. Recovery notice fix
  `a7e46c2` получил native GREEN, без CSS/layout изменений. Все9 новых тестовых
  objects удалены/HEAD404/policy unchanged; own test DBs и процессы закрыты.
  Новый full:2504 pass/1557 opt-in skips/exit0,67.90s; types/lint/webpack29/29
  pass. Это local Chromium acceptance, не mobile/working rollout. Точные
  промежуточные failures и playback fixture criterion — начало tasks/todo.md.

Незакрытые границы AG5/AG9, без новой разработки:

| Остаток | Что требуется | Сейчас |
| --- | --- | --- |
| Mobile/реальные устройства и VK-ссылки | Отдельная приёмка на устройствах и с настоящими ссылками | Отложено; local Chromium новых видео UI/reload/playback закрыт в AG9-VU5 |
| Проверка другого S3 пользователя | Отдельная дополнительная isolation-проверка | Отложена пользователем17 октября, не проверена; новую учётку не запрашивать как блокер |
| Целевой запуск/backup/restore/flags | Выбранная отдельная пустая целевая БД и отдельное разрешение на развёртывание/включение | Локальный fresh41 путь проверен; рабочие действия запрещены |
| Внешняя почта/провайдер/нагрузка целевого сервера/пилот | Выделенный согласованный стенд, владельцы и разрешение соответствующих внешних действий | Локальные HTTP/SQL/SMTP/load проверки не закрывают этот gate |
| Старые публичные URL | Отдельное решение о совместимости и переносе конкретных старых файлов | Исключены из текущей работы; весь пункт защиты файлов по ТЗ не объявлять закрытым |

Для уже выбранного fresh-only запуска старая история0017–0019 **не нужна**;
она требуется только при отдельно выбранном upgrade существующей БД. Не просить
её заново как условие продолжения fresh пути и не обходить existing preflight.
Рабочие флаги private upload/retention/export и автоочистки не включались;
локальные opt-in сценарии с включёнными флагами не являются рабочим rollout.
Независимых незавершённых программных срезов в активной очереди нет; до новых
входов не повторять готовые suites, не менять дизайн и не добавлять функции.

## 15 октября — уточнение после разрешённых внутренних frontend правок

По новому прямому поручению frontend разрешён без дизайна. Свежий staging81e8563
уже интегрирован, замены не было. F-TEST-1/F-API-1 ниже теперь выполнены локально:
viewport fixture исправлена без runtime workaround, generated contract содержит86
current procedures, exact API fixture актуализирована. Не назначать их повторно
без нового API изменения. Backend runtime/schema/working DB/S3 прежние.
Дополнительно исправлены bounded media URL reads и WebKit PNG fallback;
40 browser checks/2360 unit pass, skip/pending и границы — начало frontend WORK_PLAN
и tasks/todo.md. Проверки не являются working/provider/device acceptance.
На момент этой проверки private upload/status/privateAssetIds и CF association
ещё не были подключены; последующее завершение — в актуальном разделе16 октября
выше. Runtime flags off, без push/deploy.

## 15 октября — новые закрытые фото и файлы статей (CF, только локально)

Этот раздел дополняет, а не отменяет передачу audio/document ниже. Frontend source,
tests и generated contract не менялись. Backend CF default-off. После отдельного
разрешения15 октября policy нового content/private-v1/ применена и storage-only
probe на own TXT/WebP прошёл: signed200/Range206 exact, anonymous GET/HEAD/Range403,
own public-control200. Старые statement и ACL сохранены; fixtures удалены/HEAD404.
Последующее прямое поручение15 октября: native CF API/SQL+Timeweb4 сценария pass,
skip0,35.11s на own fresh38 tmpfs DB. Drop committed upload/material responses,
restart, concurrent replay без дублей/нового PUT; live access/revoke/Range/removal/
default-off проверены. Четыре own objects удалены/HEAD404, policy неизменна.
Runtime/working flags не менялись. Это ещё не frontend/browser/device acceptance;
другой валидный S3 principal не проверялся. Доказательства/opt-in команда — SPEC.
До совместной приёмки и согласованного rollout не включать PRIVATE_CONTENT_FILES_ENABLED.
Старые URL/S3 objects/обложки/аватары остаются как были; это не их миграция.

- Админ: `admin.uploadPrivateContentFile({idempotencyKey,usage,filename,mimeType,base64})`,
  usage=`postPhoto|articlePhoto|articleDocument`; status —
  `admin.privateContentFileStatus({idempotencyKey})`.
- Комментарии: `club.uploadPrivateCommentPhoto` с теми же полями,
  usage=`commentPhoto`, обязательным неизменным postId; status —
  `club.privateCommentPhotoStatus({idempotencyKey})`.
- Ответ pending/ready содержит assetId/usage/filename/mimeType/fileSize; только
  ready содержит `url=/api/media/content-files/:assetId`. Это не S3 URL и не
  подтверждение сохранённого поста/статьи/комментария. Status смотрит только свой
  account-scoped ключ, чужой возвращает notRecorded.
- До upload сохранить intent с ключом16–128 ASCII `[A-Za-z0-9._:-]` и исходными
  bytes/metadata/usage/postId. После неизвестного результата/reload — свой status
  и повтор исходного intent, не новая загрузка. 409 — конфликт/истёкшее окно,
  не повод создавать замену. Pending/notRecorded не объявлять успехом/отменой.
- Полученный application URL передаётся в существующие photos поста/комментария
  или url/urls блоков статьи (photo/png/carousel/link). Для CF не используется
  `privateAssetIds` старого audio/document пути. Приватный URL нельзя делать cover.
  Новое создание требует отдельный стабильный ключ материала. Для комментария
  новое optional `club.addComment.idempotencyKey` обязательно с private photo;
  повтор с тем же ключом и payload возвращает тот же id, изменённый payload —409,
  включая photos=[]. После удаления комментария replay не воскрешает его.
- Смена аккаунта/уход страницы: не применять поздний ответ к другой сессии;
  не переносить её intent/фото. Возвращаясь, сверять реальный серверный список.
  Чужая привязка отвергается сервером, но клиентскую изоляцию это не заменяет.
- Same-origin cookie/rewrite GET/HEAD/Range, без public optimizer/cache. Для фото
  комментария требуется login даже у public post; club проверяется заново на
  каждом чтении. Preview до привязки — локальный File, нового draft-read API нет.

Фото JPEG/PNG/WebP<=4MiB перекодируются в WebP без EXIF с сохранением alpha;
документы PDF/DOCX/TXT<=32MiB. Прежние48h/2-photo правила комментариев сохранены.
Schema0036/0037 и fresh-only profile38 подготовлены локально; upgrade существующей
БД по-прежнему требует preflight, автоматические миграции не разрешены.
Recovery export добавляет kind private_content/comment (метаданные без файлов),
новый UI не требуется. Очистка ownership при retirement не удаляет S3 objects.
Локальные SQL/HTTP/SDK-wire проверки не доказывают Timeweb ACL или browser/device
приёмку. `check:api` остаётся RED; типы регенерирует frontend team на совместимой базе.

## 15 октября — адресные задачи фронтендеру после merge33b8bbe

Основание: проверенное локальное объединение33b8bbe, frontend строго из
staging81e8563. Ни frontend source, ни его тесты/types бэкендер не исправлял.
Ниже два независимых исправления проверок, не новая функциональность/редизайн.

### F-TEST-1: привести viewport fixture к реальному DOM-контракту

Файл: [__tests__/web-viewport.test.ts](../../__tests__/web-viewport.test.ts).
Причина воспроизведённого `ReferenceError: document is not defined`: тест создаёт
`window`, но не `document`. Текущий getViewport сначала читает layout viewport
`document.documentElement.clientWidth`, затем fallback window.innerWidth.
Это намеренная поддержка сужения layout после rotation/WebKit overflow; не
удалять её из [viewport.ts](../../apps/frontend/src/shared/browser/viewport.ts)
ради старой неполной fixture. Конфликта слияния нет: файлы совпадают в parents.

Минимальное исправление первого существующего теста — дополнить его fixture:

```ts
vi.stubGlobal("document", {
  documentElement: { clientWidth: 1000 },
});
```

Оставить его window1000x800/devicePixelRatio2 и прежние проверки480/1000/2.
Сохранять afterEach `vi.unstubAllGlobals()`. Дополнительно проверить реальные
ветви, без изменения runtime или глобального подавления ошибок:

- layout320 при innerWidth1280 → window/screen width320, не старые1280;
- clientWidth0 при innerWidth1000 → fallback window480/screen1000;
- без window/document → прежний deterministic SSR480x800/scale1/fontScale1.

Критерий: `pnpm exec vitest run __tests__/web-viewport.test.ts` — без fail/skip;
полный набор тоже не скрывает этот тест через exclude/skip или fake GREEN.

### F-API-1: регенерировать типы именно на объединённом бэкенде

Файл: [apps/frontend/src/shared/api/contract.ts](../../apps/frontend/src/shared/api/contract.ts).
На backend33b8bbe82 процедуры, сохранённый frontend contract79. Отсутствуют:
`admin.uploadPrivateAttachment`, `admin.privateAttachmentStatus`,
`profileExtras.recoveryExport`. У existing `admin.createPost`/`admin.updatePost`
добавился optional `privateAssetIds`. Это причина текущего check:api RED;
types/frontend build сами по себе не гарантируют актуальность contract.

Фронтендер выполняет из корня **совместимых объединённых исходников**:

```sh
pnpm api:contract
pnpm check:api
pnpm check
pnpm lint
pnpm build:frontend
```

Первая команда пишет generated frontend file — её выполняет frontend team,
не backend-agent. Типы не писать вручную; не убирать серверные методы и не
добавлять any/ts-ignore ради проверки. Убедиться, что diff — generated types,
без импорта backend runtime, случайных env/секретов/feature flags.
Критерий для33b8bbe: все82 процедуры и privateAssetIds отражены, check:api exit0.
Если backend после этого изменится, основание сверить заново, не фиксировать82
как вечную константу. Не запускать db:push/миграции для генерации типов.

После обеих правок повторить affected tests: viewport, frontend-article-creation,
frontend-club-access, frontend-normal-checkout, frontend-video-catalog, затем
полный Vitest; opt-in SQL/provider skips не считать сквозной приёмкой.
Регенерация типов **не подключает закрытый upload UI**: actual intent/status/
privateAssetIds/read/reload приёмка остаётся отдельным пунктом передачи ниже.
Новый экран recoveryExport не требуется этим поручением. Отчёт фронтендера должен
содержать SHA, команды/exit codes и оставшиеся границы, без утверждения о deploy.

### Остаток бэкенда в действующем объёме

После проверки AG-очереди новых незавершённых самостоятельных local runtime
пунктов нет. AG1–AG4/AG6–AG8, local AG5-R1–R6 и fresh/backup/owner подготовка
выполнены в записанных границах. AG5/AG9 ещё требуют совместимого клиента,
выбранного разрешённого target/rollout и общей native приёмки; готовность всего
ТЗ/рабочих платежей/устройств не заявляется. Без новых входов не повторять
успешные SQL/S3 сценарии и не придумывать новые API. Push/выкладка по-прежнему
запрещены; отправка этого документа разработчику автоматически не выполнялась.

## 15 октября — локальное объединение со staging, без публикации

После отдельного разрешения пользователя свежий staging81e8563 объединён с
нашей feature-веткой (parent ad54e16) без конфликтов. Весь frontend сохранён
точно как в staging; backend/database сохранены точно как у нас. Ручных правок
frontend или его generated contract нет. Remote/server/DB/S3 не обновлялись.

Прошли root/frontend/E2E types, lint, backend/frontend builds, boundaries656 и
docs58. Full Vitest:2339 pass/1 fail/1427 skipped/5 pending (255 files),51.26s.
Fail web-viewport.test.ts воспроизводится отдельно: window stub без document,
viewport.ts:73. Оба файла/config/setup одинаковы в parents; это не регрессия merge.
Проверку не отключали и фронт не исправляли. `check:api` по-прежнему RED82/79:
frontend team должен обновить контракт при подключении private uploads.
Общий GREEN, native SQL/browser/provider/device readiness не заявляются.

Передача ниже теперь применима к объединённым локальным исходникам. Утверждения
о раздельных ветках описывают предыдущую сверку. Private upload/status/association
остаётся frontend-задачей; публикация merge и rollout требуют отдельного разрешения.

## 15 октября — актуальная передача после интеграции фронтендера

**Начинать здесь.** Сверены local backend `2e986f3` и свежий
`origin/staging=81e8563` после fetch15 октября; ветки не объединялись. Фронтендер
уже подключил в `34f1a8d` служебный `hasClubAccess` отдельно от оплаты,
article durable intent/status/replay, NORMAL checkout recovery и VK catalog/
playback/admin. Не назначать эти реализации заново. Исторические фразы ниже
«в staging ещё нет» относятся к снимкам до `34f1a8d`, не к текущему фронту.
Это сверка исходников, не повторная browser/provider/server приёмка.

### Что действительно осталось подключить: новые audio/document вложения

**Локальное обновление15 октября, FE4:** по новому прямому поручению оба редактора
подключены к принятому upload/status/privateAssetIds. Durable owner-scoped File+
key, status-first explicit replay и late-response cancellation проверены в
Chromium/macOS WebKit с mocked API и настоящим IndexedDB; дизайн/старые URL прежние.
Описание ниже относится к remote staging81e8563, а не к состоянию локальной ветки
после FE4. Никакого push/deploy/working flags/DB/S3 этим срезом не выполнялось.
Совместная native backend/S3/browser приёмка и рабочее включение остаются отдельно;
подробные проверки и воспроизводимые команды — начало frontend WORK_PLAN.

В обоих редакторах staging по-прежнему используется `admin.uploadMedia`;
вызовов `uploadPrivateAttachment`/`privateAttachmentStatus` и `privateAssetIds`
нет. Старые объекты/URL/фото/видео/обложки не мигрировать и не закрывать попутно.
Не подменять отказ нового пути старой публичной загрузкой.

1. На согласованной backend-базе фронтендер обновляет generated contract и
   проверяет `check:api`. Сверка14 октября: local82/staging79 procedures;
   отсутствуют `admin.uploadPrivateAttachment`, `admin.privateAttachmentStatus`,
   `profileExtras.recoveryExport`; createPost/updatePost не знают privateAssetIds.
   Исходники backend/frontend после этой сверки не менялись; новый API-check не
   объявляется зелёным. `recoveryExport` — существующий отдельный контракт, не
   поручение добавлять новый экран или блокер upload-интерфейса.
2. До первого upload сохранить account-scoped intent с одним ключом16–128 ASCII
   `[A-Za-z0-9._:-]`, типом и metadata. Новый запрос:
   `admin.uploadPrivateAttachment({idempotencyKey,type,filename,mimeType,base64})`.
   Не передавать postId, objectKey, URL, owner или клиентский размер.
3. После timeout/reload сначала `admin.privateAttachmentStatus({idempotencyKey})`.
   pending/notRecorded не означают окончательное отсутствие сохранения;
   ready — подтверждённый receipt без storage URL. Повторяет исходный upload с
   прежними ключом/bytes/metadata, не новый intent; при ready сервер восстанавливает
   receipt без повторного S3 PUT. После reload при необходимости выбрать тот же File.
   Смена аккаунта/уход страницы исключают применение позднего ответа.
4. В create/update поста передавать `privateAssetIds` из своих ready receipts,
   максимум100 UUID; create требует отдельный прежний post idempotencyKey.
   Upload ready не равно «пост сохранён». CONFLICT/pending/ошибку связи не считать
   успехом; проверять реальный список/результат операции, не создавать замену.
5. Preview до публикации — локальный File. После публикации чтение существующего
   media URL `/api/media/post-attachments/:mediaId` через same-origin cookie/rewrite.
   Удаление — существующий removedMediaIds; это отвязка, не удаление объекта S3.
   Новый путь принимает PDF/DOCX/TXT и detected audio MPEG/MP4/WAV/OGG/WebM,
   не legacy DOC/FLAC/AIFF. Лимит файла32MiB, HTTP JSON50MiB; квоты других путей
   не менять. Точная семантика — AG4 ниже и [SPEC-private-files](../../SPEC-private-files.md).

### Критерии совместной приёмки и граница следующего шага

Проверить настоящий create/edit + read/download/audio Range; потерю ACK upload и
post, reload, повтор без дублей, удаление связи, смену аккаунта/роль/блокировку/
истечение клубного доступа и поздние ответы. Проверить 400/401/403/404/409/413/503,
повреждённый ответ и истечение окна восстановления:409 не становится notRecorded
или новым intent. Mock-проверки не заменяют native SQL/HTTP/S3/browser доказательства.

Backend upload/read flags по умолчанию выключены. До включения нужны совместимая
schema0032–0035, согласованный способ нового запуска/upgrade и клиент; стандартный
db:push нельзя применять к fresh-only истории. Рабочие миграции/флаги/выкладка,
push/merge и внешний S3 этой передачей не разрешаются. Готовы локальные fresh36,
synthetic backup/restore и проверка owner login, но это не выложенный стенд для
совместной приёмки. Следующий организационный шаг — передать этот документ и
согласовать объединение проверенного backend со staging без перезаписи фронта.
Отправка другому человеку автоматически не выполнена; новая runtime работа не
открывается вместо внешних условий. Отменённую первую email-привязку не возвращать.

## 14 октября — AG5-R6, локальная отвязка журналов и собственный экспорт

Новый additive query `profileExtras.recoveryExport`, protected, default-off
`CONTENT_RECOVERY_EXPORT_ENABLED`. Input strict: `{kind:'post'|'article'|
'private_attachment',afterKey?:64 lowercase hex,limit?:1..100}` (default25).
Output `{items:[{requestId,createdAt,status}],nextCursor:string|null}`; статусы
`created|deleted|pending|ready|expired`. requestId — server fingerprint, не original
idempotencyKey и не capability повторного создания/скачивания. Только собственные
records, без content/имён файлов/ID материалов/assetId/секретов/storage URLs.
Guest/revoked/blocked HTTP401 (existing SDK), disabled404, invalid input400,
partial schema503. Compacted marker всегда expired, независимо от expiry flag.
Курсор устойчив к компактизации, но это live keyset export, не frozen backup.
Подробнее: [R6 contract/runbook](../operations/teamassist-staging.md).

Final scrub default-off `CONTENT_RECOVERY_RETIREMENT_ENABLED` атомарно удаляет
post/article journals/markers автора; private receipt отвязывается, но bound
файл/материалы проекта не удаляются. Новая0035 только локально проверена; working
rollout требует history/preflight/drain/backup решения. Existing upload/create
response shapes не изменены. Фронт/generated types агент не менял; это передача
контракта, не выполненная интеграция и не разрешение рабочего включения.

## 14 октября — AG5-R4/R5, локальная компактизация и orphan cleanup

Фронтенд/types не изменялись; нового endpoint или success shape нет. После
компактизации known spent intent по-прежнему409, даже если expiry flag выключили:
не трактовать это как отсутствие операции и не создавать новый ключ автоматически.
Живые bound вложения/материалы не удаляются, их чтение не ограничено30 сутками.
Код очистки реализован только для own loopback backend_test/S3 wire, default-off,
без scheduler/API wiring. Рабочая Timeweb очистка не включена и не проверена этим
срезом. Новая0034 до backend с расширенной ORM-моделью обязательна для private
routes; рабочую apply нельзя выполнять без AG5 preflight/history/rollout решения.
Подробные условия и evidence — [existing runbook](../operations/teamassist-staging.md).
Final scrub/export/backup/restore остаются следующимR6/внешними gate.

## 14 октября — AG5-R1, окно восстановления новых вложений

Локальный `CONTENT_RECOVERY_RETENTION_ENABLED`, default-off. При отдельном
совместимом включении private upload/status известного intent после30 суток от
первого серверного createdAt возвращают409 CONFLICT «Срок восстановления истёк»,
не `notRecorded`/новый объект. Непривязанный старый asset нельзя bind; уже связанный
с постом asset продолжает читаться/редактироваться. Не создавать новый intent
автоматически после expiry/network error; новое действие требует решения автора.
Это окно восстановления, не срок подписки/публикации/хранения bound файла.
До совместной приёмки flag выключен; формат success остаётся прежним.
AG5-R2 применяет тот же flag/window к existing keyed `admin.createPost` replay:
после срока409, без новой записи/повторного уведомления; disabled replay прежний.
Нового post status endpoint нет и не добавлен.38 native cases pass,skip0.
AG5-R3: тот же flag/window у keyed `admin.createArticle` и
`admin.articleCreationStatus`; просроченный результат409, не `notRecorded`.
Живая статья сохраняется, удалённая/teaser не воскрешаются.27 native cases pass.
Rows/S3 не удаляются вR1–R3, compaction/orphan/scrub и рабочий rollout — следующие
AG5 срезы/gates. Frontend/types не менялись. RED200→409;31 native/unit pass.

## 14 октября — AG4, новые закрытые вложения постов

Локально реализован additive backend-контракт (фронт не изменялся):

- `admin.uploadPrivateAttachment`: admin mutation, вход `{ idempotencyKey,
  type: "audio" | "document", filename, mimeType, base64 }`. Ключ намерения
  16–128 ASCII `[A-Za-z0-9._:-]`, создать один раз и сохранить **до** первого
  POST. Повтор — тот же ключ и тот же файл/metadata; другое содержимое →409.
  Нет client postId/URL/objectKey/size/owner/duration. HTTP JSON ceiling50MiB,
  вложение≤32MiB; это не изменение legacy video/photo/upload квот.
- Успех: `{ state: "ready", assetId, type, filename, mimeType, fileSize }`.
  MIME/размер определяет сервер; charset TXT сохраняется. Никакого storage URL.
  PDF/DOCX/TXT; audio MIME после byte detection: MPEG/MP4/WAV/OGG/WebM.
  FLAC и прочие форматы вне существующей read allowlist отклоняются400 до SQL/S3,
  а не становятся нечитаемым ready receipt. Legacy DOC (`application/msword`)
  в **новом** пути отклоняется, поскольку прежний detector не проверяет Word.
  Старый upload остаётся прежним; detection не означает antivirus/player acceptance.
- `admin.privateAttachmentStatus` query `{ idempotencyKey }` возвращает
  `notRecorded` либо receipt `pending|ready`. `pending` не успех. Network/5xx
  не разрешает новую загрузку с новым ключом. При ready повторный POST восстанавливает
  тот же receipt без S3 PUT. При pending нужно повторить прежние bytes/metadata
  (после reload — выбрать тот же File); новый файл под старым ключом не принимается.
  До публикации preview только локального File; server draft preview отсутствует.
- Existing `admin.createPost`/`admin.updatePost` принимают optional
  `privateAssetIds: string[]` (UUID,≤100). При create с ними обязателен existing
  post idempotencyKey. Привязка своего ready receipt — часть транзакции поста;
  legacy `attachments` с URL относится только к прежним публичным объектам.
  Новые private-v1 URL этим старым входом не принимаются. Чужой/pending/rebound
  или уже удалённый receipt →409; не скрывать как успешное сохранение.
- В возвращаемом post_media URL — `/api/media/post-attachments/:mediaId`, не S3.
  Использовать тот же origin/cookie и existing rewrite. Guest читает published
  feed/both, клуб — актуальный член/staff; draft/hidden/remove/expired/block/revoke
  дают отказ. Служебный доступ не означает оплату. Прежний `removedMediaIds`
  удаляет связь, не объект S3; поздний повтор не восстанавливает удалённое вложение.
  Успех upload отдельно от успеха post association: статус ready не подтверждает
  сохранение поста; retry создания использует прежний post key.

Rollout: миграция0032/history preflight → backend → интеграция фронтендера →
совместная приёмка → явное включение `PRIVATE_POST_MEDIA_UPLOAD_ENABLED=true`
и existing `PRIVATE_POST_MEDIA_DELIVERY_ENABLED=true`. Оба default-off; на сервере
не включались. Не запускать agent `pnpm api:contract`: generated frontend types
обновляет фронтендер. Старые S3 объекты, photos/articles/video/shared вне среза.
Ledger/orphans автоматически не истекают/не удаляются; retention, export/deletion,
working history/rollout отдельно в AG5/AG9, не заменяются synthetic DB.

Проверки: native HTTP/JWT/SQL и SDK-wire (20 сценариев); actual Timeweb API/SQL
с двумя fresh compiled Node процессами, потерей реального HTTP ответа через
loopback proxy, document/WAV/Range и direct anonymous denial. Это backend acceptance,
не UI/player/device/реальная внешняя почта или платежи. После двух Timeweb timeout
повтор по новому поручению на HEAD e3044af, **после MIME guard**, прошёл:
2 pass/skip0,21.22 s,exit0. Lost upload/post ACK и fresh backend restart не создают
дубли, guest/expired/removal denial и exact WAV Range подтверждены. Все synthetic S3 объекты
удалены с assetId/hash/size/ETag guards, policy не менялась. Команды/итоги в
SPEC-private-files и активном checklist; нельзя повторять их с рабочей DB/env.

## 14 октября — регистрация и подписка на одном локальном аккаунте

SMTP refusal/retry после29f3252: loopback RCPT550 оставляет sentAt null и
delivery_failed; три одновременных register retries не меняют account/name/role/
password/sessionVersion, token/outbox ID и backoff.202/ok означает принятие
запроса, не доставку: API не выдаёт session или sent claim. После восстановления
SMTP та же запись принята (attempts2/sentAt), одна копия setup-письма, setup/login
и остальной flow проходят. 17 pass/2 suites/skips0 (4.24 s), TypeScript exit0.
Production код не менялся, fixture loopback33384/tmpfs, SMTP only local; это не
сертификат внешней доставки. Команда: registration-subscription-flow.mysql.test.ts
и registration-retry.mysql.test.ts, --maxWorkers=1, чистое окружение как ниже.

Проверка блокировки после checkpoint8d65968: реальный moderation API блокирует
оплаченного пользователя, увеличивает sessionVersion, пишет audit и ставит
cancellation в очередь (не объявляет provider cancellation подтверждённой).
Старые cookie/Bearer закрывают club.list, cookie также закрывает savedPosts,
interactions, checkout/status; auth.me → user:null и login → generic401.
feed.getById штатно скрывает club body, без ложного успеха от SQL500. Paid rows и
срок не изменены. Подписанный receipt replay при blocked отклонён422 без новых
receipt/периодов. Unblock не восстанавливает старый cookie; новый login возвращает
прежний доступ/срок. Обычный пользователь не может вызвать blockUser (403).
24 pass/2 suites/skips0 (3.01 s), final strengthened flow1 pass (2.05 s),
TypeScript exit0. Первый отказ — ошибка ожидания login403 в harness, не runtime
RED; generic401 оставлен прежним. Production код не менялся. Own fixture33383,
SMTP loopback и запрет внешнего HTTP; не проверяет рабочую БД/ACL/провайдера.

Дополнение после checkpoint e368a7d: в том же flow проверено восстановление
пароля после двух оплаченных заказов. До proof старый пароль/сессия сохраняются;
после proof старый пароль отклонён, cookie не имеет club access и получает401
для normalCheckoutStatus. Reset token однократный; password complete не логинит.
Новый login сохраняет paid rows и точный срок; sessionVersion повышается на1.
Дальнейшая pending/confirmed отмена и истечение проходят с новой сессией.
Расширенный flow: 1 pass/skips0 (1.83 s), production код не менялся.
Для воспроизведения использован новый собственный tmpfs контейнер на loopback33382
(в команде ниже заменить только test port); это не дополнительные 94 проверки.

По разрешению пользователя проверен связный API-сценарий без изменений фронта и
рабочей БД. Кодовая база 684a48e, новый тест
`tests/registration-subscription-flow.mysql.test.ts`. Используются настоящий Nest
HTTP, cookie/JWT, password hashing, MySQL и Nodemailer с loopback SMTP. Только
ответ отмены платёжного провайдера подменён строгим double (pending/confirmed).
Checkout строит синтетический URL, но никогда не открывает его; неверная подпись
локального уведомления отклоняется до выдачи доступа.

Один синтетический аккаунт проходит регистрацию/повтор, доставку setup-письма в
перехватчик, однократную установку пароля, вход, checkout и replay, подписанное
уведомление и replay, получение доступа, вторую покупку и продление на 30 суток,
pending отмену и подтверждение без потери оплаченного срока. Истечение моделируется
только на принадлежащих сценарию строках. После него доступ закрыт. Аккаунт/пароль/
роль/sessionVersion не изменяются оплатой; дубли receipt/order не появляются.

Проверка нового сценария: 1 pass (финальный прогон 1.67 s); существующие шесть
native suites — 94 pass, skips0 (13.62 s). TypeScript exit0. Нового runtime-дефекта
не найдено, production код неизменён. Это не сквозная browser-проверка, не настоящая
платёжная операция, не проверка реального автосписания/отмены у провайдера и не
доставка во внешний ящик. Рабочая история миграций этим не подтверждена.

Воспроизведение: собственный mysql:8.4 с backend_test, root без пароля только на
loopback 33381, tmpfs /var/lib/mysql, без persistent volumes. Не использовать
унаследованные секреты/рабочие подключения. После проверки удалить только свой
контейнер по literal ID с проверкой task label, loopback binding и tmpfs.

```sh
env -i PATH=/opt/homebrew/opt/node@22/bin:/Users/edem/.npm-global/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  BACKEND_TEST_DATABASE_URL=mysql://root@127.0.0.1:33381/backend_test NO_COLOR=1 \
  pnpm exec vitest run tests/registration-subscription-flow.mysql.test.ts \
  tests/registration.mysql.test.ts tests/registration-retry.mysql.test.ts \
  tests/normal-checkout-recovery.mysql.test.ts tests/nest-billing-webhook.mysql.test.ts \
  tests/billing-settlement.mysql.test.ts tests/identity.mysql.test.ts \
  --maxWorkers=1 --reporter=dot --silent
```

БД строится существующим изолированным fixture helper, а не рабочим migrator;
это различие сохраняет AG5 preflight/rollout gate. SMTP поднимается и закрывается
самим тестом, фоновые jobs не стартуют. Исторические результаты ниже не заменяют
этот checkpoint и не подтверждают версию работающего сервера.

## AG1 — актуальные контракты, 13 октября 2026

Серверная база: локальный `e8ba8fd`, последние native проверки `123c9c6`;
план агента `b438ea4`. Git `staging` проверен через remote refs: `62b24a6`.
Версия работающего сервера не установлена. Описанное ниже нельзя считать уже
доступным на стенде: сначала совместимый backend/schema, затем клиент.
Этот документ подготовлен для передачи; внешние сообщения не отправлялись.

### Клубный доступ отдельно от оплаты

`club.subscription` остаётся public query без input. Новый additive ответ:

```ts
type ClubSubscription = {
  hasClubAccess: boolean;
  subscribed: boolean;
  expiresAt: Date | null; // существующий tRPC/SuperJSON формат
  cancelAtPeriodEnd: boolean;
  isOwner: boolean;
  monthlyPrice: string;
};
```

`hasClubAccess` управляет чтением клуба. `subscribed`, `expiresAt` и
`cancelAtPeriodEnd` сохраняют прежнюю семантику оплаченного периода; историческое
исключение owner (`subscribed: true`) остаётся. `isOwner` не выводится из доступа.
Для неоплаченного модератора: `hasClubAccess: true`, `subscribed: false`,
`expiresAt: null`, `cancelAtPeriodEnd: false`, `isOwner: false`.
Модератор с настоящим оплачиваемым периодом сохраняет его настоящие значения.
Гость/заблокированный не получает доступ. При недоступности SQL — ошибка,
не подстановка фиктивной подписки.

Клиент: клуб открывается по `hasClubAccess`; служебный доступ не показывает
оплаченный срок/автопродление/отмену и не открывает owner-разделы. Смена аккаунта,
блокировка, снятие роли и поздний ответ не сохраняют предыдущий доступ. В проверенном
`staging` parser ещё принимает только прежние поля: согласованное подключение
нового признака остаётся задачей фронтендера.

### Публичные обсуждения и реакции

`club.comments({postId})` требует авторизацию, но не оплату для опубликованных
`feed`/`both`. Клубный пост требует canonical club access; скрытый/черновой/
отложенный/отсутствующий пост не выдаёт обсуждение. `club.addComment` сохраняет
прежние сроки комментирования. Никакого нового гостевого чтения комментариев.

`feed.toggleLike`/`toggleSave` сохраняют прежние input/output, но до записи
проверяют существование/публикацию/доступ в той же транзакции. Отказ не создаёт
реакцию. **Toggle не является идемпотентным:** повтор после неизвестного результата
может обратить уже сохранённое состояние; сначала свежая сверка, не blind retry.

### Создание статьи после потери ответа и reload

Принятый [полный контракт](../../SPEC-article-create-recovery.md).
`admin.createArticle` принимает прежний payload и optional `idempotencyKey`:
строгий lowercase UUID v4. Ответ по-прежнему положительный числовой articleId.
Без ключа прежний запрос совместим, но не защищён от повторного создания.

- Клиент создаёт и сохраняет один ключ **до первого POST**, отдельно по аккаунту.
  Для восстановления нужны исходный ключ и исходные данные, не новая UUID.
- Один автор/ключ/данные возвращают исходный ID, в том числе после edit/delete.
  Изменённые данные с тем же ключом дают `CONFLICT`; статья/teaser не дублируются.
- `admin.articleCreationStatus({idempotencyKey})` — новый read-only query:
  `{status:"notRecorded"}` или `{status:"created"|"deleted",articleId:number}`.
  Проверка прав выполняется заново; результат другого автора не выдаётся.
- `notRecorded` — снимок отсутствия завершённой записи; исходный запрос может ещё
  выполняться. Это не разрешение сменить ключ или утверждать «не сохранено».
  Timeout/ошибка схемы не являются `notRecorded`. Восстанавливать той же операцией.
- Успех после удаления возвращает исходную операцию, не воскрешает материал.
  Не создавать «замену» автоматически. `updateArticle` не получил новый replay API.

В `staging` создание статьи ещё отправляется без этого ключа. Фронтендеру:
подключить durable intent/recovery, изоляцию аккаунтов, смену страницы и обновление
реального списка после неизвестного результата. Детали хранения текста/файлов
не навязываются сервером. Browser reload-сценарий пока не принят.

Generated `apps/frontend/src/shared/api/contract.ts` отстал: сервер содержит
74 процедуры после нового query, прежний контракт — 73. Проверка `pnpm check:api`
выявляет это. Регенерацию `pnpm api:contract` выполняет фронтендер на согласованной
совместимой базе; backend-агент файл не меняет и проверку не отключает.
Перед keyed вызовами нужна проверенная schema `0029`; auto-DDL/fallback отсутствует.

### Первая привязка email: выключенное состояние и ошибки

[SPEC-email-binding](../../SPEC-email-binding.md) — точный источник HTTP-контракта.
Backend `MEMBER_EMAIL_BINDING_ENABLED` и frontend build
`NEXT_PUBLIC_MEMBER_EMAIL_BINDING_ENABLED` остаются выключенными по умолчанию.
WorkerJobs подключён локально, но guard не допускает включения без нужной схемы.
Не включать форму до reviewed истории/миграций `0027/0028` и готового backend.

| Запрос | Ответ/назначение |
| --- | --- |
| `POST /api/admin/member-email-bindings` с `{userId,email,requestKey}` | `202 {requestKey,state}`: заявка записана, не письмо в inbox и не смена email |
| `GET /api/admin/member-email-bindings/:requestKey` | `{requestKey,userId,state,delivery,expiresAt,completedAt}`; UTC ISO/null, read-only |
| `GET /api/auth/email-binding#token=...` | Read-only переход на `/email-binding`; fragment не отправляется серверу |
| `POST /api/auth/email-bindings/confirm` с `{token}` | `200 {ok:true}`; явное действие, только смена первой почты/consumption/audit |

`state`: pending/confirmed/expired/cancelled; `delivery`: queued/sent/unavailable.
`sent` означает SMTP acceptance, не получение письма участницей. Админские
ошибки: 400/401/403/404/409/429/503; proof-ошибки generic400, выключенное API503.
При потере confirm reply не делать вывод, что email не изменился. GET никогда
не подтверждает почту. Пароль, аккаунт, сессии и подписка сохраняются; confirmation
не создаёт вход. Нужны существующие login/recovery, без переноса чужого аккаунта.

### Закрытые файлы: готов только первый read-срез

[SPEC-private-files](../../SPEC-private-files.md): default-off
`PRIVATE_POST_MEDIA_DELIVERY_ENABLED`; `GET/HEAD /api/media/post-attachments/:id`.
Запрос принимает только ID и прежнюю сессию, без URL/key/userId/query-token.
Текущие URL в ответах API и загрузка **не переключены** на этот маршрут.

Published feed/both разрешён гостю, published club проверяет текущую сессию и
доступ. Неизвестный/недоступный ресурс generic404, недоступность сервиса503;
GET single range206/416, HEAD без тела, `private,no-store`. Полученная ссылка
не является bearer-разрешением. Существующий `/api` rewrite требует браузерной
приёмки cookie/media запроса; не изобретать новое хранение auth-токенов.

Фотографии, article sections, unassociated uploads, старые public-read URL и
VK embed не объявляются закрытыми. Direct anonymous denial на настоящем S3
пока не принят. Фронтендер не должен включать proxy URLs до agreed upload/
association/read контракта; backend-агент не меняет клиент, старые файлы и ACL.

### Критерии совместной проверки

Проверить на одной выбранной совместимой базе: неоплаченный модератор/paid member/
guest/expired/blocked/revoked; публичное и клубное обсуждение; denied reactions
без SQL-записи; создание статьи/lost reply/reload с одной SQL статьёй/teaser;
смену аккаунта/страницы без позднего чужого результата. Email и файлы отдельно
проверяются после миграционных/storage gates; включение не следует из этого текста.

Доказательства уже записаны в [плане](../../tasks/plan.md): affected AR123 и VK53
— прошлые успешные прогоны с указанными SQL/HTTP границами, не новые тесты документа.
Текущая документационная
проверка не доказывает рабочую оплату/почту/S3/устройства или готовность первого этапа.

## AG6 — normal checkout recovery, локально 14 октября

Принят и реализован [контракт](../../SPEC-normal-checkout-recovery.md):
локальный commit `fa8d70f`, на сервер не выкладывался.
`club.createNormalCheckout` (protected mutation) принимает strict
`{idempotencyKey: lowercase UUIDv4, plan?: "monthly" | "semiannual"}`;
`club.normalCheckoutStatus` (protected query) — strict `{idempotencyKey}`.
Create: pending с orderId/url, succeeded с orderId/expiresAt или failed с orderId.
Status: notRecorded либо pending/succeeded/failed; без payment URL/почты.
Формат dates прежний tRPC/SuperJSON. Оба метода default-off за
`NORMAL_CHECKOUT_RECOVERY_ENABLED=true` и требуют проверенной migration 0030.
Без схемы/PK/unique-order/InnoDB — закрытая ошибка, без runtime DDL/fallback.

Key хранится клиентом **до** POST для одной покупки и своего аккаунта. Потеря
ответа/reload не создаёт новый key; повтор возвращает исходный order/link.
`notRecorded` — снимок, не разрешение заменить key при ещё идущем POST.
Смена plan/email под старым key — CONFLICT. Новая намеренная покупка — новый key.
Pending replay при изменении merchant/price/signing/app config — PRECONDITION_FAILED,
без новой ссылки/заказа; read-only status остаётся доступен. Succeeded требует
receipt именно этого order; чужая/предыдущая подписка не доказывает новую оплату.
Смена аккаунта изолирует raw key; blocked/deleted/revoked identity закрывается.
TEST header/включённые либо malformed TEST flags не переключают create на normal.
Обычные guest createCheckout/reconcileCheckout, TEST, settlement и отмена неизменны.

26 native SQL/HTTP сценариев, lost ACK, concurrent replay, rollback, два compiled
процесса и session fence; 200 existing billing tests. Фронт/его generated types
не изменялись; check:api остаётся stale. Ничего не развёрнуто/включено, реальных
платежей/писем нет. Перед working rollout: AG5 preflight/history (0017–0019),
retention/export ledger, совместимая migration/rollback rehearsal, затем клиентская
интеграция и отдельная внешняя payment acceptance. Повторное открытие ранее
скопированной платёжной ссылки не является гарантией от двойного списания.

### Исторический аудит до принятия контракта, 13 октября

Read-only review 13 октября: `ClubCheckoutService.createCheckout` в обычном
Prodamus режиме генерирует новый random orderId и pending club_payments на каждый
вызов. `idempotency-key` в этом режиме отклоняется специально, чтобы TEST caller
не переключился на другую платёжную семантику. `reconcileCheckout` делегирует
тестовому провайдерскому пути; `claimPending` читает прежний оплаченный доступ,
не подтверждает именно новую попытку продления. Это не новый native RED и не
наблюдение двойного списания: исходящие реальные платежи не проводились.

Existing tests покрывают отсутствие сессии/выдачи доступа при checkout, сохранность
пароля, blocked/configuration refusal, signed receipt replay/renewal/rollback и
pending/confirmed cancellation с сохранением срока. Эти результаты не дают
ordinary create гарантию восстановления после lost reply. Повтор webhook одного
provider payment и повтор создания нового pending order — разные операции.

P2 требует нового согласованного контракта. Минимальные свойства предлагаемого
normal пути (на момент аудита не были реализованы/утверждены):

- Стабильный key одной покупки и namespace выбранного provider/mode/recipient/plan;
  новая намеренная покупка имеет другой key, timeout не меняет прежний.
- Atomic claim/result и fingerprint принятого payload; один key/данные возвращают
  один order/link, изменённые данные — конфликт. Price/период остаются прежними.
- Read-only результат конкретного intent/order: pending не является оплатой;
  succeeded требует подтверждённой settlement связи с этим order. Старый paid
  период другого order не является результатом нового продления.
- Authenticated статус только своего пользователя; гостевой recovery требует
  отдельного проверенного proof/receipt контракта, не поиска по одному email/ID.
  Покупка по email по-прежнему не создаёт сессию и не меняет пароль.
- При смене provider flags исходный TEST intent не переходит на normal и наоборот.
  Существующий header guard не удаляется ради добавления normal recovery.
- Pending/retention/replay после удаления/конкурентного settlement описываются до
  изменения схемы; не копировать TEST ledger в обычные оплаты без проверки полей.

P3 core уже durable: failure остаётся pending, worker retries сохранены;
подтверждение не обрезает expiry. Реальная recurring/cancel приёмка остаётся внешней.
Runtime/API/schema/frontend не менялись, повтор существующих GREEN не запускался.

## AG7/AG8 — покрытие API и остатки материалов

Read-only сопоставление owning services и existing native suites, 13 октября:

| Обязательный путь | Код/существующее доказательство | Остаток |
| --- | --- | --- |
| Create post/replay/schedule/edit | post-creator/editor/creation-request, post-creation-idempotency/content/native browser helpers | Реальные медиа/клиент/устройства, не повторять уже проверенный replay |
| Article/teaser atomicity/replay/delete | article-writes, article-write-consistency и article-creation-recovery native suites | Новый клиентский key/status и 0029 rollout |
| Media complete reads/removal | Batched post-media-repository, transactional attachments/videos; retained IDs/metadata | Новое trusted upload metadata/private association и S3; описано в AG3 |
| Public/club comments и реакции | Target-aware service, transactional post-reactions; nest-comments/nest-content | Direct photos/storage и совместная сборка; жалобы отложены |
| Search/saved/library | ContentReadService, post-catalog repositories, native content/browser evidence | Реальные данные/материалы и devices, без нового API |
| Тест/результат/переходы Главной/поддержка | Existing native quiz/library helpers, profile read и frontend WORK_PLAN; поддержка через согласованный email | Проверка клиентской общей базы/устройств; расширенные советы вне API-защиты этапа |
| Seasons/config/manager | LaunchService/settings, launch-settings native CAS/HTTP/границы | Реальные calendar настройки/фоны/баннеры и mailto на телефоне |

Нового воспроизведённого backend-дефекта за пределами уже отмеченных storage/P2
границ в выбранных путях не установлено. Это завершение ограниченного аудита,
не новая полная SQL/browser регрессия и не доказательство всех interleavings.
Поведение, тесты и фронт не изменены; прежние pass не выдаются за свежий запуск.

Исторический VK audit до принятия каталога: в Git staging `62b24a6` есть whitelist HTTPS exported `video_ext.php`
renderer с oid/id/hash, без произвольного iframe HTML и без новой формы ввода.
Post-media доступ наследуется от родителя и native проверен ранее. Published
самостоятельный catalog остаётся публичным; mandatory youtubeId/anonymous worker
не являются моделью private VK. Следующее решение владельца материалов:
клубные ролики размещаются только как вложения или также в самостоятельном каталоге;
как передаются/вносятся экспортируемые ссылки. Пока данных нет, новые access поля,
provider union/миграции/фиктивные IDs не добавлять. Реальные ролики/настройки VK и
телефоны ещё требуются; публичный тестовый embed не принимает контент заказчика.

## AG8 — принятый VK-каталог, локальная реализация 14 октября

[Контракт](../../SPEC-vk-catalog-access.md) принят пользователем; новые API/schema
реализованы локально, не выкладывались. Фронт и generated types не изменены.
Backend/schema/tests: `70a5110`; anonymous worker guards: `3978691`.

- `videos.catalog` public query: strict `{limit?: 1..100, cursor?: positive safe id}`,
  default limit20, no input допустим. `{items,nextCursor}`; item только
  `{id,title,duration,access:public|club,canWatch}`. Никаких sources/hash/URL в карточках.
- `videos.playback` public query с server gate: strict `{id}`; public опубликованный
  источник доступен гостю, club требует текущего hasClubAccess. Ответ union:
  `{id,provider:"vk",embedUrl}` либо `{id,provider:"youtube",youtubeId,videoUrl}`.
  Гость club — UNAUTHORIZED; пользователь без доступа — FORBIDDEN;
  revoked/blocked — existing identity policy; unknown/unpublished — NOT_FOUND;
  schema/SQL/corrupt source — INTERNAL_SERVER_ERROR, без публичного fallback.
- `admin.upsertVkVideo` admin mutation: strict `{embedUrl,title,access,published,id?}`
  → `{id}`. Без id — create/replay одного canonical source; другой payload даёт
  CONFLICT. С id — explicit update существующего VK, без конвертации старого YouTube.
  Allowlist согласован с staging parser (полные правила в spec); неизвестные
  query/duplicate/HTML/share URLs отвергаются. Никакого fetch/download VK на сервере.
- Старые `videos.list/getById` сохраняют public YouTube wire shape, не возвращают
  club/VK даже при выключенном новом флаге. Старый importVideos остаётся public
  YouTube; access/provider/VK source fields теперь явно отвергаются, а не молча
  теряются с последующей публичной публикацией.

`VK_CATALOG_ENABLED=false` по умолчанию. Сначала проверенная schema 0031,
затем backend/совместимый клиент и worker, затем согласованное включение.
Служебный canWatch не равен subscribed; billing/роли/CORS/квоты не менялись.
Новый интерфейс не реализован агентом: frontend team подключает catalog/playback
и admin запись, обрабатывает недоступность/ошибки и обновляет generated contract.

88 backend checks/11 файлов (21 VK SQL/HTTP + отдельный Node worker с настоящим
API/SQL и warm cache), 42 native worker checks; без skip. TypeScript/build/boundaries
прошли; API check остаётся stale. URL/bytes/payment rows — synthetic,
ни одного реального VK проигрывания или рабочего migration acceptance.

Перед выпуском проверить фактическую edge routing: teamassist/edge.video.conf
пропускает /api/yt и yt-thumb через защищённый worker. Старый nginx-daryadarcy.conf
проксирует yt-thumb прямо во внешний public cache без catalog gate; это не
закрытая маршрутизация. Рабочие конфиги не проверены/не изменены. AG5 preflight
всё ещё блокируют untracked 0017–0019; 0031 зарегистрирован, DB approval отсутствует.
Реальные embed/настройки владельца, устройства, frontend и rollout остаются AG9.

## Исторические передачи

Ниже сохранены прежние срезы; их даты и ограничения не подменяют текущие условия.

## Полный справочник тегов — 9 октября 2026, локально

`getAllTags` перенесён в существующий `content/post-catalog-repository.ts`.
Публичный контракт и исполняемый код сохранены: полный справочник, включая
неиспользованные сезонные теги, исходные названия, порядок и обработку ошибок.
Фронтенд и админка не менялись; это разделение владения кодом, не новая функция.

Три контрольные подмены порядка, категории и обработки ошибки дали ожидаемые
RED отказы и убраны. Итог: 157 выбранных проверок (65 настоящих SQL, 92 doubles),
1901 успешная / 819 пропущенных в общем прогоне. Типы, обе сборки, API/границы,
frontend lint, форматирование и 208 клиентских регрессий проходят. Одноразовая
база удалена, рабочая база и сервер не затронуты. M08 и платёжные ограничения
остаются открытыми; это не подтверждение работоспособности карты или СБП.

## Личные лайки и закладки — 9 октября 2026, локально

Чтение ID отметок теперь принадлежит существующему `content/post-reactions.ts`,
рядом с неизменённой транзакцией переключения. Фасад/API, фильтр пользователя,
повторяющиеся старые записи, порядок закладок и прежние ответы без БД сохранены;
доступ к содержимому проверяется отдельно. Исполняемые AST/сигнатуры совпадают.

Две новые HTTP/JWT/MySQL-проверки защищают разделение двух пользователей и
порядок/повторения отметок без раскрытия чернового текста. Удаление каждого
фильтра пользователя и обратный порядок дали по одному ожидаемому RED отказу;
подмены убраны. Итог: 153 выбранных проверки (64 настоящих SQL, 89 doubles),
общий прогон 1898 успешных / 818 пропущенных. Типы, обе сборки, API/границы,
lint/форматирование и 208 клиентских регрессий проходят. Одноразовая база удалена;
рабочая база, фронтенд, сервер и оплата не менялись. M08/админка целиком не закрыты.

## Полный каталог публикаций админки — 9 октября 2026, локально

Продолжен M08: `getAllPostsAdmin` выделен в существующий
`content/post-admin-repository.ts`. Прежние SQL/сигнатура совпадают по AST;
черновики, скрытые строки, порядок по позиции и дате, вложения и отказ без БД
сохранены. Права остаются у `adminProcedure`, клиент — у прежнего фасада.

Две новые HTTP/MySQL-проверки защищают порядок при одинаковой позиции с fallback
на дату создания и отсутствие чужих вложений. Неверная дата и подстановка файлов
соседа дали по одному RED отказу; подмены убраны. Итог: 143 выбранные проверки
(62 с настоящим SQL, 81 с doubles), общий прогон 1890 успешных / 816 пропущенных.
Настоящие проверки смены роли/блокировки/отзыва сессии и compiled ESM проходят.
Типы, обе сборки, неизменный API, границы, lint/форматирование и 208 клиентских
регрессионных проверок проходят. Одноразовая база удалена; рабочая база, frontend,
оплата и сервер не менялись. Это локальный срез, не завершение всей админки/M08.

## Обычная лента — 9 октября 2026, локально

Продолжен M08: `getPosts` перенесён из общего `db.ts` в существующий
`content/post-catalog-repository.ts`. Фасад сохраняет прежнюю сигнатуру и одно
получение клиента. Исполняемое тело совпадает по AST, включая опубликованность,
канал, порядок, точное вхождение тега в JS и пакетные вложения. Проекция обычной
ленты намеренно отличается от постраничной: `likeCount` без нового `commentCount`.
Публичные контракты, права и ошибки без БД не менялись; это не оптимизация.

Две новые настоящие HTTP/MySQL-проверки защищают счётчики каждого поста и
целый тег/вложения. Общий счётчик лайков и поиск по части тега дали по одному
ожидаемому RED отказу; обе подмены убраны до переноса. Итог: 141 выбранная
проверка (60 с настоящим SQL, 81 с doubles), общий прогон 1890 успешных /
814 пропущенных SQL/внешних. Типы, обе сборки, прежний API (73 процедуры /
25642 байта), границы, lint/форматирование проходят; клиентский регрессионный
набор — 208 успешных проверок. Одноразовая база удалена; рабочая база, frontend,
стенд и оплата не менялись. M08/админка целиком не закрыты; ответ Prodamus ожидается.

## Карточка публикации и последнее объявление — 9 октября 2026, локально

Продолжен M08: `getPostById/getLatestPublishedPost` выделены в
`content/post-detail-repository.ts` за прежним фасадом. Исполняемые AST и
сигнатуры совпадают с исходными, кроме передачи прежнего клиента БД. Карточка
внутренне читает скрытые/черновые строки, но публичный API их не раскрывает;
вложения, поля, безопасные ошибки и прежние ответы без БД сохранены. Последнее
объявление использует каноническую дату публикации с fallback, не порядок ленты.
Права и повторная проверка подписки остаются в прежнем сервисе.

Две новые проверки защищают точный ID/отсутствующий пост и различие внутренней
выборки с публичной видимостью. Подмена ID дала два RED отказа; неправильная
сортировка объявления — один. После восстановления и переноса: 153 выбранные
проверки (72 с настоящим SQL, 81 с прежними doubles), общий прогон 1890 успешных /
812 пропущенных SQL/внешних. Global latest проверялся отдельно на пустом наборе
публикаций, без параллельных SQL publishers. Типы, сборка, API, границы, lint,
форматирование и ссылки проходят. Одноразовая база удалена; сервер, frontend,
настройки оплаты и рабочая БД не менялись. Это не завершение всего M08/админки.

## Чтение каталога публикаций — 9 октября 2026, локально

Продолжен M08: постраничная лента/клуб и выборка по сохранённым ID выделены в
`content/post-catalog-repository.ts`. Фасад, SQL, фильтры, лимиты, nextCursor,
порядок/повторения закладок и пакетные вложения сохранены. Права остаются в
сервисах; новый поиск в публичный `club.list` не добавлен. Исполняемые AST трёх
функций, приватные колонки/фильтр и сигнатуры фасада совпадают с исходными,
кроме передачи прежнего клиента. Это не оптимизация и не изменение админки/UI.

Две новые проверки защищают пересечение фильтров клуба и повторяющиеся закладки
с пропуском скрытых/несуществующих строк. Контрольные ошибки дали RED отказы,
после восстановления и переноса — 137 выбранных проверок: 56 с настоящим SQL,
81 с прежними maintenance/transport doubles. Общий прогон — 1890 успешных /
810 пропущенных SQL/внешних. Типы, сборка, неизменный API (73 процедуры /
25642 байта), границы, lint и форматирование проходят. Одноразовая база удалена,
рабочая база не затронута; push/deploy и настройки оплаты не менялись.

Запрос поддержки Prodamus пользователь **отправил через чат сайта**: на присланном
скриншоте есть отметка «Отправлено». Агент сообщений не отправлял, почту не читал;
прежний запрос входа в MAX больше не нужен для этой отправки. Ответ с разбором
TEST СБП MNT_ID и карточного шлюза ещё не предоставлен. Эти ошибки остаются
открытыми; локальные срезы не являются платёжной приёмкой или исправлением банка.

## Чтение вложений публикаций — 9 октября 2026, локально

Продолжен M08: общая пакетная привязка вложений и чтение медиа одного поста
выделены в `content/post-media-repository.ts`. Лента, карточка, закладки, клуб
и админка используют прежний единый путь. Сохранились группировка по посту,
порядок `sortOrder`, метаданные видео/аудио/документов, пустые массивы, SQL и
проброс ошибок без ложного пустого ответа. Клиент БД остаётся у фасада, права
доступа у прежних сервисов. Запись/удаление медиа, загрузки, фото в JSON и
внешнее хранилище не менялись; это не оптимизация скорости.

Две новые настоящие HTTP/MySQL-проверки защищают смешанные вложения карточки и
отсутствие файлов соседа у пустого поста в пакетном списке. Контрольные ошибки
порядка/выбора поста и подстановки чужого массива дали ожидаемые RED отказы;
исполняемый код перенесённых функций совпадает с исходным по AST. Итог: 102
выбранные проверки, из них 54 с настоящим SQL и 48 с прежними maintenance doubles.
Общий прогон — 1890 успешных / 808 пропущенных SQL/внешних. Типы, сборка, прежние
73 процедуры / 25642 байта API, границы, lint и форматирование проходят.
Одноразовая база удалена, рабочая база не затронута. Коммит локальный; frontend,
оплата, staging и сервер не менялись. Прежние решения и ограничения выпуска
остаются открыты; автоматическое продолжение не включалось.

## Чтение публикаций в админке — 9 октября 2026, локально

По новому запросу пользователя продолжен M08: фильтры публикаций, календарь и
статистика выделены в `content/post-admin-repository.ts`. Фасад `db.ts` сохраняет
сигнатуры и единственное получение клиента; новый модуль не открывает соединений
и не импортирует фасад. Общая сортировка ленты/админки остаётся единственной
в `content/post-order.ts`. Права, скрытые строки, SQL, порядок, лимит 5,
80 символов превью, месяцы по локальному времени сервера и прежние ответы без
БД сохранены. API прежний: 73 процедуры / 25642 байта. Это не ускорение запросов
и не переход статистики на транзакционный снимок.

Проверены настоящий HTTP/JWT/MySQL, compiled ESM, фильтры/календарь, публичная
лента и live-отказы доступа. Новая SQL-проверка использует шестую публикацию и
длинный текст; изменение лимита на 6 даёт ожидаемый RED отказ. Отдельная проверка
без БД использует существующий сессионный double и не считается SQL-приёмкой.
Итог: 100 выбранных проверок (52 с настоящим SQL, 48 maintenance с doubles),
общий прогон — 1890 успешных / 806 пропущенных SQL/внешних. Типы, сборка,
API, границы, lint и форматирование проходят. Одноразовый tmpfs-контейнер удалён,
рабочая база не затронута. Срез локальный: frontend, оплата, сервер и staging
не менялись. Прежние identity/M07c/provider/SMTP/device/dependency/rollout gates
открыты. Истёкшее ночное расписание отключено; новое автоматическое не создано.

## Доступ обычной подписчицы к статьям — 9 октября 2026, локальные тесты

Дополнена настоящая HTTP/JWT/MySQL-проверка после переноса чтения статей:
оплаченный будущий срок открывает клубный текст обычному пользователю, но
следующий запрос с той же сессией после истечения срока снова возвращает
`locked:true` и пустые `sections`. Открытая статья остаётся доступной.
`pending` и `failed` с будущим сроком доступа не дают. Блокировка уже вошедшего
платного читателя закрывает клубный текст сразу; скрытая статья не раскрывается.
Прежняя реальная сессия заблокированного аккаунта рассматривается как гостевая
на публичном запросе — правила авторизации не изменены.

Четыре новые проверки используют только синтетические строки одноразовой базы,
без сессионных/SQL doubles. Временный обход фильтра оплаты и срока дал три
ожидаемых RED отказа; исходный runtime восстановлен полностью. Итог выбранных
четырёх файлов — 85 успешных (67 с настоящим SQL); общий прогон — 1889 успешных /
805 пропущенных SQL/внешних. Типы, сборка, API, границы и lint проходят.
Одноразовая база удалена, рабочая база не затронута. Изменение только тестов
и записей о проверке, без frontend, новых платёжных правил, push или выкладки.
Это не приёмка провайдера, стенда или браузера; прежние ограничения выпуска
и необходимые решения по M07c/первой почте остаются.

## Репозиторий чтения статей — 9 октября 2026, локально

После отправки предыдущих 40 коммитов в `staging` по отдельному запросу
пользователя продолжен только локальный M08: три чтения статей выделены в
`content/article-repository.ts`. Прежний фасад, ленивый клиент, сортировка,
нормализация старых блоков, скрытые строки админки и публичные ограничения
`ContentReadService` сохранены. Запись статей/тизеров и права не менялись;
сгенерированный API прежний: 73 процедуры / 25642 байта.

Четыре новые проверки используют настоящий HTTP/JWT/MySQL и защищают публичные
краткие карточки, скрытые статьи, клубный текст и старые блоки. Три ожидаемых
RED отказа поймали временные нарушения порядка/фильтра/нормализации; исходный код
восстановлен до переноса. Исполняемый AST всех трёх запросов совпадает с исходным.
Расширенный прогон — 105 успешных, включая 40 настоящих SQL-проверок; остальные
проверки политики/maintenance используют прежние doubles. Общий прогон —
1889 успешных / 801 пропущенная SQL/внешняя проверка. Типы обеих сторон/E2E,
сборка, API, границы, lint и выбранное форматирование проходят. Одноразовая
база удалена; рабочая база не затронута. Это не серверная приёмка и не включение
оплаты. Новый срез не отправлен и не выложен; прежние identity/M07c/provider/
SMTP/device/dependency/rollout gates открыты.

## Репозиторий чтения участниц и оплат — 9 октября 2026, локально

Продолжен серверный пункт M08: два запроса и сборка административного списка
выделены из общего `db.ts` в `admin/membership-repository.ts`. Прежний фасад,
права, поля, сортировка, оплаченный срок, лимит 50 и ошибки без БД сохранены.
Новый модуль получает существующий клиент, не создаёт соединений и не импортирует
фасад обратно. Код клиента и генерируемый API не менялись. Это не ускорение
запросов и не добавление пагинации или нового платёжного сценария.

Четыре новые SQL-проверки защищают приватные поля, порядок списков, выбор только
будущего оплаченного срока, точную границу истечения и лимит истории. Временные
нарушения сортировки и границы срока дали два ожидаемых RED отказа, затем были
восстановлены до переноса. Сравнение исполняемого AST подтвердило прежние запросы.
Итог: 101 проверка пяти выбранных файлов, из них 54 с настоящим SQL, проходит;
общий прогон — 1889 успешных / 797 пропущенных SQL/внешних. Типы обеих сторон/E2E,
сборка, прежний API, границы и lint проходят. Одноразовая база удалена;
рабочая база и сервер не затронуты. Прежние identity/M07c/provider/rollout gates
остаются открытыми; это только локальный рефакторинг, без merge/push/deploy.

## Явный отказ при ручном продлении клуба — 9 октября 2026, локально

Продолжена сверка с текущей админкой: `useConfirmedAction` считает 500 или
потерю ответа неопределённым результатом, но показывает явные 4xx отказы.
`admin.grantClub` теперь возвращает 404 «Аккаунт не найден» для отсутствующего
получателя и 409 «Аккаунт недоступен для выдачи доступа» для заблокированного
или удалённого. Прежние проверки под блокировкой в транзакции, до записи.
Права администратора, расчёт 31 дня и успешный `{ok:true, expiresAt}` не менялись.
Каждое нажатие остаётся отдельной выдачей; слепой повтор при потере ответа
не стал безопасным. Провайдер, автосписания и привязка почты не затронуты.

RED: шесть проверок воспроизвели общий отказ/500 вместо нужного контракта.
GREEN: 23 проверки выдачи доступа, включая настоящий HTTP/JWT/MySQL, успешную
запись и отказ гостю/обычному пользователю/модератору/заблокированному админу.
Последний по прежней проверке реальной сессии получает 401, не 403; авторизация
не менялась. Расширенный SQL-прогон трёх файлов — 50 успешных. Общий прогон:
1889 успешных / 793 пропущенных SQL/внешних; типы обеих сторон/E2E, сборка,
API, границы и lint проходят. Одноразовая локальная база удалена после проверки;
рабочая база не затронута. Это не браузерная или серверная приёмка.
Отключённая форма первой почты и прежние rollout/dependency gates остаются
открытыми. Изменения только локальные, без frontend-правок, merge/push/deploy.

## Списки участниц и оплат — 9 октября 2026, локально

По запросу «как во фронте» повторно сверены текущая админка и staging `7524987`:
новых удалённых коммитов нет. `admin.members/payments` больше не возвращают []
при отсутствии клиента БД. Вместо ложного «участниц/оплат нет» — безопасная
HTTP 500, которую выбранный экран уже показывает с кнопкой обновления.
Успешные поля, сортировка, лимит оплат и расчёт доступа после выдачи не менялись.
Проверка клиента не доказывает живость соединения и не подтверждает прошлую запись.

Четыре RED проверки воспроизвели [] вместо отказа; все 47 проверок модуля проходят.
Настоящий SQL: 42 проверки выдачи доступа, списков, контента и аудита успешны
на одноразовой базе. Тестовый контейнер затем удалён; рабочая база не затронута.
В HTTP-проверках отсутствующей БД подменён только поиск сессии, не чтение:
это не приёмка реального JWT в режиме недоступной БД.
Общий прогон 1889 успешных / 785 пропущенных SQL/внешних; типы обеих сторон/E2E,
сборка, API, границы и lint проходят. Браузерная приёмка и сервер не проверялись.
Привязка почты во фронте — локальная отключённая форма; по просьбе следовать
фронту её не активировали и не добавляли новый identity-контракт.

## Устаревший редактор статьи — 9 октября 2026, локально

Повторно сверены текущий фронтенд и админка: staging `7524987` / фронтенд
`0b77270` уже включены в feature-ветку, новых удалённых коммитов нет.
Исправлен `admin.updateArticle`: если статью удалили после открытия редактора,
сервер возвращает NOT_FOUND / HTTP 404 «Статья не найдена», а не `{ok:true}`.
Текущий редактор уже сохраняет draft при таком явном отказе — фронтенд не менялся.
Проверка находится в существующей транзакции под блокировкой статьи, поэтому
правка после ожидания параллельного удаления тоже отклоняется, не создаёт тизер.
Повтор той же непустой правки существующей статьи успешен. Повторное удаление
отсутствующей статьи и очистка её старого тизера остаются идемпотентными.

RED: четыре настоящих HTTP/JWT/SQL проверки выявили ложное подтверждение;
GREEN: 36 проверок статей, расширенный прогон восьми файлов — 156 успешных,
включая compiled ESM, права, откаты и публикацию. Общий прогон: 1877 успешных /
782 пропущенных SQL/внешних; типы обеих сторон/E2E, backend-сборка, API,
границы и lint проходят. Это не браузерная или серверная приёмка. Проверки
использовали только синтетические данные в одноразовой локальной базе.
После проверки этот тестовый контейнер удалён; рабочая база не затронута.
Проверка версий конкурирующих правок и улучшение ошибки пустого patch остаются
за пределами изменения. Привязка первой почты всё ещё ждёт подтверждения
identity-сценария. Сервер, провайдер, права и зависимости не менялись.

## Оплата после блокировки участницы — 9 октября 2026, локально

Новые проверки подтверждают прежнюю политику: подписанное уведомление об оплате
заблокированного аккаунта получает HTTP 422, без изменения заказа, доступа,
платёжного профиля, квитанции, ссылки входа или очереди письма. Это относится
к первой оплате, продлению и повтору уже сохранённой квитанции. После снятия
блокировки допустимый повтор проходит: ровно один период и одна запись каждого
эффекта, без повторного продления на следующем уведомлении. Уже оплаченная история
при отказе не удаляется. Правила блокировки, сессий и оплаты не изменены.

Дополнительно проверен отказ первой оплаты при несовпадении владельца, почты
или суммы сохранённого профиля; данные обеих участниц остаются неизменными.
Использовались настоящие HTTP и SQL, но только синтетические подписи, участницы
и одноразовая локальная база. Блокировка задавалась в SQL; реальные запросы
админки проверены отдельно в предыдущем шаге. SMTP и провайдер не вызывались.
Шесть новых случаев, расширенный SQL-прогон — 98 успешных; общий — 1877 успешных /
777 пропущенных SQL/внешних. Временное удаление защит воспроизводит ошибки тестов,
все изменения рабочего кода восстановлены. Сборка, типы, API, границы и lint проходят.
База удалена после проверок, сервер не менялся. Привязка первой почты всё ещё
ждёт отдельного подтверждения сценария.

## Сверка новой админки — 9 октября 2026, локально

Фронтенд `0b77270` уже включён в staging `7524987` и текущую feature-ветку.
Новых удалённых правок после fetch нет. Редакторы используют прежние числовой ID
createPost и `{success:true}` updatePost, подтверждённые метаданные вложений и
idempotencyKey; сезоны — revision и полный снимок, заказ менеджеру — публичный
managerEmail/orderMethod, повтор доступа — HTTP 202 `{queued:true}`, не доставку.
Сами эти контракты не изменены.

Исправлены ложные подтверждения для исчезнувших целей: `admin.confirmPost`
отсутствующего поста теперь возвращает NOT_FOUND / HTTP 404 «Публикация не найдена».
Повтор существующего опубликованного поста всё ещё успешен, без повторного анонса.
`moderation.blockUser/unblockUser` отсутствующего аккаунта возвращают NOT_FOUND /
HTTP 404 «Аккаунт не найден»; не меняют данные, не ставят отмену в очередь и не
добавляют аудит выполненного действия. Проверка существования под блокировкой
остаётся в транзакции. Успешные `{ok:true}`, права и политика сессий не меняются.
Новые экраны должны показать отказ и обновить список, не подтверждать действие
и не повторять его автоматически. Удаление уже отсутствующей жалобы сохраняет
свой прежний идемпотентный ответ — эту операцию не изменяли.

Настоящие HTTP/JWT/SQL проверки: 231 случай / 12 файлов на одноразовой базе,
включая запись/откат, параллельную публикацию, комментарии, настройки и роли.
Общий прогон: 1877 успешных / 771 пропущенный SQL/внешний случай. Типы обеих
сторон, backend-сборка, API, границы и lint проходят. Это локальная сверка,
не деплой, приёмка физических устройств или подтверждение SMTP/провайдера.
Привязка первой почты всё ещё отключена: сценарий подтверждения адреса и права
записи задан отдельным вопросом пользователю; новые identity-правила не включены.

## Ключ создания публикации — локальный следующий шаг, 7 октября 2026

Оба редактора через PostSaveCoordinator отправляют `idempotencyKey`: новый UUID
создаётся только перед финальным create, после подтверждения файлов. Одинаковый
повтор после явного 4xx сохраняет ключ и payload; изменение текста или состава
вложений после такого отказа получает новый ключ. Новое создание после успеха
имеет отдельный ключ, даже при одинаковом тексте. Ключ не передаётся в update.

Одновременный финальный запрос заблокирован. Повторная проверка перед записью
не позволяет поздней загрузке начать правку уже созданного поста. При отсутствии
поддержки безопасного UUID create не отправляется; закрытие не блокируется.
Неизвестный результат по-прежнему нельзя повторять вслепую. Ключ и сравнение
payload живут только в памяти редактора; полный F5.1 после reload ещё открыт.

Добавлены десять unit-проверок и четыре браузерных сценария двух редакторов.
Сначала выявлены семь ошибок отсутствующего ключа/защиты, затем отдельная
регрессия поздней загрузки после подтверждённого create. После исправления:
711 unit/сервисных тестов без MySQL прошли, четыре проверки пропущены;
34 выбранные браузерные проверки прошли на свежей production-сборке, затем
полный прогон: 236 прошли / 3 real-development-API проверки пропущены.
Браузерные API-фикстуры не заменяют проверку настоящей SQL-идемпотентности.
Регрессионный `pnpm verify` включает новый набор и проходит 251 проверку;
типы, lint, API (72 процедуры), границы (456 файлов), ссылки и обе сборки проходят.
Из-за нехватки диска сборочный кеш временно отключался; временная правка
`next.config.mjs` полностью убрана. Схема, API, зависимости, сервер и удалённые ветки
этим шагом не менялись. Приёмка SQL/SMTP/оплат в этом запуске не выполнялась.

## Совместная проверка интерфейса — 7 октября 2026

По разрешению владельца исправлены оба веб-редактора: выбранные фото/видео
не считаются пустым списком после отказа или неизвестного результата загрузки.
Сохранение и новый выбор файлов блокируются до подтверждения загрузки либо
явного отказа пользователя. Подтверждённые файлы сохраняются. После неизвестного
результата записи поста закрытие редактора не сбрасывает защиту от повторной
отправки. Это защита текущего редактора, не восстановление после перезагрузки:
полный F5.1 с постоянным намерением и idempotencyKey остаётся открытым.

Все 38 браузерных проверок редакторов/загрузки прошли, включая шесть новых
регрессий, которые воспроизводили ошибки до исправления. На отдельной MySQL
прошли десять проверок B2, включая настоящий откат поста и медиа, и 87 проверок
content/nest-content/nest-admin-content/идемпотентности создания. Предыдущие
указания ниже о пропуске SQL относятся к предыдущим запускам, не к этой проверке.
После очистки оставшихся синтетических данных от прерванного запуска также
прошли все 52 HTTP/MySQL-проверки manual-publication, включая B7. Итого 149
выбранных SQL-проверок. Рабочая база стенда не использовалась для разрушительных
тестов; отдельный тестовый контейнер и его том удалены.

Реестр метаданных новых видео (часть B2), версия поста при конкурирующей правке
и восстановление неподтверждённого намерения после перезагрузки не реализованы.
Эта запись сама по себе не подтверждает обновление сервера.

Позднее в этом запуске тестовый стенд обновлён до 5c4a9cc: результат и границы
проверок записаны в [инструкции стенда](../operations/teamassist-staging.md).
Удалённая Git-ветка staging не менялась.

Дополнительно убрано отложенное восстановление старой позиции просмотрщика
фото: оно могло отменить новое перелистывание. После новой production-сборки
30 повторных браузерных проверок редактора, перелистывания и изменения размеров
прошли. Сборку необходимо обновлять перед Playwright: его webServer запускает
`pnpm start`, а не собирает текущие исходники автоматически.

Состояние исходного кода на 5 октября 2026 года. Бэкенд находится в ветке
`fix/backend-hardening`. Это инструкция для подключения изменений API, не
подтверждение деплоя. Интерфейс, фронтенд-тесты и сгенерированные типы в этом
этапе не менялись по договорённости с владельцем проекта.

Главная задача: использовать подтверждённые сервером метаданные вложения при
сохранении публикации. Сервер теперь возвращает их, но текущий редактор всё ещё
подставляет MIME и размер локального файла. Исправление редактора остаётся за
фронтендером; одной серверной правкой этот сценарий не закрыт.

## Сохранение идентичности видео (B2, 7 октября)

В локальной ветке `integration/frontend-backend-2026-10-07` переданный список
`videos` больше не пересоздаёт все строки. Оставшиеся видео сохраняют ID, MIME,
имя, размер, длительность и дату создания; перестановка меняет только sortOrder.
Удаляются только исключённые видео данного поста. Аудио, документы и чужие посты
не затрагиваются. Сохранение использует прежнюю транзакцию и блокировку поста;
внутренняя обёртка `replacePostVideos` также направлена через этот путь.

Совпадение — по полному URL после trim входа, включая параметры ссылки.
Повторы одной ссылки не склеиваются: сопоставляются отдельные существующие
строки по прежнему порядку sortOrder/id. `videos` отсутствует — видео не меняются;
`[]` — удаляются только видео данного поста. Пустые строки пропускаются с
сохранением индексов массива как sortOrder.

Для новых URL mimeType, fileSize и duration остаются null: сервер больше не
подставляет MP4 без доказательства. Имя по-прежнему извлекается из URL ради
совместимости, но это не подтверждённое имя загрузки. Существующие неточные
метаданные автоматически не исправляются. Реестр подтверждённых загрузок и
согласование источника метаданных новых видео остаются отдельной частью B2;
полностью закрытым этот пункт пока не считается. Фронтендеру: обрабатывать
неизвестные метаданные, не угадывать формат и не подменять их локальными данными.
Формат входа/успешного ответа, схема и сгенерированные типы не изменены.

До исправления 16 проверок выявляли пересоздание/ложный MIME; после исправления
они проходят с реальным helper/Drizzle и подменённым SQL-транспортом. Общий
локальный прогон без MySQL: 699 успешных тестов / 4 пропуска. Добавлены 10
проверок сохранённых строк и полного отката правки на disposable MySQL, включая
ошибку финального сохранения вложения. Они пропущены: Docker сообщает EOF,
тестовая MySQL не настроена. Это не подтверждение реального SQL-отката, приёмки
интерфейса, слияния в staging или обновления сервера.

## Ошибка чтения медиа (B1, 7 октября)

В локальной ветке `integration/frontend-backend-2026-10-07` сбой SQL медиа
больше не превращается в успешный пост с `media: []`. Запросы ленты/поста/клуба,
выборка постов по ID и `admin.posts` / `admin.getPostMedia` получают
`INTERNAL_SERVER_ERROR` / HTTP 500 «Внутренняя ошибка сервера». Недоступная БД
в этих helpers тоже ошибка. Настоящий пустой список остаётся успешным;
после восстановления возвращаются прежние ID, MIME, имя, размер и длительность.
Формат успешных ответов и типы 72 процедур не менялись.

Фронтендеру: не подставлять пустые вложения после ошибки чтения. Пока полная
исходная модель не получена, нельзя сохранять изменённый список видео; показать
ошибку и позволить повторить чтение, сохранив локальный черновик. Сервер не
проверяет факт успешного чтения клиентом: UI-приёмка остаётся отдельной задачей.

До исправления воспроизведён 21 ошибочный исход. После него проходят 33 проверки
реальных helpers/Drizzle с подменой только SQL-транспорта, включая HTTP 500 без
утечки SQL и восстановление метаданных. Отдельно проверен собранный сервер
без БД. Полный прогон без MySQL: 683 успешных теста / 4 пропуска; типы, lint,
сборка и API проходят. 51 проверка существующих HTTP/JWT/MySQL-наборов пропущена:
локальный Docker возвращает EOF. Это не приёмка на реальной базе и не деплой.

## Правка удалённого поста (B7, 7 октября)

В локальной интеграционной ветке `admin.updatePost` теперь возвращает
`NOT_FOUND` / HTTP 404 «Публикация не найдена» для любой правки отсутствующего
поста, а не ложный `{ success: true }` без вложений. Это касается текста,
фото, видео, статуса и пустых массивов. Успешный ответ существующего поста
не меняется; ошибки не отправляют анонс. `admin.confirmPost` не изменён.

Фронтендеру: сохранить введённый черновик, показать ошибку, не закрывать редактор
как после успеха и не повторять такую правку автоматически. Интерфейс и файл
типов в этом шаге не изменены, новая схема БД не требуется.

До исправления шесть сценариев дали ложный успех. После исправления проходят
13 проверок редактора/сервиса/tRPC; чтение SQL в них подменено. Добавлены также
регрессии в `tests/manual-publication.mysql.test.ts` для HTTP/JWT/MySQL, включая
удаление существующего поста и отсутствие побочных изменений медиа. Локальная
MySQL недоступна: эти интеграционные проверки пропущены и остаются обязательными
перед приёмкой. Это описание исходного кода, не подтверждение обновления сервера.
Полный локальный прогон без MySQL: 650 успешных тестов / 4 пропуска;
проверки типов, сборки бэкенда, контракта API и границ модулей проходят.

## Новый ответ загрузки медиа

Процедура `admin.uploadMedia`, базовый путь tRPC `/api/trpc`. Входные поля и
проверки доступа не изменены. К прежним `url` и `mediaId` добавлены:

| Поле       | Значение                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `mimeType` | Итоговый MIME, который сервер передал в хранилище; может отличаться от заявленного клиентом и содержать параметры, например charset. |
| `fileSize` | Число байт декодированного файла, а не длина base64.                                                                                 |
| `mediaId`  | ID связи с публикацией только при переданном ненулевом `postId`. Без него загрузка остаётся несвязанной.                             |

Пример standalone-загрузки: браузер заявил `audio/mpeg`, но сервер распознал WAV.
Значения ниже демонстрационные; это объект данных после декодирования tRPC, не
полный HTTP-конверт SuperJSON.

```json
{
  "url": "https://assets.example.test/feed/audio/opaque-object-id",
  "mimeType": "audio/wav",
  "fileSize": 46
}
```

`url` — непрозрачная ссылка. Имя/расширение файла нельзя извлекать из URL:
сервер использует UUID без клиентского расширения. `filename` остаётся отдельным
отображаемым именем в данных вложения. `admin.uploadPhoto` не меняется: у него
прежний ответ `{ url }`, без обязательных новых полей.

## Что изменить в редакторе

1. После получения бэкенд-правок из Git выполнить `pnpm api:contract` из корня монорепозитория
   и включить сгенерированные типы в свой коммит. Не редактировать типы вручную.
2. В `PostSaveCoordinator` из `apps/frontend/src/domain/post/save-post.ts` брать
   `url`, `mimeType` и `fileSize` из ответа `admin.uploadMedia`. Именно их передавать
   в `attachments` процедур `admin.createPost` и `admin.updatePost`, а не
   `attachment.mimeType` и `attachment.file.size` из браузера.
3. Проверять ответ: допустимый HTTP(S) URL без встроенных логина/пароля,
   непустой MIME в пределах 128 символов без управляющих символов, размер —
   положительное безопасное целое. Отсутствие/повреждение подтверждения не
   заменять локальными метаданными и не считать успешной загрузкой.
4. Сохранять подтверждённые метаданные вместе со ссылкой в кеше подготовленных
   вложений. При явном отказе финального сохранения повтор использовать кеш,
   не загружать подтверждённые файлы заново. Вложение, удалённое из черновика
   перед повтором, в финальный запрос не включать.
5. Сохранить существующую последовательность: все standalone-загрузки без
   `postId`, затем один запрос создания/правки с полным набором вложений.
   Не добавлять промежуточную публикацию или привязку каждого файла отдельно.

Потеря ответа, таймаут и серверная ошибка не доказывают, что запись не состоялась.
Не повторять автоматически `uploadMedia` и `updatePost` при неизвестном результате.
Загрузка не идемпотентна: повтор создаёт новый объект. Неполный ответ загрузки
тоже оставляет неизвестный результат; нельзя создавать частичный пост или
слепо повторять загрузку.

## Защита повторного создания поста

У `admin.createPost` есть optional `idempotencyKey`; оба веб-редактора теперь
передают его через общий coordinator. Постоянное намерение после reload и
осознанное восстановление при неизвестном результате — оставшаяся задача.
Сгенерировать UUID один раз для намерения создать пост, сохранить тот же ключ
и тот же payload для повторов при неизвестном результате. Новый ключ на каждый
повтор лишает механизм смысла. Повтор с тем же ключом и другими данными получает
`CONFLICT` / HTTP 409. Другой администратор имеет отдельное пространство ключей.

Не переносить эту гарантию на загрузку или правку поста: для них такой ключ
не реализован. Перед использованием прочитать
[описание контракта](../architecture/api.md#ключ-повторного-создания-публикации).

## Какие проверки добавить на фронте

- Создание и правка с WAV, заявленным как MP3: в финальном запросе сохраняются
  `audio/wav` и серверный размер. Имя файла остаётся пользовательским.
- Документ с MIME `application/octet-stream`: после распознавания PDF/DOCX или
  текста сохраняется серверный MIME, включая добавленный charset текста.
- Явный отказ финального сохранения и повтор: серверные метаданные сохраняются,
  подтверждённый файл загружается только один раз.
- Неполный/повреждённый ответ загрузки: пост не создаётся/не меняется,
  автоматического повтора загрузки нет.
- Закрытие редактора/смена сессии: поздний ответ не запускает финальное сохранение.
- Обновить uploadMedia-моки в unit- и браузерных тестах новыми полями;
  фото-моки остаются URL-only. Проверить UI-сценарий и отдельно реальный API,
  не считать браузер с сетевыми моками проверкой провайдера хранилища.

## Результаты проверок бэкенда

Для изменения ответа admin.uploadMedia нативные HTTP/JWT/MySQL-тесты
сначала выявили шесть отсутствующих подтверждений
метаданных; после исправления все 140 тестов загрузок прошли. Подменяется только
транспорт хранилища; распознавание файлов, HTTP, сессии и SQL работают реально.
Полный прогон на временной MySQL: 851 успешный тест, 2 пропущенных проверки
внешнего S3. Включены проверки реального mysqldump и восстановления тестовой
таблицы. Проверены сборка бэкенда, TypeScript, существующий lint, границы
модулей и ссылки документации. Полный CI не зелёный: `check:api` требует
обновления оставленного фронтендеру файла типов.

Проверка production-зависимостей `pnpm audit --prod` на 5 октября:
0 critical, 18 high, 26 moderate, 4 low. Это число сообщений аудита, не число
подтверждённых эксплуатируемых ошибок проекта. Исправления зависимостей в этот
этап не включены; до открытого запуска нужно разобрать достижимость и исправить
применимые уязвимости, не выполнять массовое принудительное обновление.
Проверки реальных платежей, SMTP, приватности файлов и деплоя здесь не заявляются.

## Отдельная загрузка видео: совместимость

`POST /api/admin/upload-video` теперь проверяет формат по байтам, а не доверяет
Content-Type клиента. HTML, SVG, документы, архивы, MP3/WAV и неизвестные байты
под меткой MP4 отклоняются до записи в хранилище. MP4, WebM и MOV принимаются;
неверная метка внутри семейства video исправляется на распознанный MIME.
Это проверка контейнера, не видеодорожек или воспроизведения.

Ответ остаётся `{ url }`: не ожидать здесь mimeType/fileSize из admin.uploadMedia.
Входной filename, права администратора, отсутствие заголовка (default video/mp4)
и лимит 80 MiB сохранены. Ошибка формата — 400 `Некорректный видеофайл`,
превышение HTTP-предела — 413 `Запрос слишком большой`; инфраструктурная ошибка
остаётся общим 500. Интерфейс и его типы для этого исправления не менялись.

До исправления воспроизведены 20 ошибочных исходов raw-загрузки. Теперь проходят
34 нативных HTTP/JWT/MySQL-сценария с настоящим распознавателем и 4 HTTP-сценария
инъекции ошибок распознавания/хранилища. Проверен фактический запрос больше 80 MiB.
Транспорт хранилища подменён: реальные настройки/заголовки провайдера не проверены.
Полный прогон после этой правки: 889 успешных тестов, 2 пропущенных внешних S3;
реальные резервное копирование и восстановление тестовой БД включены.

Отдельным шагом устранено совпадение ключей видео: теперь каждый запрос получает
UUID вместо временной метки. При фиксированном времени два последовательных
и четыре параллельных запроса раньше передавали в хранилище один ключ;
после исправления получают разные ключи. Это проверено на реальном API с
подменённым транспортом, не эксперимент с перезаписью реальных файлов.
Имя после очистки сохранено в конце ключа, старые URL не меняются. Повтор
загрузки всё ещё создаёт новый объект, не следует считать запрос идемпотентным.
Итог: 36 нативных raw-сценариев; полный прогон — 891 успешный тест / 2 внешних
S3 пропуска. TypeScript, lint, сборка бэкенда и границы модулей проходят.
Общий CI всё ещё блокируется оставленным фронтендеру snapshot типов admin.uploadMedia.

## Импорт ссылки: ошибка входных данных

У `admin.importVideoUrl` изменён ответ на недопустимую ссылку: теперь это
BAD_REQUEST / HTTP 400 с объяснением, а не 500 «Внутренняя ошибка сервера».
Не трактовать такой ответ как временный сбой и не повторять запрос автоматически.
Допустимая ссылка прежним образом возвращается как `{ url }`; внешние пробелы
удаляются. Сервер ничего не скачивает и не копирует. Принимается только точный
настроенный HTTPS origin/bucket, но это ещё не подтверждение владения или формата
объекта. Новые провайдеры или интеграции этим исправлением не включены.

Четырнадцать ошибочных ответов воспроизведены до исправления. После него проходят
21 нативный HTTP/JWT/MySQL-сценарий, полный прогон — 912 успешных тестов / 2 внешних
S3 пропуска, с резервным копированием и восстановлением временной БД. Проверены
неправильные ссылки, прежний успешный ответ и живая авторизация; серверные fetch
и транспорт хранилища перехвачены, ни один сценарий не вызывает их.
Фронт и его типы остаются без изменений. Прежний блокер общего CI не снят.

Затем обработка ссылки перенесена в `ContentUploadService`, внедрённый через
ContentModule/TrpcService. Политика origin/bucket находится в
`apps/backend/src/content/video-import-policy.ts`; старый raw-адаптер больше
не отвечает за импорт ссылок. Ответы и проверки доступа после исправления
сохранены. Типы всех 72 процедур до/после переноса совпадают по результату
сравнения в памяти; фронтенд-файл не генерировался. Повторный полный прогон —
912 успешных тестов / 2 внешних S3 пропуска. TypeScript, lint, сборка бэкенда
и проверки 423 исходных файлов по границам модулей проходят.
На этом промежуточном этапе бинарная raw-загрузка ещё имела прежний адаптер;
следующий завершённый шаг описан ниже.

## Бинарная загрузка: перенос в Nest

Прежний `POST /api/admin/upload-video?filename=...` теперь обслуживает
VideoUploadController из ContentModule через внедрённые ContentUploadService и
SessionService. Старый admin-video.ts удалён. Адрес, вход, успешный статус 200
и ответ `{ url }` не изменены: фронтенду не нужны правки для этого переноса.
Лимит 80 MiB, проверки MIME/сигнатуры, UUID-ключи и сообщения ошибок сохранены.

Авторизация осталась двухэтапной: до чтения большого тела в middleware и после
его получения в контроллере по свежим JWT/SQL. Реальные потоковые HTTP-тесты
проверяют смену роли, блокировку и отзыв сессии во время передачи файла;
во всех случаях запись в хранилище запрещена. При временном отключении второй
проверки эти три теста падают. Это подтверждение сохранённой защиты, не новый
обнаруженный обход в исходном коде. Ошибка входной политики даёт 400;
ошибка провайдера остаётся общим 500, даже если имеет код BAD_REQUEST.

Отдельный процесс Node проверяет собранный ESM-код с настоящими JWT/MySQL и
распознавателем, без загрузки deployment-настроек, фоновых задач или обращения
к внешнему хранилищу. Это не подтверждение работы S3 или production-деплоя.

Итог этого этапа: 39 нативных raw-сценариев, отдельный тест собранного ESM и
4 сценария инъекции ошибок; полный прогон — 916 успешных тестов / 2 внешних S3
пропуска, с реальным резервным копированием/восстановлением временной MySQL.
Типы, lint, сборка и границы модулей проходят. Все 72 tRPC-типа совпадают с
состоянием до переноса; файл типов фронтенда не генерировался. Блокер check:api
из-за ранее добавленных метаданных uploadMedia не снят.

## Чтение данных админки: перенос в сервис

admin.posts/postsFiltered/scheduledPosts/getPostMedia/stats теперь вызывают
внедрённый ContentReadService, а не SQL-helpers прямо из роутера. Входные схемы,
ответы, сортировка, поля вложений и подсчёт статистики не изменены. Фронтенду
не нужны правки для этого переноса; прежняя задача типов uploadMedia остаётся.
Черновики и скрытые материалы доступны только действующему администратору,
не модератору. Блокировка и отзыв сессии проверяются по свежим данным MySQL.

Новое покрытие проверяет настоящие HTTP/JWT/SQL и отдельный процесс собранного
ESM-сервера. При временной ошибочной подстановке публичной ленты тест каталога
падает: из админки исчезают черновики/скрытые материалы. Это проверка регрессии,
не найденный новый обход доступа. Запросы SQL не переписаны: пагинация админки,
оптимизация статистики и её старые дубли реакций остаются отдельными задачами.
Статистика по-прежнему считает строки реакций, не уникальных пользователей.

Итог этапа: 19 нативных сценариев, включая проверку собранного ESM; целевой
прогон пяти файлов — 90 тестов. Старый серверный тест публикации теперь передаёт
обязательную зависимость чтения в фабрику роутера; его шесть проверок восстановлены.
Последний полный прогон — 935 успешных тестов / 2 внешних S3 пропуска с настоящим
backup/restore временной MySQL. Типы, lint, сборка и границы модулей проходят;
контракт всех 72 процедур совпадает с состоянием до переноса. check:api остаётся
заблокирован прежним snapshot фронтенда; он не генерировался.

Ограничение проверки: один полный прогон упал на ожидании блокировки второго
конкурентного toggleSave в существующем тесте обсуждений. Отдельный прогон,
совместный прогон с новыми тестами админки и полный прогон с временной
диагностикой прошли; последний полный прогон с исходной проверкой тоже проходит.
Причина не воспроизведена и исправление не заявляется.
Диагностика удалена, ожидания и проверки исходного теста не ослаблены.
Перед слиянием нужен разбор этого эпизода, не автоматическое повторение CI.

## Порядок интеграции и ограничения

Сначала выложить сервер с расширенным ответом, затем редактор и его типы.
Новая версия сервера совместима со старым редактором, но тот не использует
исправленные метаданные. Новый редактор с обязательными полями ответа нельзя
выкладывать раньше сервера. `pnpm check:api` сейчас ожидаемо выявляет устаревший
фронтенд-контракт; проверка не отключена. Слияние этой правки в `staging`
отложено до обновления типов фронтендером и прохождения общего CI.

После fetch ветка `origin/fix/migrate-frontend-to-nextjs` уже входит в
`origin/staging`; новых коммитов фронтендера вне staging на момент проверки нет.
Это снимок Git, не обещание отсутствия последующих изменений.

Серверные задачи, не закрытые этой передачей: Word-специфичная проверка legacy
DOC (заявленный `application/msword` пока обходит проверку байт), подтверждённое
владение загруженными объектами и безопасная уборка несвязанных файлов,
правила приватности/выдачи публичных URL и аудит зависимостей.
Сигнатура не доказывает отсутствие активного содержимого или безопасность файла.
Метаданные ответа не заменяют серверный реестр владения вложениями.

Тестовый сервер пока не подтверждён. Старые deploy-скрипты предназначены для
прежнего статического фронта/инфраструктуры; их не запускать для Next.js.
Нужны согласованный адрес и SSH-доступ, отдельная тестовая БД, изолированные
платежи/письма/хранилище и возможность отката. Production не затрагивался.

## Дополнение 6 октября: административные статьи

Исторические статусы выше относятся к этапу передачи 5 октября. Текущая ветка
`refactor/nest-admin-articles` продолжает перенос NestJS: admin.articles вызывается
через ContentReadService, createArticle/updateArticle/deleteArticle — через
ContentWriteService. Имена процедур, входные схемы и ответы не изменились;
фронтендеру не нужны правки для этого переноса. Текущий строгий check:api проходит
(72 процедуры, 25461 байт), типы фронта на этом этапе не генерировались.
Это не подтверждение исправления интерфейса редактора из начала документа.

Проверены настоящие HTTP/JWT/MySQL: черновики и закрытые статьи в админке,
блоки/обложки, публикация и снятие с публикации, SQL-очистка анонса, валидация,
обычная/модераторская роль, блокировка и отзыв сессии. Есть отдельный запуск
собранного ESM. Новые 20 сценариев и целевой прогон трёх файлов (68 тестов)
проходят. Намеренная замена каталога только опубликованными статьями ломает
проверку черновика; до переноса она восстановлена.

Последний полный прогон: 1032 успешных / 4 пропуска (внешний S3 и нативный
Docker backup/restore здесь не проверялись). Первый полный запуск выявил ошибки
настройки временной среды; их диагностика и исправление описаны в [плане](../../tasks/plan.md).
Проверки и таймауты не менялись. Типы, lint, сборка, API, границы и ссылки проходят.

Статья и анонс пока записываются раздельно. Анонс даже public-статьи остаётся
в club; несуществующий ID с непустой правкой возвращает {ok:true}, пустая
правка не обрабатывается специально. Это сохранённое поведение, не исправленные
ошибки. Риски транзакций, политики анонса и семантики обновления требуют отдельных
правок. Push, merge и обновление стенда этим этапом не выполнялись; сведения о
ранее развёрнутом тестовом сервере — в [операционной инструкции](../operations/teamassist-staging.md).

## Следующий этап 6 октября: согласованность статьи и анонса

Ветка `fix/article-write-consistency` исправляет раздельное сохранение, описанное
выше. Создание, правка, снятие с публикации и удаление теперь записывают статью,
анонс и его SQL-связи одной транзакцией. Ошибка любого шага откатывает изменения;
два запроса article API к одной статье выполняются последовательно, без нового
дублирующего анонса. Удаление повторно использует общий каскад публикации, а не
вложенную транзакцию с отдельным commit. Подготовительный рефакторинг сохранён
отдельным коммитом `370e5d7`.

Фронтендеру не требуется менять схемы или типы: API, ответы и политика анонса
не изменились. public-статья по-прежнему получает анонс в club; непустая правка
отсутствующего ID возвращает `{ok:true}`, пустая правка сохраняет прежнюю ошибку.
Один исходный повтор создания после потерянного ответа всё ещё может создать
другую статью: идемпотентность здесь не добавлена. Исторические дубли source,
редактирование анонса через общий post API и физические файлы также вне этого
исправления. Для нескольких отдельных чтений по разные стороны commit нужна
своя согласованная read-транзакция; гарантия записи не заменяет её.

На старом поведении воспроизведены девять провалов; после исправления проходят
11 новых тестов с реальными SQL-ошибками и контролируемой конкуренцией. Целевой
прогон — 44 успешных, включая прежние проверки HTTP/JWT/MySQL, каскада и
собранного ESM. Полный прогон: 1043 успешных / 4 пропущенных (внешний S3 и
нативный Docker backup/restore не проверялись). Типы, lint, сборка, неизменный
контракт API, границы модулей и ссылки проходят. Временные контейнеры, тестовая
БД, сеть и приватные артефакты удалены после проверки принадлежности; их можно
воссоздать из тестов. Код фронта, миграции и развёрнутый стенд этим этапом не
изменялись; четыре контейнера стенда исправны, версия API/web остаётся `12cfc8d`.
Push/merge и обновление стенда не выполнялись. Следом — оставшиеся
административные операции M05; общие блокеры выпуска остаются открытыми.

## Повтор незавершённой регистрации — 6 октября

На ветке `fix/pending-registration-retry` повтор POST /api/auth/register для
обычного незаблокированного аккаунта без установленного пароля получает прежний
202 `{ok:true,message:string}` вместо ошибочного предложения войти. Для этого
нужно исходное письмо самостоятельной регистрации; аккаунт, созданный только
checkout, не считается незавершённой регистрацией. Активные и служебные аккаунты
сохраняют 409. Повтор не меняет имя, права, согласие или пароль и не выдаёт сессию.

Пригодное письмо в очереди используется повторно. После отправки или истечения
ссылки можно запросить новое; максимум три password-setup записи очереди на
аккаунт/адрес за скользящий час, включая первое и неотправленные. Лимит хранится
в MySQL, запросы сериализованы блокировкой пользователя. Превышение даёт тот же
202 без нового письма и без отмены прежних действующих ссылок. Восстановление
ещё не установленного пароля разделяет этот лимит, а восстановление уже
установленного сохраняет прежнюю замену ссылки. SQL-ошибка откатывает новое
письмо и токен вместе. Вход доступен только после установки пароля по ссылке;
само завершение установки не выдаёт cookie.

Фронтендеру: формат ответа и типы не менялись. 202 означает принятие запроса,
не факт доставки и не вход; нельзя переводить пользователя в авторизованное
состояние. Для незавершённой регистрации теперь можно повторить получение письма
из той же формы. Код и сгенерированные типы фронта здесь не изменялись.

Настоящая отправка в Gmail остаётся отдельным незавершённым этапом: на стенде
SMTP-доступ отсутствовал. Пользователь предоставит отдельную тестовую
конфигурацию защищённым локальным файлом. Не открывались внешняя сеть/интеграции,
не использовались реальные почтовые данные. Пока не настроены SMTP и выкладка,
этот локальный ремонт не исправляет отправку на развёрнутом стенде. Лимит
ограничивает новые письма в очереди, а не повторные сетевые попытки доставки.

Проверка окончательной версии: 58 целевых тестов; полный прогон — 1059 успешных
и 4 пропуска (внешний S3 и нативный Docker backup/restore не проверялись).
Новые проверки используют HTTP, MySQL и настоящий SMTP-протокол с локальным
приёмником, включая отказ доставки, конкуренцию, SQL-откат, старые ссылки и
обход лимита через восстановление. Собранный production ESM также проверен.
По скиллам TDD сначала воспроизведены провалы, затем сделано ревью прав,
транзакций и конкурентного лимита. Типы, lint, сборка, неизменный API, границы
модулей и ссылки проходят. Это не подтверждение доставки во внешний ящик.

Временные контейнеры, синтетическая БД, сеть и приватные артефакты удалены после
проверки принадлежности; тесты позволяют воссоздать среду. Реальные данные не
удалялись. Стенд остаётся исправным на версии `12cfc8d`, HTTPS возвращает 200.
Push/merge и выкладка этого исправления не выполнялись.

## ЮKassa: серверный тестовый сценарий — 7 октября

На ветке `feature/yookassa-test-checkout` добавлен выключенный по умолчанию
адаптер разовой тестовой оплаты клуба. Это не включение оплаты на сайте:
фронт, его сгенерированные типы, работающая БД и конфигурация стенда не менялись.
Карты не сохраняются, автосписания и платежи магазина не добавлены.

`club.createCheckout` сохраняет вход `{email?,plan?}` и ответ `{url,user:null}`.
В режиме `YOOKASSA_TEST_ENABLED=true` нужен HTTP-заголовок
`Idempotency-Key: <UUID>`, например UUID от `crypto.randomUUID()`.
Один ключ относится к одной покупке: сохранить его до запроса, повторять при
ошибке/таймауте и после перезагрузки. Не генерировать ключ при каждом клике.
Не использовать разные email/plan с прежним ключом (409). Повтор с неизвестным
результатом старше 23 часов требует проверки поддержкой (412), не новой оплаты.
400 без ключа означает ошибку клиента; 400 «Платёж отменён» допускает новую
осознанную покупку с новым ключом. 503 и 409 «обрабатывается» не означают отказ
платёжной системы: повторять прежний запрос позже, не заменять ключ автоматически.
Заголовок действует на весь HTTP-запрос, поэтому checkout отправлять отдельно,
без объединения нескольких платёжных процедур в одну пачку.

Checkout не авторизует пользователя и не подтверждает почту. Возврат на
`/club?payment=returned&order=...` не доказывает оплату: нельзя включать клуб
по параметрам URL или показывать успешную оплату без проверки серверного доступа.
Периоды фиксируются сервером в заявке: monthly — 30 дней, semiannual — 180.
В интерфейсе требуется обозначение «разовая тестовая покупка, без автопродления».

POST `/api/yookassa/webhook` принимает JSON до 64 КБ. Тело — только подсказка;
сервер делает авторизованный GET по заранее сохранённому payment ID и сверяет
test/shop/order/amount/RUB/succeeded/paid. Незнакомая привязка, временная ошибка
или ещё не подтверждённый результат дают 503 для повтора, неправильное тело —
400. Нельзя связывать покупку по metadata из уведомления. Доступ, квитанция
и задание письма записываются одной транзакцией; повтор не добавляет период.
Выключенный тестовый адаптер не подтверждает тестовые уведомления.

Проверка: 24 сценария через настоящий Nest HTTP/tRPC и отдельную MySQL 8.4,
включая параллельный replay, неверную сумму/shop/test/currency/order/ID,
блокировку, ранний callback, отмену, 180 дней и откат outbox; внешний HTTP
провайдера в этих тестах подменён. Дополнительно 15 SQL-регрессий settlement/
Prodamus cancellation проходят. Это не подтверждение реального sandbox-платежа
или доставки письма в Gmail. Первый срез сохранял 72 процедуры / 25461 байт.

### Проверка возврата тестовой оплаты — 8 октября

Добавлена mutation `club.reconcileCheckout`, POST
`/api/trpc/club.reconcileCheckout`. Вход — `undefined`, например
`client.club.reconcileCheckout.mutate(undefined, { context: { idempotencyKey } })`
через подготовленный небатчированный транспорт. UUID берётся из прежней
сохранённой заявки и передаётся только заголовком `Idempotency-Key`, не URL/body.
Не отправлять email, order/payment ID или желаемый статус; такой вход даёт 400.
Пачки для этой процедуры запрещены (400), GET не поддерживается (405).

Ответ — только `{state: "unknown" | "pending" | "succeeded" | "canceled"}`:

- `unknown`: отсутствует подтверждённая привязка. Не заменять/удалять ключ,
  не предлагать автоматическую новую оплату. Для восстановления отправки
  используется прежний createCheckout с прежним email/plan/key; серверный
  предел безопасного повтора остаётся 23 часа.
- `pending`: платёж ещё не завершён, в том числе waiting_for_capture.
  Проверка не выполняет захват средств и не создаёт другой платёж.
- `succeeded`: сервер сверил ответ ЮKassa с сохранённой заявкой и завершил
  транзакцию доступа/квитанции/задания письма. Это не вход в аккаунт и не
  подтверждение фактической доставки письма. Обновить состояние доступа.
- `canceled`: подтверждённая отмена, без новой покупки. Новый ключ допускается
  только отдельным действием пользователя и защищённой заменой прежней заявки.
  Браузерный механизм такой замены ещё не подключён — не добавлять blind reset.

Ошибка/таймаут/503 не равны отмене; сохранять UUID и повторять позже.
400 — исправить контракт запроса, 403 — нельзя проверять этого получателя,
412 — тестовый адаптер выключен/не настроен; переходить на Prodamus нельзя.
Возвратные `paid/payment/order` параметры не являются доказательством оплаты.
Ответы no-store, без cookie, email, ID аккаунта/заказа и checkout URL.

Типы обновлены автоматически: 73 процедуры / 25642 байта. UI не изменён.
Квота согласована и добавлена: 12 запросов на заявку и 60 на IP, определённый
Express, за 60 секунд с первого запроса. Один ключ учитывается вместе для разных IP
и вариантов регистра. Неверные ключи и лишние поля в корректном JSON расходуют
IP-квоту (ошибки разбора JSON возникают раньше); превышение IP
не расходует квоту заявки. Ответ 429 / `TOO_MANY_REQUESTS` с `Retry-After`
(положительное количество секунд), no-store, без cookie или самого ключа.
Сохранить прежнюю заявку, дождаться указанного времени; не сбрасывать ключ и
не создавать новый платёж. Ограничение не применяется к webhook/createCheckout.

До включения остаются ограниченный опрос без бесконечного цикла, безопасная
новая покупка и настоящая sandbox-приёмка. Счётчики — существующее ограниченное
хранилище в памяти одного API-процесса; рестарт сбрасывает их. Для нескольких
API-процессов необходимо общее атомарное хранилище. Перед выкладкой проверить
цепочку прокси: текущий trust-proxy=loopback не доверяет Docker edge, поэтому
IP-квота консервативно общая для его запросов. Политику доверия здесь не меняли.
Этот HTTP-срез не выложен на стенд, UI и настройки оплаты не изменены.

Перед включением нужны caller/UI-проверки, защищённая резервная копия и репетиция
миграции 0026, отдельный ограниченный доступ к API ЮKassa, настройка уведомлений
в кабинете тестового магазина и настоящее sandbox-прохождение с повтором callback.
Preflight пока блокируют прежние SQL 0017–0019 без записей в журнале; они не
переписывались, preflight не обходился. Native dependency audit также требует
закрыть или обосновать риски до выкладки; массовое обновление зависимостей
не выполнялось в рамках платёжного среза.
