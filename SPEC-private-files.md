# Spec: закрытая серверная выдача вложений постов

## CF — фото и материалы статей, принят 15 октября 2026

После показа минимального контракта пользователь поручил «делай далее все».
Разрешена локальная backend реализация новых фото постов/комментариев и фото,
PNG/каруселей/документов статей. Frontend, старые S3 objects/URL, working DB,
bucket policy и rollout не менять. Новая возможность default-off.

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
