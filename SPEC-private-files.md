# Spec: закрытая серверная выдача вложений постов

## Статус — Accepted for local implementation, 13 октября 2026

Пользователь разрешил делать серверную выдачу после code review пункта5 документа
«Задачи_бэкендеру_2026-10-12.md» и подтвердил этот контракт: «Да, делаем так.
Го реализовывать закрытую выдачу вложений постов, фронт и старые файлы не трогай».
Это не разрешение миграции рабочих объектов или включения флага.
Фронтенд не меняется.

## AG2 — фактический Timeweb S3, storage gate не пройден 14 октября

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

## AG3 — контракт принят 14 октября 2026, реализация ждёт AG2

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
