# Spec: закрытая серверная выдача вложений постов

## 21 октября — ограниченные копии для распознавателя, U1-MEM3

Внутренний worker теперь читает весь доступный файл через random-access tokenizer
по потребности, а не получает полную копию32/80MiB при старте. Это не обрезанный
prefix detector: размер файла, seek и EOF semantics сохраняются. Parent проверяет
целочисленные offset/length, границы исходного Buffer и максимум64KiB на ответ;
каждый ответ — отдельная transferable copy без pooled neighbours. Worker не может
отсоединить или изменить storage bytes. Прежние one-active-slot,5s deadline,
isolated env/execArgv, heap limits, terminate/await и generic errors сохранены.

Использованы публичные file-type.fileTypeFromTokenizer и strtok3.AbstractTokenizer.
strtok310.3.5 уже был зависимостью file-type22.1.1 в lockfile; закреплён напрямую
для явного runtime dependency. Resolved package records/версии не менялись;
package-manager-generated peer snapshot references ESLint нормализованы без
обновления пакетов. Install scripts запрещены, frozen/offline lock check GREEN.
Публичный API/форматы/квоты/права/флаги не меняются; frontend правок не требует.

Native Mac detector-only profile80MiB: maxRSS224496→143344KiB, без forced GC;
это не API/cgroup SLO. Полная isolated512MiB приёмка ещё открыта: Base64 article
достиг384.52MiB и392.23MiB на повторе. Raw80MiB получил ready receipt200/S3,
но peak384.33MiB превысил384 gate до replay/bind/read. Не ослаблять gate,
не переносить эти замеры emulation как точный native staging RSS. Доказательства,
точная очистка и необходимость обсудить следующий архитектурный шаг — U1-MEM3
в todo/runbook. Live settings/БД/admin/старые S3/frontend/deploy не менялись.

## 21 октября — внутренняя оптимизация памяти, контракт прежний

Decoded4/32MiB quota проверяется до Buffer allocation. Canonical Base64 сохраняет
строгую проверку алфавита/паддинга/неиспользованных битов без полного re-encoding.
Для media UTF-8 JSON POST после прежних feature/auth/role checks body читает
bounded tRPC reader50MiB, без Express parse→stringify→повторного parse. UTF-16/
compressed JSON сохраняет прежний parser; malformed JSON400 без отражения тела,
chunked oversized body413. Публичные input/receipt/status/recovery/access и
квоты/флаги не изменены, клиент менять не нужно. Обычные256KiB/auth16KiB/photo6MiB
и raw video80MiB parsers остаются прежними.

Это не подтверждение готовности рабочего API256MiB. Новая isolated512MiB серия
имеет как успешный article32MiB run351.71MiB, так и repeat STOP388.13MiB>384 gate;
полная resource acceptance ещё открыта. Подробности/очистка — U1-MEM2 в todo и
existing operational runbook. Более ранние max-size доказательства ниже выполнены
в другом resource environment и не заменяют этот gate.

## 21 октября — реальные предельные размеры без изменения лимитов

Семь новых native API/SQL/Timeweb S3 сценариев GREEN: source post/article/comment
photos4MiB, article/post TXT32MiB, WAV32MiB, raw MP480MiB. +1 byte для каждого
пути возвращает413 без SQL intent и S3 commands; максимум создаёт один ready
asset, повтор не добавляет PUT/ledger, привязка и private API read/HEAD/Range
работают. Полные binary GET проверены по длине/SHA256; guest API404 до storage
и anonymous S3 GET/HEAD/Range403. Photos2x3 с валидным ancillary tEXt/CRC до4MiB
перекодированы в78-byte WebP: это проверка входного byte limit, не нагрузки
декодирования пикселей. MP4 padded valid free box — не playback/duration proof.
PDF/DOCX на максимуме не проверялись.3+4 selected pass,4 прежних сценария не
повторялись.7 новых objects и2 свои tmpfs БД удалены по guards, policy прежний;
production код/лимиты/таймауты/frontend/working DB/старые файлы/flags/deploy не
менялись. Published proxy/client/browser приёмка остаётся отдельно.
Evidence — U1-MAX в начале tasks/todo.md.

## 21 октября — повторная isolated audio/video приёмка

На актуальной fresh42 схеме video API/SQL/Timeweb S3:3 pass/0skip35.28s;
audio/document:2 pass/0skip21.35s. Исправлен только устаревший video test guard
41→42, production API не менялся. Реальные HTTP ACK loss/API restarts/replay,
account switch upload/status, GET/HEAD/Range и отзыв доступа подтверждены.
Промежуточный S3 timeout не считается GREEN: сохранили точный ledger, после
восстановления удалили2 объекта; новый clean run удалил4 video/poster и2 audio/
document objects с metadata/ETag/HEAD404, policy прежний. Все own tmpfs БД убраны.
Evidence/ограничения — U1-ISO в начале tasks/todo.md. Малые fixtures не доказывают
max-size upload; journal/FileReader doubles не заменяют браузер. Working DB,
старые S3 objects, runtime flags/frontend/push/deploy не затрагивались.

## Уточнение доступа к выкройкам — 20 октября 2026

Четыре зимние выкройки `holly`, `sock`, `star`, `apple` должны открываться
участницам с действующим клубным доступом и администратору, но не гостям.
Первоначальный пользовательский результат — 404 даже для администратора —
был связан с выключенным Library flag, не требовал публичного fallback.

WIN-LIVE20 октября: выдача четырёх зимних включена на staging; Library и content
flags true.89 public verified HTTPS проверок с staging host подтвердили admin/
member list200 и exact bytes/HEAD/Range, guest/unpaid/deleted-test sessions denial
на list/direct API URL, anonymous direct S3 GET/HEAD403. Temporary users/access
rows удалены, admin credentials/role/session/schema42 и4 bindings сохранены.
Это backend API acceptance, не браузерная/Mac проверка: внешний Mac прогон
прерывался на абсолютном30s deadline чтения. Старые public copies ещё не закрыты;
не объявлять всю Библиотеку защищённой или остальные материалы перенесёнными.

WIN-PREP20 октября после отдельного разрешения: новые закрытые copies четырёх
WebP и ready bindings подготовлены через existing importer; revision1,
3681002 bytes, source hash совпал с deployed assets. Signed GET/HEAD/Range и
anonymous403 проверены, повтор того же manifest без дублей. Fresh backup и
guards подтвердили сохранность всех прежних записей/admin/schema/policy.
На стадии WIN-PREP `PRIVATE_LIBRARY_FILES_ENABLED` оставался false; позднейшее
включение и границы backend-приёмки указаны в WIN-LIVE выше.
Старые public sources/derivatives/cache сохранены и ещё не защищены.

«Лошадка» (`loshadka`) — отдельный материал. В исходном импорте b06a46a она
имела `isClubOnly: false`; реализация 2fede81 перевела её в закрытый patterns flow.
Описанные ниже пять slots отражают техническую реализацию, но не подтверждают
отдельное продуктовое согласование смены бесплатного статуса. До сверки и
решения не включать её в перенос четырёх зимних выкроек и не считать клубной
по умолчанию. Runtime/frontend автоматически не откатывать; клиентские задачи
передавать фронтендеру. Рецепты и Петербург оставить без изменений.

## CAP-U — доступность подготовленных загрузок, принят20 октября2026

Локальная интеграция существующих editors/comment photos с existing server flags,
без изменения дизайна, working DB/S3/старых файлов, push/deploy или включения flags.
GET /api/capabilities/no-store дополнен privateContentUploads (content flag),
privatePostMediaUploads (post media flag), privatePostVideoUploads (media AND video).
Только exact true; это release availability, не право доступа и не health S3.
Старый сервер без новых полей, malformed payload и failed refresh дают false.

UI сохраняет кнопки/дизайн, но отключает недоступные новые выбор/замену файлов.
Remove/reorder, текст, VK-ссылки, public cover и status/recovery не отключаются
одним общим upload flag. Выбор и фактическая отправка требуют свежего capabilities
read с signal текущей операции; ошибка/false не допускают upload mutation.
Binary transport остаётся прежним, guard принадлежит editor API adapter.
Видео в редакторе требует также content flag: его generated poster — private photo.
Это дополнительное ограничение целого editor workflow, не изменение video endpoint.
Отказ не очищает File/receipt/journal/key и не переключается на public upload.
Existing status-first recovery сохраняется, новую попытку создания поста не добавлять.
UI query cached60s и revalidates stale data при focus/reconnect; failed refresh
не использует прежний enabled результат. Между refresh UI может быть устаревшим,
поэтому fresh guard перед выбором/отправкой обязателен, server checks остаются final.

## LIB-P — контракт платной Библиотеки, принят20 октября2026

Пользователь принял контракт и разрешил локальную реализацию: бесплатный тест и
дизайн сохранить; рабочую БД, S3 и старые файлы не трогать; без push/deploy.
Это не разрешение реального переноса/закрытия источников или включения flags.

- Seven existing result modules смешивают free fairyTale/archetype/roleModels/
  depth/challenge и club style/space/rituals/blog/inspiration. Открытый результат
  теста/расчёт/названия/обложки сохранить. Только пять club полей убрать из client
  runtime imports обоих consumers: aesthetics-screen и quiz-result; type-only
  контракт общий, backend не импортирует frontend. Shared result renderer
  получает лишь club payload, не полную mixed data константу.
- Минимальный read: GET /api/library/guides/aesthetics/:key для7 existing
  aesthetic keys → {key,style,space,rituals,blog,inspiration}, без free duplicate
  fields/новой DB таблицы/редактора. Existing live session + userHasClubAccess,
  denial404 без content, infra503, private/no-store; ни paid JS imports, ни
  static prerender/RSC props с платным payload для гостя. Поздние ответы и кэш
  изолируются по аккаунту; revoke/account-switch/unmount убирают paid view.
- Patterns:4 slots holly/sock/star/apple и отдельная «Лошадка» (fileKey=loshadka) используют
  public /assets/responsive originals и Yandex URL. Подключить уже принятые LB
  list/read/bindings для material=patterns; перенос только по reviewed manifest
  и проверенным source bytes. Не загружать/менять реальные файлы автоматически.
- Отдельно инвентаризировать originals/derivatives и shared uses. Public covers,
  quiz houses и декорации не закрывать автоматически. Existing moodboards/outfits/
  interiors в public assets не становятся private от переноса текста; если это
  платные originals, включить их в точный manifest до заявления полной защиты.
- Порядок: синтетическая репетиция → проверенные новые private copies/bindings →
  client delivery/bundle leak tests → согласованный rollout → отдельное закрытие
  прежних originals/derivatives/old JS на origin и purge контролируемых caches.
  Прямая Yandex share ссылка не может одновременно оставаться публичной и стать
  защищённой проверкой приложения; её закрытие требует контроля владельца.
  Уже скачанные пользователями bytes отозвать невозможно. До закрытия старых
  источников нельзя заявлять полную защиту, даже если новые API работают.

Локальная реализация20 октября: backend-owned catalog/read сохранён в bc7116b;
client read и оба consumers используют общий shape без платных строк. Quiz
read отложен до «Читать»; private query owner-scoped, gc0, no persistence,
abort signal, stale/failed refresh скрывает prior payload. Pattern metadata
проверяется постранично (до50/page); принимаются только canonical app URL и
подходящий MIME пяти slots. Карточка «Лошадка» ведёт к закрытому patterns screen,
не к внешнему URL. Free fields и existing public covers сохраняются.
Точная reference map — docs/audits/library-source-map-2026-10-20.json:20 public
pattern copies и220 candidate visual URIs (104 shared). Эти файлы, реальные
S3/БД/flags и старые JS/cache не менялись. Проверки и ограничения — начало todo.

Повторяемая production leakage check после свежего `pnpm build:frontend`:
`DARYADARCY_LIBRARY_PRODUCTION_BUILD=1 pnpm exec vitest run tests/library-client-bundle.test.ts`.
Native guide: tests/aesthetic-guides.mysql.test.ts; local UI/API/SQL и synthetic
loopback SDK wire: tests/private-library.browser.test.ts (отдельные opt-in flags,
own disposable backend_test по общей политике). Это не actual S3 acceptance.

## LB — встроенные файлы Библиотеки, принят17 октября2026

Разрешена local реализация и репетиция только synthetic6 files, own disposable
backend_test и loopback SDK wire. Working DB/real S3/старые files/URLs/design/
push/deploy запрещены. Это не перенос настоящего содержимого Яндекса.

Привязка materialKey (recipes/peterburg/patterns), fileKey, assetId, sortOrder,
enabled, revision: unique slot и asset, private file принадлежит одной binding.
Новый parent=library, отдельные libraryPhoto/libraryDocument usages; existing
user upload API не расширяется. GET /api/library/materials/:materialKey/files
и GET/HEAD /api/media/library-files/:materialKey/:fileKey, bounded list/Range,
live session/club policy до storage,404 при отказе/disabled,503 при сбое,
no-store/nosniff и никогда raw storage URL/public fallback. Default-off.
Активная binding без соответствующего receipt — ошибка целостности: list503,
не успешный empty/partial list. Это проверяется на каждой выдаваемой странице;
disabled bindings исключены, отсутствие прав по-прежнему404 до storage.

Операционный importer (без нового HTTP upload/editor): validated manifest с
bytes/hash/MIME/size/expectedRevision и постоянным ключом ДО storage. Изменённый
payload409; pending не success. Ready copies затем одна транзакция material
binding CAS; exact-key replay/restart без дублей. Старые verified private версии
сохраняются для revision-guarded rollback; никакого возврата anonymous URL.
Публичные covers/avatars/theme/free materials не менять, guest preview не
получает original. Репетиция SDK wire не доказывает actual S3 privacy/cache purge.

Локальные entrypoints: `inspectLibraryMigration(manifest)` без DB/storage,
`applyLibraryMigration({id,sessionVersion},manifest)` и
`rollbackLibraryMigration(actor,idempotencyKey)` в backend content module.
Это operator-only library functions, не новый API редактора/автоматический job.
Существующий editor upload/status контракт не получает library usages.

Manifest strict: materialKey, idempotencyKey и files[1..100], каждый содержит
fileKey, filename, mimeType, bytes=Buffer, sha256, sortOrder, expectedRevision.
Пути/URL не принимаются и не скачиваются. SHA-256 проверяется до записи intent,
source bytes копируются без конвертации. Фото JPEG/PNG/WebP≤4MiB/20Mp/single-page
с decoder validation и без EXIF/XMP/IPTC; небезопасный original отклоняется, не
перекодируется молча. Документы PDF/TXT/DOCX≤32MiB используют existing MIME
verifier. Общий batch≤64MiB — предел операционной репетиции, не новая user quota.
Dry-run выводит только materialKey/count/totalBytes/payloadHash, без bytes/имён.

Actor-scoped journal хранит hash ключа/manifest, reserved UUIDs, state и snapshots
привязок, не source URL/path/bytes. Intent и pending receipts durable до SDK;
conditional PUT/HEAD проверяет namespace/policy/metadata/ETag. Потеря ACK даёт503,
тот же manifest/key восстанавливается после рестарта; pending не публикуется.
Гонка conditional PUT может дать retryable503; повтор с тем же ключом сходится
к одной операции/одному объекту на slot. Иной payload или stale revision —409.
После ready копий изменяются только перечисленные slots одного материала,
одной транзакцией. Прочие slots не удаляются. Проверяются полные unique indexes
и InnoDB до intent/storage; live admin/session/block/deletion checks повторяются
после storage и перед commit, networking не держит SQL transaction открытой.

Rollback допустим только для текущих unchanged revisions/assets; prior verified
private copies сохраняются, revision растёт. Первый import без prior binding
откатывается в disabled slot, не в публичный URL; повтор rollback идемпотентен.
Replay отменённого import запрещён409, более поздний edit не перезаписывается.
Default-off: PRIVATE_LIBRARY_FILES_ENABLED плюс PRIVATE_CONTENT_FILES_ENABLED.
Рабочие flags не включены. Реальные sources/перенос, private storage acceptance,
удаление/закрытие старых URLs и frontend integration требуют отдельного разрешения.

## VU — закрытые видео постов, принят 16 октября 2026

Прямое согласование пользователя: реализовать локально принятый контракт,
без дизайна, рабочей БД, старых файлов, push/deploy. Browser/mobile отложены.

- Новый `POST /api/admin/private-video-uploads?filename=…`: bounded raw body
  до прежних80MiB, admin session и `Idempotency-Key`16–128 ASCII. MP4/WebM/MOV,
  проверка сигнатуры и canonical MIME; это не проверка tracks/codecs и не transcoding.
- Ответ как existing private attachment receipt: pending/ready, assetId,
  type=video, filename/mimeType/fileSize, без S3 URL. Existing
  `admin.privateAttachmentStatus({idempotencyKey})` возвращает также video;
  notRecorded не означает ошибку или разрешение менять ключ.
- Actor-scoped durable SQL intent ДО S3. Повтор — исходные bytes/key, changed
  payload409. HEAD+metadata/ETag и conditional PUT восстанавливают lost ACK,
  не перезаписывают объект. Используется уже защищённый content/private-v1/,
  без нового bucket/policy writes; только additive migration, старые строки прежние.
- Existing privateAssetIds атомарно связывает canonical video с постом;
  upload сам не публикует. Legacy videos[]/VK не удаляет private video неявно,
  removal явный через removedMediaIds. Existing live GET/HEAD/Range proxy
  проверяет публикацию/клуб; draft/unbound/deleted/detached закрыты.
- Original File/metadata/stable key сохраняются локально до network; после
  reload/timeout status-first, ready не перезаливается, pending не success.
  Storage failure блокирует запрос, смена аккаунта отсеивает late replies.
  Create replay использует existing post intent; unknown update — read/reconcile,
  не автоматический новый POST. Старые файлы/legacy URL/VK не переделываются.
- Автопостер только через existing private postPhoto с явной связью с video,
  не public uploadPhoto и не угадывание по basename. Existing дизайн сохраняется.
  Additive wire: create/updatePost.privateVideoPosters?:
  `{videoAssetId,posterAssetId}[]` (max100, video включён в privateAssetIds).
  Сервер сохраняет nullable post_media.posterUrl как canonical app reference,
  не direct URL из клиента. PostPhoto проверяется/связывается в той же транзакции;
  new gallery/постер одного поста входят в общий reference set. Removal/replacement
  retire последнюю исчезнувшую ссылку; retained gallery не удаляется случайно.
  Старые rows имеют NULL; их basename-постеры не мигрируются автоматически.
- Новый путь default-off, рабочие flags не включать. Прежние30 суток — окно
  recovery/retention, не срок жизни опубликованного видео. Auto cleanup в рабочем
  хранилище не включать. Настоящий S3 acceptance отмечать отдельно от loopback wire.

Срезы: VU1 upload/status/schema/SDK wire; VU2 association/read/removal/private
poster; VU3 durable client и оба existing editors; VU4 API/SQL/S3 acceptance
без browser/mobile (отложены пользователем).

Локальная реализация VU1–VU4 завершена16 октября. VU4:3/3 actual frontend
transport/coordinator→native API→own fresh41 SQL→Timeweb S3,35.77s. Lost upload/
post ACK и API restarts, account switch во время upload/status, canonical video/
poster GET/HEAD/Range/access revoke/explicit removal подтверждены. Journal
transaction boundary — double, не browser reload/playback acceptance. Все4 новых
synthetic объекта удалены с guards/HEAD404, policy unchanged; own DB/API убраны.
Точные проверки/ограничения — начало tasks/todo.md. Working flags/DB/старые файлы,
push/deploy не менялись; browser/mobile и выпуск остаются отдельно.

## CF — фото и материалы статей, принят 15 октября 2026

После показа минимального контракта пользователь поручил «делай далее все».
Разрешена локальная backend реализация новых фото постов/комментариев и фото,
PNG/каруселей/документов статей. Frontend, старые S3 objects/URL, working DB,
bucket policy и rollout первоначально не менять. Новая возможность default-off.
Последующее прямое разрешение15 октября на scoped policy/probe описано ниже;
оно не разрешает рабочую DB, frontend, старые objects или включение флага.

Контракт: upload с actor-scoped idempotencyKey, usage (postPhoto,
articlePhoto, articleDocument, commentPhoto), filename/MIME/base64. Ответ pending
или ready с assetId, проверенными MIME/size и application URL; никогда S3 URL.
Status по тому же ключу; несовпадающий payload —409. Durable intent до S3;
неизвестный исход не означает успех или новую загрузку. Новый префикс
`content/private-v1/`, отдельный required Deny statement; существующий AG4 policy
guard и старые префиксы не расширять. До отдельной storage acceptance не включать.

Ссылки приложения сохраняются в существующих photos/url/urls полях. Их точный
namespace распознаёт сервер: только свой ready receipt, правильный usage и один
родитель, binding и материал в одной SQL транзакции. Порядок карусели сохраняется.
Нельзя подставить private S3 URL вместо receipt или использовать такой файл как
публичную обложку. Create с новыми файлами требует постоянный ключ операции.
Удаление связи не удаляет S3, повтор не должен воскресить удалённую связь.

CF4 wire: `club.uploadPrivateCommentPhoto` принимает те же поля и
`usage=commentPhoto`, обязательный postId (не изменяемый при retry).
`club.privateCommentPhotoStatus` — только свой ключ. Upload/save сверяют текущий
epoch, блокировку, существующий опубликованный пост, доступ и прежние 48h правила
комментирования. Existing `club.addComment` принимает optional idempotencyKey;
для новых private photos он обязателен. New ledger0037 атомарен с комментарием
и binding; same payload replay возвращает тот же commentId без повторного push,
changed payload (включая удаление photos из retry) или удалённый comment —409.
Переданный idempotencyKey всегда выбирает recovery path, иначе удаление всех
фото из retry обошло бы ledger и создало дубль. Legacy comments без ключа и без
private files сохраняют прежний путь; это не ретроактивная idempotency старого API.

CF5: existing `profileExtras.recoveryExport` принимает дополнительные kind
`private_content`/`comment`; только свои requestId/createdAt/status и прежняя
ограниченная keyset pagination. Никаких filename, assetId, URL или storage keys.
Existing retirement flag включает очистку новых ledger в той же транзакции под
user lock: comment intents удаляются; у receipts убираются actorUserId/filename,
actor-derived requestKey заменяется техническим asset-derived fingerprint.
Ready/bound integrity evidence сохраняется для живого материала, unbound receipt
помечается retired. Это не удаление S3. Частичная/небезопасная schema0036/0037
откатывает retirement целиком; при наличии таблиц upload flag off не пропускает
очистку. На старой схеме без обеих таблиц и с CF flag off старый путь сохраняется.
Прежний opt-in 30-day recovery window действует и на новые intents:409 после
истечения не создаёт замену, но не лишает опубликованный материал его файла.
Автоматическая компактизация/очистка S3 для нового scope этим не включается.

Фото: прежние JPEG/PNG/WebP<=4MiB, byte gate/re-encode/stripping EXIF, прозрачность
сохраняется. Документы: PDF/DOCX/TXT<=32MiB, прежние проверки bytes/MIME, без DOC,
HTML/SVG/новых форматов. Обложки, аватары и сезоны остаются публичными.
Публичный published материал читается по прежним правилам; club — live session
и userHasClubAccess. Фото комментария дополнительно требует существующий
комментарий и прежние права чтения обсуждения (включая login для public discussion).
Draft/hidden/deleted/unbound — недоступно. На каждом GET/HEAD/Range актуальные
права и связь до S3. No-store, nosniff, никакого public image optimizer/cache;
фото inline, документ attachment. Уже скачанные копии отозвать невозможно.

Срезы: CF1 обработка фото/storage transport; CF2 ledger/upload/status;
CF3 post/article association/read; CF4 comment association/read;
CF5 retirement/export, native regression и frontend handoff. Для каждого тест
сначала RED, затем GREEN. SQL только own loopback/tmpfs backend_test, S3 только
локальный protocol fixture; wire не является Timeweb ACL acceptance.
Команды: `pnpm exec vitest run tests/private-content-files.test.ts`,
native opt-in `pnpm exec vitest run tests/private-content-files.mysql.test.ts --maxWorkers=1`,
`pnpm check`, `pnpm build`, `pnpm check:boundaries`, `pnpm check:docs`.
Runtime в apps/backend/src/content и media, schema/migrations в packages/database.
Использовать existing transaction/session/receipt patterns, без новой платформы,
ролей, лимитов, внешних сервисов и автоматической очистки новых объектов.

## CF-S3 — новое scoped правило и storage probe выполнены 15 октября 2026

После показа proposal пользователь явно разрешил проверить текущую policy и
серверную identity, добавить правило только нового prefix и проверить собственные
тестовые файлы. Frontend/working DB/старые файлы/флаг исключены из поручения.
Разрешённый scope: endpoint `https://s3.twcstorage.ru`, bucket `daryadarcy-s3`,
один statement `DaryadarcyPrivateContentV1` на
`arn:aws:s3:::daryadarcy-s3/content/private-v1/*`. Новый bucket не создавался.

Preflight: GetBucketPolicy/GetBucketAcl/GetBucketVersioning и ListObjectsV2
(Prefix только content/private-v1/, MaxKeys1) подтвердили пустой префикс и
выключенное versioning. Подписанный IAM GetUser подтвердил прежнюю service identity,
fingerprint `886adafddaec`; username совпал с allowlist существующего private
attachment rule. Access Key/Owner.ID не подставлялись вместо identity.

Policy SHA256 до изменения:
`1f66d0c775b9dd68d8f7785b30b7a4e788697a98b88d510ffa49ae0188ca6088`.
Добавлен ровно один Deny/Principal `*`, actions GetObject/GetObjectVersion,
Resource только нового prefix и StringNotEqualsIfExists aws:username с одной
подтверждённой identity. Три прежних statement сохранены структурно; ACL не менялся.
Перед PUT повторно проверены исходный hash/ACL/пустота/versioning; после PUT и после
cleanup — readback полного ожидаемого документа. Это immediate drift guard, не
атомарный compare-and-swap S3 policy. Не перезаписывать неизвестные изменения.
Итоговый SHA256:
`0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8`.

Настоящий AWS SDK/Timeweb probe на новых UUID объектах: text/plain10 bytes и
image/webp88 bytes. Private PUT с ACL=private/IfNoneMatch=*/ContentMD5/owner metadata;
для обоих signed HEAD/GET=200, Range bytes2–5=206 с точными bytes/length/ETag.
Anonymous GET/HEAD/Range=403 для обоих. Собственный новый public-control вне
prefix возвращал200 с точными bytes до и после policy. Старые файлы не читались.
Другой самостоятельный валидный S3 principal не предоставлен/не проверялся;
это ограничение, не отрицательный контроль с неправильной подписью.

Первая подготовка фото остановилась локально: signed host node_repl не смог
загрузить sharp addon из-за разных Team IDs. S3 private PUT ещё не было.
Тот же синтетический WebP подготовлен отдельным локальным Node-процессом без
изменения dependencies/системной защиты; после этого storage probe прошёл.
Это не provider timeout и не исправление приложения. SDK assertions выполнялись
на реальных HTTP ответах, не Vitest SQL/browser acceptance и не mock GREEN.

Три own объекта (два private и public-control) удалены только после exact key,
UUID owner, MIME/size/intent hash/ETag проверки и conditional DELETE; signed
HEAD каждого после удаления404. Новый prefix снова пуст, policy и ACL перепроверены.
Правило оставлено действующим. Ключи не записывались в файлы/Git; временный JS
kernel с credentials завершён. SQL/API/browser/source/frontend/server flags не
менялись и не запускались. Не удалять Deny слепым rollback после появления
настоящих закрытых данных: общий public Allow может их раскрыть.

Следующий на тот момент этап — CF API/SQL с этим S3 — пройден по последующему
прямому поручению ниже. Клиент/browser/device/rollout остаются отдельными gate.

### CF-API — настоящий HTTP/SQL/S3, 15 октября 2026

Пользователь разрешил закрытую загрузку/выдачу через локальный API с настоящим
S3 на одноразовой тестовой БД, включая потерянный ответ и отзыв доступа.
`tests/private-content-files.s3.mysql.test.ts`: **4 pass, skips0,35.11s,exit0**.
Предварительный document-only срез1 pass/8.66s сохранён отдельно, не суммировать
повтор одного сценария как дополнительное покрытие. Production runtime не менялся.

Стенд: отдельный MySQL8.4 backend_test/127.0.0.1/tmpfs без mounts/volumes.
Fresh-only initializer реально применил все38 SQL; suite проверил matching
container ID/name/codex.owner/port/tmpfs, пустых users и38 history rows до seeds.
Никаких fixture CREATE/ALTER TABLE, production boot/jobs/env-файлов или working DB.
Synthetic admin/member/other и paid row созданы только SQL в own database —
платёжный провайдер/внешняя почта не вызывались. API компилировался в новые
изолированные Node процессы; PRIVATE_CONTENT_FILES_ENABLED менялся только там.

Проверено: application-only upload receipt/status, durable assetId после HTTP
drop при upload и restart, два concurrent replay без нового PUT; создание
статьи/поста/комментария после dropped committed response не дублирует материал,
teaser/comment list соответствуют SQL. Changed payload (включая photos=[]),
чужой account/asset и повтор удалённого comment отказывают, не создают замену.
Документ TXT, фото поста, png/carousel статьи и фото comment: привязка атомарна;
GET/HEAD/Range точные, WebP alpha без EXIF, MIME/no-store/nosniff/disposition.
Draft/hidden/removal/no resurrection, paid expiry, block, staff role loss,
session epoch revoke —404 до S3; status старой сессии401. Новая валидная сессия
того же пользователя читает живой файл. Default-off не выдаёт/не загружает.
Direct anonymous GET/HEAD/Range каждого нового S3 asset —403, без policy writes.

Сначала harness неверно ожидал teaser у unpublished article: подтверждено
syncTeaser published=false→без teaser, после publish→один; исправлен тест,
не приложение. Отдельный запуск попал до окончания readiness нового MySQL:
connection closed, cases не выполнены. После readiness read-only SHOW TABLES=[]
подтвердил отсутствие partial DDL, штатный initializer завершил38 SQL и suite
прошёл без увеличения timeout/skip. Generic SDK helper type исправлен в тесте.

Четыре S3 objects удалены после точного own ledger/UUID filename/asset/hash/
MIME/size/ETag guard, conditional DELETE и signed HEAD404. Policy hash
`0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8` неизменен.
Все own SQL контейнеры срезов удалены после exact owner/storage/network checks;
старый local-owner stand сохранён. API processes, scratch dirs, JS credentials
kernel и временный caffeinate завершены. В Git только тесты и документация.

Воспроизведение: clean env с BACKEND_TEST_DATABASE_URL=DATABASE_URL собственного
свежего migrated backend_test, CF_S3_DATABASE_CONTAINER_ID и CF_S3_ACCEPTANCE=true;
явные S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY и synthetic JWT_SECRET.
Ключи только в памяти/окружении child, не в CLI args/env-файлах/manifest/Git.
Команда: `pnpm exec vitest run tests/private-content-files.s3.mysql.test.ts --maxWorkers=1 --reporter=dot`.
Без opt-in — skip, не новая приёмка; policy drift/versioning/неowned DB отказывают.
Непустую/частичную DB не ремонтировать, старые S3 objects не подставлять.
Это native backend acceptance, не frontend/rewrites/browser/device/load/production
rollout. Второй самостоятельный S3 principal всё ещё не проверен. Рабочий флаг
не включён, новые автоматические cleanup/lifecycle правила не добавлялись.

## Статус — Accepted for local implementation, 13 октября 2026

Пользователь разрешил делать серверную выдачу после code review пункта5 документа
«Задачи_бэкендеру_2026-10-12.md» и подтвердил этот контракт: «Да, делаем так.
Го реализовывать закрытую выдачу вложений постов, фронт и старые файлы не трогай».
Это не разрешение миграции рабочих объектов или включения флага.
Фронтенд не меняется.

## AG2 — первоначальный Timeweb storage gate: отказ 14 октября

Пользователь предоставил endpoint `https://s3.twcstorage.ru`, рабочий bucket
`daryadarcy-s3` и прямо разрешил проверку. Это узкое исключение: только новые
synthetic объекты в уникальном `feed/documents/daryadarcy-ag2-*` префиксе,
их точечная проверка/удаление и read-only policy/ACL; старые файлы и настройки
bucket не изменять. Секреты не сохранять и не печатать.

На новом десятибайтовом объекте private PUT (`ACL=private`, `IfNoneMatch=*`),
signed HEAD/GET и Range `bytes=2-5` прошли с точными байтами/длиной и 206.
Однако anonymous GET и HEAD вернули **200**, а не отказ. Probe завершился exit1:
это реальное S3 evidence, **не завершение AG2 и не разрешение AG4/enablement**.
Read-only GetBucketPolicy подтвердил unconditional anonymous `s3:GetObject` Allow
на все объекты; имеющийся conditional Deny fixture не закрыл. Bucket ACL не даёт
anonymous READ: повтор object-level private ACL не устраняет эту policy границу.

Созданный объект удалён после проверки owner UUID, ContentLength и ETag;
последующий signed HEAD=404. Старые объекты не читались; working DB/фронт/флаги,
bucket policy/ACL не менялись. Native SQL/proxy/browser проверку после провала
storage gate не запускали. Полную рабочую конфигурацию этим не сертифицировали.

Продолжение требует решения владельца: отдельный закрытый bucket для новых
вложений либо согласованное ограничение только нового private prefix с сохранением
старых публичных URL. Не закрывать весь bucket и не создавать новый сервис
автоматически. Затем повторить private-denial gate и остальную AG2 матрицу.
Ключи из переписки использованы только из stdin в памяти процесса; рекомендуется
заменить их и передать ограниченный профиль вне переписки/репозитория.

## Закрытые префиксы в существующем bucket — ограниченный trial принят 14 октября

Пользователь разрешил только исследование: «Старые файлы и доступ к ним не трогай,
сначала покажи, что нужно поменять». Новый платный bucket исключён. Этот раздел
сам по себе не разрешал применять policy, писать объекты или начинать AG4.
После показа предложения пользователь поручил «делай далее все»:
разрешены bounded policy trial только новых `feed/audio/private-v1/` и
`feed/documents/private-v1/`, own synthetic fixtures и native acceptance.
Старые statements/объекты/права не менять. При неизвестной identity, policy drift
или невалидном enforcement остановиться; AG4 по-прежнему только после AG2 gate.

Read-only SDK GetBucketPolicy/GetBucketAcl и по одному ListObjectsV2 (MaxKeys=1)
только на каждый предложенный prefix подтвердили:

- `feed/audio/private-v1/` и `feed/documents/private-v1/` пустые;
- policy содержит общий anonymous GetObject Allow, а отдельный Deny для
  `backups/mysql/*` с GetObject/GetObjectVersion и
  `StringEqualsIfExists: { "aws:username": ["anonymous", ""] }`;
- policy SHA256 `c0dc04cad86fecd7b9cda2a3fe958be9572bc19514dbe19b8a4887907a2c34e2`.

Содержимое backups/старых файлов не читалось. Никаких PUT/DELETE/ACL/policy writes
в этом исследовании нет. Исходная policy целиком не печаталась/не сохранялась;
выведены лишь schema/scope/anonymous условие и hash, без credentials.

### Что потребуется изменить после отдельного согласования

1. Сохранить все существующие statements, включая публичное чтение и ограничение
   backups. Добавить отдельное ограничение GetObject/GetObjectVersion **только**
   на два новых ARN:
   `arn:aws:s3:::daryadarcy-s3/feed/audio/private-v1/*` и
   `arn:aws:s3:::daryadarcy-s3/feed/documents/private-v1/*`.
   Его семантика: отказ анонимному и любому неразрешённому S3 principal; backend
   S3 principal читает подписанным SDK запросом. Один anonymous Deny недостаточен:
   исходный Principal `*` Allow потенциально разрешает чтение другому подписанному
   пользователю. Не применять общий безусловный Deny, который запретит и SDK.
2. Кандидат дополнительного statement — Deny/Principal `*`/два указанных Resource
   с `StringNotEqualsIfExists` по `aws:username` и allowlist подтверждённых backend
   S3 identities. **Не готовый apply JSON:** сначала подтвердить точное значение
   principal для существующего подключения и поддержку/поведение этого условия
   на Timeweb. Access Key ID и Owner.ID сами по себе не доказательство `aws:username`.
   Поддержку AWS/Ceph языка не выдавать за acceptance конкретного Timeweb cluster.
3. В принятом AG4 — отдельный opt-in private S3 writer для новых audio/document:
   server key внутри этих prefixes, ACL=private, receipt/assetId, стабильный upload
   intent и transaction association. Не пользоваться нынешним `storagePut`, который
   выставляет public-read и допускает fallback. Новый закрытый путь при storage
   отказе закрывается, не переключается на публичный upload или другой сервис.
4. `ownAttachmentKey` уже принимает точные собственные `feed/audio/...` и
   `feed/documents/...`: новый bucket/endpoint/region/env и расширение URL allowlist
   для этих prefixes не требуются. Read route остаётся session/live-access proxy,
   без storage URL в клиенте. Старый upload, фото, статьи, видео и ACL не менять.
   Metadata resolver compatibility не доказывает ещё native delivery/новый upload.

### Безопасная проверка и остановка

После утверждения точного diff policy повторно проверить пустоту двух prefixes
и hash текущей policy. При изменении hash/неизвестном principal остановиться, не
перезаписывать чужую policy и не пробовать несколько AWS условий вслепую.
Проверка на новых synthetic private и public-control объектах: anonymous
GET/HEAD/Range отказ; signed backend HEAD/GET/Range точные байты; неразрешённый
S3 principal отказ; public-control вне prefixes сохраняет прежний ответ. Затем
native API/SQL access matrix в собственной одноразовой БД и browser rewrite.
Проверку другим валидным S3 principal не подменять заведомо неверной подписью.

Rollback пробной policy допустим только до появления настоящих закрытых данных;
после их загрузки слепой возврат общего public Allow может открыть вложения.
Никаких перемещений/переписывания/массовой смены ACL старых объектов, public
listing или blanket Block Public Access. Фронт и рабочая БД не меняются.
Новый тариф/bucket не подключается; обычное хранение/трафик остаются оплачиваемыми.

Основания: [Timeweb bucket policies](https://timeweb.cloud/docs/s3-storage/supported-features/bucket-policies),
[Ceph policy subset](https://docs.ceph.com/en/latest/radosgw/bucketpolicy/) и
существующие storage/private-object/content-upload модули. Это историческое
предложение; результат последующего разрешённого trial приведён ниже.

### AG2 — scoped policy и native acceptance пройдены 14 октября

После разрешения «делай далее все» правило проверено сначала на двух точных
synthetic keys, затем распространено только на два перечисленных private-v1
prefixes. Добавлен один statement `DaryadarcyPrivateAttachmentsV1`:
Deny/Principal `*`, GetObject/GetObjectVersion, `StringNotEqualsIfExists` по
`aws:username` с одной подтверждённой service identity. Все прежние statements
сохранены структурно; bucket/object ACL старых ресурсов не менялись.

Owner.ID bucket оказался не username подписанного подключения: первая проба
с ним запретила также служебное чтение. Исходная policy восстановлена с readback
и guard против concurrent изменений, три own fixtures удалены с HEAD=404.
Подписанный IAM GetUser без UserName вернул identity текущих ключей; UserName
равен UserId, fingerprint `886adafddaec`. Credentials не использовались как
principal и не сохранялись в файлы/Git/логи. Затем bounded trial повторён с этой
подтверждённой identity.

Отрицательный контроль — настоящая валидная подпись при несовпадающем allowlist:
GET=403; это не проверка заведомо неверным ключом. Второй самостоятельный S3
аккаунт не предоставлялся/не проверялся. С правильным allowlist signed HEAD/GET=200,
точные десять байт; Range=206, `2345`, `bytes 2-5/10`. Anonymous GET/HEAD=403
в обоих prefixes. Синтетический public-control снаружи prefixes сохраняет 200.
Старые public covers/avatars не читались; их прежние policy statements сохранены.

Новый opt-in `tests/private-files.s3.mysql.test.ts`: **23 pass, skips0**, exit0,
9.08 s. Реальные Nest HTTP/JWT/cookie/Bearer/SQL/AWS SDK/Timeweb и Chromium с
неизменённым Next rewrite проверили guest/paid/unpaid/expired/blocked/staff/role
revocation/session revocation, draft/hidden/deleted/detached/removed association,
GET/HEAD/Range/416, exact bytes/length, default-off и generic 503 при плохой
подписи. На access denial call-through наблюдение подтверждает отсутствие S3 calls;
ответы не подменялись. Браузер стартовал из собственной временной копии исходников
без env-файлов и S3/DB credentials, внешние browser requests запрещены. Исходный
фронт не изменён. Несовпадение default browser revision устранено явным указанием
уже установленного Chromium; это исправление стенда, не runtime приложения.

SQL только own loopback/tmpfs `backend_test`, не рабочая история миграций.
Файл в audio-prefix — text/plain transport fixture, **не проверка аудиодекодера**.
UI/player/device acceptance и реальные старые URL этим не сертифицированы.
Все три own S3 объекта после metadata owner/ETag/size guards удалены, HEAD=404;
успешное scoped правило оставлено действующим. Новый bucket/тариф не создавался.
AG2 завершён в этом ограниченном объёме, AG4 теперь доступен. Закрытый upload,
receipt/association ещё не реализованы; runtime flags/сервер/рабочая БД не включались.

Воспроизведение: чистое окружение, явные test-only DB/S3 inputs, credentials
только в памяти родительского процесса и окружении Vitest child, manifest собственных
fixtures (`endpoint`, `Bucket`, UUID `owner`, `objects` с точными keys/private flags;
опционально `browserExecutable`). Opt-in `AG2_S3_ACCEPTANCE=true` и
`AG2_S3_FIXTURE_MANIFEST=<own manifest>`; команда
`pnpm exec vitest run tests/private-files.s3.mysql.test.ts --maxWorkers=1 --reporter=dot`.
Без opt-in это skip, а не новое native evidence. Нельзя наследовать рабочие env-файлы
или указывать старые S3 объекты вместо fixtures.

## AG3 — контракт принят 14 октября 2026, следующий срез AG4

Пользователь принял все четыре рекомендации и поручил зафиксировать AG3:
«Реализацию AG4 начнём после проверки S3. Фронт и рабочую БД не трогай».
Это принятие ограниченного контракта, не подтверждение S3 acceptance и не
разрешение начинать AG4, включать флаги или изменять рабочие объекты.

Принятые решения:

1. Первый срез — только новые audio/document вложения постов. Видео, фото,
   статьи, старые файлы и shared objects остаются отдельными решениями.
2. Загрузка и привязка — существующие администраторы, без новых ролей.
   Непрозрачный `assetId` с серверным receipt; текущие права и владелец проверяются
   сервером. Object key, проверенные MIME/size не задаются клиентом как авторитетные
   значения. Ассоциация выполняется в транзакции сохранения поста.
3. До публикации — локальный preview выбранного File силами фронтендера.
   Серверный preview черновиков не входит в срез; повторный preview после
   перезагрузки не обещается. В этом поручении фронт не изменяется.
4. Потеря upload ACK — неизвестный результат, а не разрешение создать новый
   объект. Повтор с тем же ключом намерения восстанавливает результат без дублей;
   ключ связан с текущим автором, несовпадающее содержимое отклоняется.
   Непривязанные объекты недоступны читателям. Автоматическая очистка выключена;
   сроки хранения orphan/pending и ключей восстановления согласуются отдельно.

Новые объекты private с момента загрузки; published feed/both читаются гостем
через приложение, club — по текущему клубному доступу. После удаления связи
последующие reads запрещены; физическое удаление возможно только после проверки
отсутствия других ссылок. Старый upload/API путь сохраняется, новый opt-in путь
default-off включается только после schema/backend/client/storage acceptance.
Имена маршрутов/таблицы/флага и wire-схемы уточняются в review AG4 внутри этих
границ; это не разрешение добавлять новые продуктовые возможности.

### AG4 — wire и порядок реализации, 14 октября

По прямому поручению реализовать AG4 после AG2. Не менять legacy upload/старые
objects/ACL, frontend, рабочую БД, runtime flags или bucket policy.

- Additive admin procedures `admin.uploadPrivateAttachment` (mutation) и
  `admin.privateAttachmentStatus` (query), только существующий admin/session.
  Первый вход: `idempotencyKey` (16–128 ASCII chars, как существующий post intent),
  `type=audio|document`, canonical base64, filename/MIME; прежние HTTP 50 MiB и
  attachment 32 MiB ceilings не увеличивать. Нет client URL/key/owner/postId/size.
  MIME проверяется существующим byte detector. Receipt: state, assetId, type,
  filename, canonical mimeType/fileSize; object URL/key никогда не возвращаются.
- Новый default-off `PRIVATE_POST_MEDIA_UPLOAD_ENABLED`; read flag сохраняется.
  SQL ledger `private_attachment_uploads`, миграция 0032 только в fixture БД:
  unique actor-scoped request digest, unique server UUID assetId, immutable hash
  bytes+metadata, pinned endpoint/bucket namespace, pending/ready, ETag и связь.
  Intent фиксируется **до** обращения к S3. Retry по тому же ключу проверяет hash,
  текущую сессию/роль и тот же object; pending не выдаётся как успех.
- S3 writer только проверенные private-v1 prefixes, ACL private, conditional PUT
  IfNoneMatch=*, no fallback. Перед upload проверяет scoped Deny policy; после
  lost ACK HEAD/metadata/size/ETag восстанавливают готовность без нового key.
  При неизвестном исходе остаётся pending. Повтор может продолжить только тот же
  объект; автоочистки/TTL/delete endpoint нет. Namespace drift/collision — отказ.
- Additive `privateAssetIds` в existing create/update post. Только свой ready
  receipt и актуальный admin/session; вставка post_media и фиксация receipt binding
  в existing post transaction. Create с private assets требует существующий
  post idempotencyKey. Повторная привязка к тому же посту не добавляет ряд;
  другой пост/автор или удалённая связь — conflict, не скрытое перепривязывание.
  Legacy URL input не может обходить receipt для двух **новых** private-v1 prefixes.
  Старые URL input/metadata остаются прежними. Удаление связи не удаляет S3 и ledger;
  поздний retry не воскресит вложение. Shared objects вне принятого среза.

Срезы: AG4a upload/receipt/status (RED/GREEN SQL/HTTP/SDK wire), AG4b post transaction
и live read access, AG4c actual S3 synthetic acceptance/restart/concurrency/review
и handoff. Wire не считать actual S3 evidence. До full acceptance flag остаётся off.

### AG4 — локальная реализация, проверки и ограничения 14 октября

Срезы: `31b5a2d` (upload/receipt/0032), `ffcdbb3` (association/read), `9c68ccc`
(refuse ready без ETag), `b52b469` (upload/read MIME parity), `b9cae24` (legacy save
compatibility), `314bf2c` (actual restart acceptance). RED показал отсутствующий route; следующие RED — stripped
privateAssetIds/foreign save, legacy private URL bypass, потерю charset и ложный
ready без storage evidence. Дополнительный RED: FLAC получил200, хотя read route
его не обслуживает. Новый upload теперь отклоняет неподдерживаемый MIME400 до SQL/S3;
общая MIME-политика не расширяет прежнюю read boundary или legacy upload.
GREEN: **20** HTTP/JWT/SQL/SDK-wire сценариев; итоговый affected checkpoint
84 pass/4 files/skip0 (75.06 s):
concurrency/lost storage ACK, immutable metadata/namespace, uniqueness guards,
actor/role, SQL-trigger rollback, removal/no resurrection. Старые affected suites:
checkpoint126 pass/4 files/skip0. Roles/CORS/proxy trust/квоты не менялись.

Actual Timeweb `private-attachment-uploads.s3.mysql.test.ts`: **2 pass, skips0**,
6.24 s до последнего MIME guard. API compiled в два fresh Node процесса, SQL/S3 ответы не подменены.
Loopback HTTP proxy пересылает запрос/полный ответ бэкенда и разрывает соединение:
caller не получает ACK. После restart прежний upload key восстанавливает один
assetId/receipt без второго PUT. Lost response создания поста тоже не дублирует
post/media binding. S3 command observer в test bootstrap — call-through.
Storage-ACK fault отдельно проверен на owned SDK wire, не объявлен потерей ответа
реального Timeweb. Bootstrap не читает dotenv и не запускает jobs.
Повтор после MIME guard: два запуска отказали на GetBucketPolicy requestTimeout10s
до подключения SQL/создания объектов; оба actual сценария пропущены, не pass.
Отдельный public endpoint HEAD также дал TLS connection timeout; повтор при
восстановленной доступности Timeweb был нужен, timeout не обходили.
По новому поручению повтор выполнен на HEAD e3044af **после MIME guard**:
**2 pass / 0 skip, 21.22 s, exit0**. API/SQL/Timeweb/restart сценарии и afterAll
cleanup/policy equality прошли. Signed/anonymous границы, lost HTTP upload/post
ACK recovery без дублей и exact WAV Range подтверждены; storage ACK fault по-прежнему
проверяется отдельно на owned wire, не на реальном Timeweb. Runtime-код неизменён,
предыдущий full checkpoint без причины не повторялся.
Новая own tmpfs БД backend_test892be65d1156/loopback58418 удалена после exact
ID/name/owner/port/mount checks, чужие geotermo/diplom не тронуты.
S3 timeout блокер снят; working history/retention/frontend/device gates остаются.

Document10B и корректный WAV46B загружены только в согласованные private-v1 prefixes;
direct anonymous GET/HEAD403. Published club cookie получает точные bytes;
guest/expired отказ без S3, feed guest разрешён. Removal отзывает reads/rebind;
WAV Range206, `RIFF`, `bytes 0-3/46`. Новые post_media возвращают только API URL,
receipt ETag pin отказывает при изменённом объекте. Draft preview/shared/TTL/fallback
не добавлялись. Это backend transport acceptance, не UI/player/device проверка.

Все own S3 fixtures удалены после assetId/payloadHash/size/ETag guards и HEAD404;
полная policy до/после совпала, writes policy/старых файлов не выполнялись.
Own MySQL backend_test loopback33383/tmpfs/no volumes удалён после exact
owner/id/port/mount guards (752bd9b9dffe, daryadarcy-ag4-20261014-1047).
Чужие geotermo/diplom контейнеры сохранены; удалены только synthetic tmpfs данные.
Working DB/history не проверялись/не менялись. Credentials
только stdin/memory и allowlisted child env, не arguments/files/Git.

Финальная общая регрессия после MIME guard: **3418 pass / 1 fail / 179 skip**,
3598 cases, 206.53 s, exit1. Не объявлять весь repo GREEN. Остаток — неизменённый frontend
`__tests__/web-viewport.test.ts`: window stub без document, ReferenceError.
Файл и frontend source совпадают с baseline `c4428eb`, focused reproduce тот же;
по запрету пользователя не исправлялись. Initial full также выявил old publication
argument shape и stale backend procedure inventory: legacy save payload сохранён,
inventory дополнен двумя принятыми процедурами. SQL bulk-video contention сначала
не прошёл, focused и final full прошли; его runtime не менялся. tsc/backend build/
boundaries/docs/diff проверены; skipped не считаются pass.
Read-only check:api exit1 — frontend generated contract отстаёт, не перегенерирован
по запрету пользователя. Backend procedure inventory проверен независимо.

Offline preflight exit1: только прежние untracked0017/0018/0019;0032 зарегистрирован,
databaseChecked=false/releaseApproval=false. На сервер ничего не включено/не выложено.
AG5/AG9 требуют history, retention/export/account deletion для ledger/orphans,
client integration и отдельное разрешение rollout. Recovery правила переданы
в existing backend handoff. TDD/security/incremental/API/review применены;
дополнительные definition-of-done/security-checklist references отсутствуют,
обязательные gates взяты из project plan, работа этим не блокировалась.

Команды: wire — `pnpm exec vitest run tests/private-attachment-uploads.mysql.test.ts --maxWorkers=1`;
actual — чистое окружение с provided in-memory S3 credentials/own DB,
`AG4_S3_ACCEPTANCE=true`,
`pnpm exec vitest run tests/private-attachment-uploads.s3.mysql.test.ts --maxWorkers=1`.
Без opt-in actual suite пропускается и не создаёт fixtures — это не S3 evidence.
Full: `pnpm exec vitest run --maxWorkers=1`; frontend failure не исключать/не скрывать.
Агент `pnpm api:contract` не запускал, generated frontend types не изменялись.

### Историческое основание проекта — 13 октября

13 октября пользователь уточнил, что S3-стенда пока нет. AG2 (настоящая проверка
private ACL/подписи) заблокирован. Этот раздел — подготовка обозримого решения;
согласие на существующий read-only proxy не распространяется на новые uploads,
схему или переключение клиентских URL. Новая миграция не создаётся.

### Что мешает завершить путь

`ContentUploadService.uploadMedia` загружает объект через прежний public-read
`storagePut`, возвращает прямой URL и может записать post_media при наличии postId.
Standalone upload до создания поста не имеет SQL-записи о владельце объекта.
`savePostAttachments` принимает URL/MIME/размер от admin payload; для публичных
ссылок это прежний контракт, но для private object не доказывает принадлежность.
Storage PUT и SQL не являются общей транзакцией: сбой после PUT оставляет объект.

`replacePostVideoRows` сохраняет video URL, но не подтверждённый MIME/размер нового
upload. Поэтому путь видео требует собственной проверки metadata/association;
нельзя считать `.mp4` или URL достаточным доказательством. Текущий resolver proxy
принимает только точные собственные `feed/audio|documents|videos|reels` URLs,
не любую папку с названием private.

### Принятое минимальное продолжение

Первый upload-срез — **только новые audio/document вложения постов**. Использовать
прежний live-check proxy, публичные feed/both читать через него гостем, клубные —
по текущему доступу. Новые объекты такого пути хранить private ещё до ассоциации:
будущий target неизвестен при загрузке. Старые public uploads/URLs не переключать.
Новый путь должен включаться отдельно после schema/backend/client/storage проверки;
существующий read-only флаг сам по себе не меняет upload semantics.

Нужен серверный учёт нового upload (минимальный receipt/asset reference):
непрозрачный assetId, владелец операции, точные object key/MIME/size и состояние связи.
Конкретные имена поля/таблицы/флага выбрать в review; это предлагаемое additive
изменение, не объявленный действующий API. Не создавать postId=0, фиктивные parent
строки, временно опубликованные посты или новый bearer-token вместо сессии.

Принятый контракт: новый private upload возвращает asset reference и проверенную
metadata без прямого storage URL; создание/изменение поста принимает reference.
Сервер проверяет текущего автора/права, наличие receipt и готовность upload,
ассоциирует его в транзакции поста/creation intent. MIME/размер/key читает из
серверного receipt, не из клиента. Повтор сохранения с тем же intent не дублирует
связь; failed upload не связывается. Старый URL-input остаётся прежним и не получает
private привилегий только из-за похожего пути. Подмешивать новый upload-mode без
обновления клиента запрещено; сначала совместимый opt-in путь.

Unassociated private object не читается гостем/участницей. Принятый preview до
публикации — только локальный File; отдельный server admin/owner preview policy
не входит в этот срез. Нельзя расширить read route на draft без нового решения.
После удаления связи дальнейшие GET/HEAD/range закрыты; физическое
удаление только по подтверждённому отсутствию других ссылок. Orphan cleanup требует
учёта pending/retry и отдельного срока; TTL сейчас не назначать. Upload ACK loss
не означает, что object не создан, и не разрешает бессистемный повтор/удаление.

### Остальные типы и shared references

| Источник | Минимальная оставшаяся граница | Что сохраняется |
| --- | --- | --- |
| Новое post_media video/raw video | Серверная upload metadata + связь; отдельный малый срез после audio/document | Существующие video IDs/порядок/старые URL/VK |
| Фото posts.photos/richText | Reference-level авторизация и новое private upload/read решение; post_media ID отсутствует | Публичные feed/both и текущие editor inputs до согласованного opt-in |
| Фото комментария | Связь с comment/parent post, текущая публичная/клубная policy; авторизация upload не заменяет read | Публичное обсуждение авторизованных, сроки и роли |
| article sections/photo/png/carousel | Связь с article/access/published, не выводить доступ из cover | Public article body и гостевой teaser |
| article cover/auto teaser | Cover уже выдаётся гостю; club teaser не делает этот объект исключительно закрытым | Публичная обложка намеренно остаётся публичной |
| Avatar/сезонный фон/баннер | Публичные ресурсы, не часть paid delivery | Прежнее оформление |
| Shared public/private object | Прямой доступ нельзя запретить и одновременно сохранить публичную ссылку; для новых закрытых данных отдельный объект/association после решения | Не менять ACL общих/старых объектов молча |
| Unknown/external/legacy URL | Диагностика и отдельное решение; без arbitrary fetch и автоматического переноса | Старые ссылки и внешние источники |

Карта ссылок — metadata evidence, не ACL evidence. Неполные/неизвестные связи не
объявлять orphan/public/private автоматически. Общий пункт ТЗ 4.5 не закрывается
новыми объектами, пока старые прямые URL обходят приложение; по текущему поручению
старые файлы исключены из изменений, этот остаток сообщается отдельно.

### Acceptance и последовательность

1. После предоставления собственного S3 — AG2: private direct GET/HEAD deny и
   public fixture allow; actual SDK signature/ACL, proxy bytes/ranges, current access.
2. AG3 принят 14 октября: только новые audio/document, server receipt/reference,
   локальный preview и безопасный повтор после потери ACK; клиентские изменения
   отдельно фронтендеру. Retention/автоочистка/enablement отдельно; старый путь
   сохраняется. Реализация не начинается до успешной проверки AG2.
3. После AG2 — AG4 одним вертикальным срезом: upload → receipt → transactional
   association → permitted/denied read → detach, включая lost reply, чужой receipt,
   отсутствующую схему, storage failure и сохранение публичных ресурсов.

Готовность означает native SQL/HTTP/actual S3 evidence и согласованный клиент,
не модель ACL в loopback handler. Сейчас выполнено только code/reference review;
никаких новых runtime/API/schema/upload/ACL/frontend/old file изменений.

## Цель и первый срез

Приложение отдаёт байты вложения через сервер, проверяя текущую публикацию,
сессию и клубный доступ, а не выдаёт подписанный S3 URL на предъявителя.
Первый срез — GET/HEAD для связанных post_media audio/document/video.
Фотографии posts/articles/comments, raw uploads без association, article sections,
аватары/обложки, external/VK embed и старые public objects не объявляются закрытыми.
Каждый из этих источников потребует отдельного проверенного расширения.

Предположения для согласования:

- Live-check proxy предпочтителен: подписанную ссылку можно передать другому
  человеку, и она сохраняет доступ до TTL после блокировки/истечения подписки.
- Используем существующую cookie/Bearer session, без новой авторизации. В коде
  frontend уже есть /api/:path* rewrite, cookie имеет path=/, HttpOnly, SameSite=lax.
  Это свидетельство возможности интеграции, не browser acceptance.
- Добавляем default-off PRIVATE_POST_MEDIA_DELIVERY_ENABLED; существующие reads,
  uploads и persisted URLs не переключаются автоматически.

## Контракт

Предлагаемый маршрут: GET/HEAD /api/media/post-attachments/:mediaId.
mediaId — положительный safe integer; запрос не принимает storage key, URL,
userId, роль, подписку или query-токен. Сервер находит attachment и parent post.

- Flag off: 404 до SQL/storage/auth side effects нового маршрута.
- Missing/невалидный ID, unpublished/draft/scheduled parent, отсутствие доступа
  к club parent: одинаковый generic404, без object URL/key/provider details.
- Published feed/both: гостевой read допустим, как текущий публичный контент.
- Published club: текущая валидная сессия и каноническая userHasClubAccess.
  Истечение/блокировка/sessionVersion/role removal учитываются при следующем
  GET/HEAD/range запросе. Доступ не выводится из prefix или роли клиента.
- Draft preview не входит в первый срез; позднее отдельная owner/admin policy.
- Authorization/SQL failure: fail closed, без storage запроса; generic503 при
  внутренней недоступности, без стека/секретов и без fallback на direct URL.
- Открытый ранее stream может закончиться после утраты доступа: не обещаем
  ретроактивное удаление уже скачанных байтов или мгновенный обрыв каждого stream.

Storage boundary: только настроенный S3 и точно сопоставленный собственный объект.
Никакого fetch сохранённого URL, redirects, arbitrary origin/path или Manus
fallback. Старые signed/external/ambiguous URL не угадывать и не декодировать
повторно. Новый private namespace не является доказательством association/ACL.
В первом read-only срезе тестовые строки/объекты создаются только изолированным
harness; переключение upload и новая object metadata — следующий review gate.

Отдавать stream, не весь файл в память. HEAD возвращает метаданные без тела.
Один byte range (включая suffix/open-ended), 206/Content-Range/Accept-Ranges;
malformed/multiple/unsatisfiable range →416 без выдачи полного файла вместо range.
Проверка доступа предшествует storage HEAD/GET даже при условных/range запросах.
200/206 и ошибки: Cache-Control: private, no-store; X-Content-Type-Options:nosniff.
Provider headers не копируются wholesale; allowlisted MIME, безопасный disposition,
нет HTML/SVG execution, Location/Set-Cookie/provider internals наружу не отдаются.
Разрыв client connection/ошибка stream закрывают provider stream; без retry,
который мог бы дописать другой response. Conditional caching не входит в срез.

## Стек, структура и стиль

Существующие TypeScript/NestJS/Express, Drizzle/MySQL, AWS SDK S3 и Vitest;
без новых dependencies. ContentModule владеет association/policy/controller,
identity — существующей session/club policy, storage — object transport.
Тесты: tests/*private-files*.test.ts и opt-in *.mysql.test.ts; инструкции и
evidence — этот spec, tasks/plan.md, tasks/todo.md и существующая media access map.
Не создавать db→identity cycle. Reader той же SQL-сессии там, где нужны locks.

```ts
// Решение о доступе не принадлежит storage transport.
const allowed = await userHasClubAccess(user);
if (!allowed) return unavailableResponse();
```

## Проверки и команды

Сначала RED на отказ/без storage effects, затем GREEN. Unit и loopback HTTP wire
не доказывают private bucket ACL. Реальная приёмка требует собственного S3 стенда,
dedicated test bucket/test-only connection и принадлежащего задаче loopback/tmpfs
backend_test контейнера. Рабочие credentials/bucket/DB не читать.

Команды из корня репозитория (Node22 в PATH):

```sh
pnpm exec vitest run tests/private-files.mysql.test.ts --maxWorkers=1
pnpm exec vitest run --maxWorkers=2 --reporter=dot --silent
pnpm check
pnpm build
pnpm check:boundaries
pnpm check:docs
git diff --check
```

Focused test opt-in: без BACKEND_TEST_DATABASE_URL пропускается, не считается
native приёмкой. Native SQL/S3 команды и значения test-only подключения записать
после подтверждения владельца fixture; не использовать
случайный унаследованный DATABASE_URL/S3 env. Существующий server не запускать
с рабочими конфигурациями для проверок.

Acceptance: guest/paid/expired/blocked/staff/session revoked; published/draft/
hidden/deleted/association removed; GET/HEAD/range; no provider request на denial;
байты/длина/диапазон точны; direct anonymous private-object GET denied на actual
S3, public covers/avatars не сломаны; cookies через существующий rewrite работают
в browser без frontend changes. Проверять отзыв между отдельными запросами.

## Границы и критерии завершения

Always: canonical rights, generic errors, streaming cleanup, RED/GREEN, review,
отдельные local commits, честное разделение mock/wire/native acceptance.
Ask first: schema/object metadata, switching uploads/returned URLs, изменение
разделения public/private, existing-object migration/backup/rollback/enablement.
Never: frontend edits, новые роли/CORS/proxy trust/квоты/смысл подписки, global
public-read→private, working DB/bucket/ACL writes, push/deploy, внешние письма,
реальные/новые тестовые платежи, secrets/logged query tokens или fallback-public.

Read route в изоляции не завершает пункт5: direct old URLs остаются обходом,
пока не принят upload→association→proxy read и проверенный rollout старых объектов.
VK public embeds требуют отдельного согласования с заказчиком.

## Принятое решение и локальный checkpoint

Пользователь подтвердил live-check proxy через существующую сессию, default-off,
первый срез только post_media, без автоматического upload/URL/ACL переключения.
Native HTTP/JWT/SQL + actual AWS SDK/owned loopback object wire: 48 cases проходят;
final affected content/deletion: 99 pass/3 suites, exit0, 3.39 s. RED3 initial,
RED10 range и RED2 URL alias/empty range, RED1 ingress cache preceded GREEN.
Fixture поправлен для штатного SDK x-id query (диагностическая ошибка fixture,
не дефект рабочего приложения). Wire проверяет подписанный request и If-Match
header presence, **не валидирует S3 подпись или ACL**.

Native GET/HEAD, closed/open/suffix ranges; published/club/expired/blocked/
sessionVersion/current moderator role; SQL failure/no S3 on denials; endpoint/
bucket/path/URL ambiguity, provider errors/redirect/no retry, client abort and
HEAD→GET object consistency. Only configured canonical S3 object URLs in
feed/audio|documents|videos|reels are eligible in this initial slice; no key-prefix
access decision. HEAD ignores Range and returns complete metadata; GET checks it.
Generic attachment disposition avoids SQL filenames/header injection; MIME
allowlisted from SQL, not blindly copied from provider. No signed URL in response.

20 октября, локальное исправление имени скачивания: shared `sendPrivateFile`
добавляет canonical extension по сохранённому MIME к существующему безопасному
label (`file.pdf`, `attachment-123.mp3`, `holly.webp`). Нормализованное фото
получает `.webp`, а не расширение исходного upload filename. Для opaque MIME
fallback `.bin`; это не расширяет upload/read MIME allowlist. Исходные имена,
SQL metadata и storage paths в заголовок не копируются. GET/HEAD/Range используют
одинаковое имя; inline/attachment, bytes, права и error semantics прежние.
Настоящие HTTP handler + AWS SDK на собственном loopback wire: RED22 из25
после исправления fixture для штатного SDK query `x-id`, затем GREEN25/0skip.
Resolver в этих тестах подставляет разрешённые metadata, SQL/auth/S3 ACL не
проверяются. Это самостоятельный дефект, не причина неизвестной live U1 assertion;
live выдача и зимние привязки остаются незавершёнными. Working DB/S3/flags,
frontend, старые файлы и сервер не менялись; исправление ещё не выпущено.

Default run on final production code: 2327 pass/1208 opt-in skips (3540),
55.37 s, exit0; subsequently added three opt-in provider consistency cases passed
in native99, production code unchanged. Types/build479.9kb/boundaries622/API73
pass; no new dependency/schema/upload/legacy URL/frontend change.

Actual S3 ACL/private anonymous denial, browser rewrite/device acceptance and
real-provider load tuning remain unaccepted before enablement; next is M2b
on selected dedicated local S3 fixture. App proxy itself cannot close old direct
URLs. No working flag/ACL/DB mutation, push/deploy or external file fetch occurred.

### Follow-up: bounded waits and error format

Installed SDK handler has timeouts off by default. Own-wire RED1 waited until
12-second outer abort; GREEN1 fails itself at10 seconds with one request and
socket closure. New reader config: connection5 seconds, header response10 seconds,
throw on timeout, no retries. SDK resolves GET at response headers, so controller
also bounds data-flow inactivity to30 seconds, resets on chunks and removes timer/
listener on all exits. This is not a30-second total download limit: native40-second
progressing stream delivers complete bytes. Native stalled-body RED1 reached
35-second safety cutoff; GREEN stops at30 seconds and closes upstream.

Full affected run **102 pass/4 suites, 85.94 s**, including both long stream cases.
Follow-up RED9 exposed file MIME/disposition leaking into JSON416/503 errors;
cleared file headers before JSON replies. Final affected **100 pass/2 deliberately
filtered long cases (102), 14.50 s**; long cases were already checked above and
their stream/timer code unchanged by the final error-format fix. Types/build480.5kb/
boundaries622/API73/focused format pass. Only new route/reader are changed; existing
upload/public URLs/working files/frontend untouched. Actual S3 and load remain gates.
