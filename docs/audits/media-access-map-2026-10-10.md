# M1a: карта границ доступа к медиа — 10 октября 2026

Статус: локальная инвентаризация кода и проверка исходящего S3-протокола.
**Не сертификат приватности рабочего bucket и не подтверждённая утечка его файлов.**
Рабочие объекты, секреты, кабинет и ACL/policy сервера не читались и не менялись.
Пока A6c3 ожидает решения о webmail navigation, это независимый безопасный пункт M1.

## Подтверждённая граница

[storage.ts](../../apps/backend/src/storage.ts) отправляет `PutObject` с
`ACL: public-read` для всех S3-загрузок, независимо от будущего типа публикации.
Возвращается прямой endpoint/bucket/key URL без срока/подписи/проверки подписки.
`storageGet` строит такой же URL без запроса к bucket; по текущему поиску вызовов
helper не используется production-потребителями. Основной путь — сохранённые
URL, возвращённые `storagePut`, а не вызов `storageGet` при каждом чтении.

[Четыре wire-проверки](../../tests/storage-public-boundary.test.ts) используют
настоящий AWS SDK и собственный loopback HTTP endpoint с синтетическими ключами.
Проверены исходящие PUT/ключ/ACL для фото, документов и club comment photos,
а также отсутствие storage-запроса при `storageGet`. Все четыре проходят.
Сервер fixture лишь принимает PUT: он не моделирует ACL, anonymous GET, Block
Public Access, Object Ownership, CDN или Timeweb. Успех этих тестов **не доказывает**
анонимную читаемость рабочего объекта. Производственный код не изменялся.

## Карта классификации перед M2

| Источник/ссылка | API-граница | Object key / хранение URL | Что проверять перед переносом |
| --- | --- | --- | --- |
| Фото публикации | `admin.uploadPhoto`; чтение club-поста ограничено сервисом | `feed/photos/<uuid>.webp`; `posts.photos`/richText | Сопоставить объект всем постам и статьям; один prefix не означает публичность |
| Аудио/документ/видео вложения | `admin.uploadMedia`; публикация/чтение зависит от поста | `feed/audio`, `feed/documents`, `feed/videos`; `post_media.url` | Club/draft/scheduled против feed/both; загрузка до ассоциации может оставлять orphan |
| Raw-видео | admin-only `/api/admin/upload-video` | `feed/reels/<uuid>_<safe-name>` | Определять доступ по всем ссылкам на объект, не по filename/prefix |
| Фото комментария | `club.uploadCommentPhoto` требует аккаунт; `club.comments` — clubMemberProcedure | `club/comments/<userId>/<uuid>.webp`; `post_comments.photos` | Подписка/блокировка на API не проверяется при прямом чтении object URL |
| Avatar | профиль своего аккаунта | `avatars/<userId>/<uuid>.webp`; `users.avatarUrl` | Не считать платным вложением автоматически; сохранить публичный дизайн |
| Статья/обложка | `articleById` скрывает sections без club-доступа, но отдаёт cover/title как teaser | `articles.coverUrl`, `articles.sections` | Обложка может быть намеренно публичной; вложения sections классифицировать отдельно |
| Каталог видео/YouTube service | published-каталог и отдельный сервис явно публичны | `videos`, `/api/yt/<id>`, thumbnail cache | Не превращать нынешние публичные видео в платные молча; это отдельный V1-контракт |
| Ранее сохранённые/внешние URL | post/article inputs сохраняют допустимые ссылки | SQL/JSON может ссылаться на чужой origin | Нельзя исправить чужой storage сменой ACL нашего bucket; нужен отдельный список |

Источники границ:
[uploads](../../apps/backend/src/content/content-upload.service.ts),
[photo encoding](../../apps/backend/src/media/photos.ts),
[admin router](../../apps/backend/src/admin/router.ts),
[club router](../../apps/backend/src/club/router.ts),
[content reads](../../apps/backend/src/content/content-read.service.ts),
[raw video](../../apps/backend/src/content/video-upload.controller.ts),
[profile](../../apps/backend/src/profile/profile.service.ts),
[public video](../../apps/backend/src/content/videos-router.ts),
[video service](../../apps/video-service/server.mjs).

## Открытая приёмка M1/M2

### M1b1: точные reference-границы — 12 октября 2026

Первая часть M1b, не готовый exporter/object inventory и не M2. Проверка
[native article HTTP/JWT/SQL](../../tests/nest-admin-articles.mysql.test.ts)
создаёт synthetic published club article, где один URL одновременно находится
в cover и photo section. Настоящий writer добавляет его в photos автоматически
созданного club teaser (`source=article:<id>`). Guest получает этот URL в cover
locked article, но sections=[]; admin получает оба section URL. SQL associations
и admin identity не меняются при чтении. **1 focused pass (1.49 s), полный
article suite 33 pass (2.88 s)**. Object GET/HEAD/range не выполнялись; hostname
synthetic, хранилище/рабочие ACL не затронуты. Это доказательство пересечения
API references, не доказательство читаемости закрытого файла в рабочем bucket.

Collector должен учитывать сырые сохранённые references, не только нормализованный
renderer output: legacy sections могут хранить heading/body/photos, а неизвестные
JSON shape нельзя молча отбросить и объявить объект orphan.

| Источник для локальной карты | Видимость reference по текущему коду | Особый случай |
| --- | --- | --- |
| posts.photos, post_media.url, richText.children[].link, ссылки posts.text | Published feed/both доступны публично; club — club access; draft/scheduled/legacy published=false не public | target=both не становится private от наличия club view; ссылки в тексте — candidates для сопоставления inventory |
| articles.coverUrl | Published article: cover возвращается guest даже при locked=true | Auto teaser содержит тот же URL, но target=club; этот target не отменяет публичность cover |
| articles.sections[].url/urls и legacy photos, ссылки text/body | Published public article body публичен; published club sections требуют доступа; unpublished article не public | photo/png/carousel/link и markdown candidate links; неизвестный формат требует diagnostic, не empty result |
| post_comments.photos | Чтение club.comments требует clubMemberProcedure; родитель должен быть published | Префикс club/comments и автора недостаточно для прямого URL access-check |
| users.avatarUrl | Отдельный публичный avatar class согласно сохранённому дизайну | Не закрывать avatar из-за club user/общей папки |
| videos.thumbnailUrl/videoUrl | Published videos list/getById используют publicProcedure | Не превращать каталог в платный без отдельного V1-контракта |
| launch_settings.config сезонные backgroundUrl/bannerUrl | Публичное оформление | Учитывать отдельно от закрытых вложений; inline/static/external URL не обязательно S3 object |

Источники: [schema](../../packages/database/src/schema.ts),
[rich text](../../packages/shared/src/rich-text-types.ts),
[article normalization](../../packages/shared/src/article-blocks.ts),
[teaser writer](../../apps/backend/src/content/article-writes.ts),
[feed reads](../../apps/backend/src/content/post-catalog-repository.ts),
[comment boundary](../../apps/backend/src/club/router.ts),
[video boundary](../../apps/backend/src/content/videos-router.ts),
[season configuration](../../packages/shared/src/launch-settings.ts).

Для будущего read-only collector: группировать все exact references на объект;
public/restricted/shared — состояние ссылок, не автоматически назначаемый ACL.
Unmatched/ambiguous URL и неполная inventory остаются unresolved. Orphan можно
объявлять только при полной проверенной карте ссылок и перечислении собственных
objects. Никакого fetch внешнего URL, загрузки .env, чтения working bucket/PII,
вывода signed query/PII в log или автоматической смены ACL/URL/SQL здесь нет.
Следующий срез: collector на synthetic SQL/JSON с явным incomplete/unknown
результатом; затем M1c own isolated storage GET/HEAD/range. Контракт M2 требует
отдельного review до изменения выдачи и переноса.

### M1b2: offline article-reference collector — 12 октября 2026

`tooling/scripts/media-reference-map.ts` принимает только stdin JSON envelope
`{"articles":[...]}`. В каждой строке строго выбранные поля: положительный unique
`id`, `access` public/club, `published` boolean либо SQL 0/1, `coverUrl` string/null,
`sections` JSON array либо JSON string. Лимиты: 1 MiB stdin и 5000 articles.
Пример запуска с заранее подготовленным **synthetic** snapshot через stdin:

```sh
node node_modules/tsx/dist/cli.mjs tooling/scripts/media-reference-map.ts < synthetic-article-snapshot.json
```

Сборщик не читает `.env`, БД, файлы хранилища и не делает URL fetch. Он возвращает
`scope: articles-only-no-object-inventory`, SHA256 exact original URL groups,
reference paths и issues; исходные URL/text/query/credentials в stdout/stderr не
попадают. Invalid metadata, malformed stdin или oversize дают exit1 и generic
error без partial stdout. Unknown sections/fields и malformed sections JSON
сохраняются как issues; их нельзя считать полной картой. Optional пустые scalar
URL пропускаются. URL с query/fragment остаются отдельными exact-byte группами
и требуют object resolution: signed aliases не объединяются предположительно.

Published cover намеренно public даже для club article; published public body
public, club/unpublished body restricted. Совпадение public/restricted references
даёт shared, **не ACL decision**. Ни external-vs-own, ни orphan, ни физический
object identity этот срез не определяет. Native SQL/HTTP evidence M1b1 выше
подтверждает cover exception; этот срез проверен JSON/unit и actual CLI, не SQL.
Focused9 pass, types pass, default workers2 2286 pass/1121 opt-in skips, exit0.

M1b3 проверил реальный mysql2 SELECT выбранных article полей в own disposable
loopback/tmpfs backend_test: SQL0/1 и JSON array без repository normalization
сохраняют shared public cover/restricted legacy draft/club photo и unknown block
issue. Snapshot после collector неизменен; guest public/locked HTTP detail
сохраняется. Focused1 pass (1.34 s), full native article34 pass (2.27 s), types
pass. Test-only characterization, не новый production fix или рабочий exporter.

M1b4 library `collectPostReferences` принимает selected `{posts,media}` snapshot:
posts: id/published/status/target/photos; media: id/postId/url. Strict metadata,
unique IDs и лимиты 5000 posts/10000 attachments; photos array или JSON string.
Published feed/both photos/attachments public, club или непубликуемые restricted.
Та же exact-byte/redacted URL обработка; prefix не определяет доступ. Malformed
photos и attachment parent absent in snapshot дают issues, не orphan result.
Scope `post-photos-media-only-no-object-inventory` явно исключает text/richText/
comments/прочие источники. Article stdin CLI по-прежнему принимает только articles;
post helper пока library-only. Focused article/post13 pass, types pass; actual
post SQL/object acceptance этим срезом не заявлена. Default workers2 2290 pass/
1122 opt-in skips (3417), exit0, 47.78 s; docs/format/diff pass.

M1b5 расширяет library snapshot optional `articles` и `comments` (selected
id/postId/photos), а posts — optional text/richText. Article cover/sections и
post/media/comment refs объединяются по exact URL hash; scope теперь
`content-references-partial-no-object-inventory`. Comments photos null допустимы,
array/SQL JSON string собираются как restricted даже для feed parent — нынешний
club.comments boundary требует membership. Missing parent/unknown fields/shape/
malformed JSON остаются issues, duplicate comment IDs отклоняются generic error.
Raw richText links собираются до display normalization, чтобы не терять evidence.
Plain posts не renderят automatic links: HTTP(S) text candidates явно помечены,
punctuation и www/relative aliases не превращаются в object identity.
Empty photo-array URL теперь invalid-url (RED/GREEN); optional scalar empty
cover/link semantics прежние. Native SQL writer→auto teaser + synthetic comment
подтвердил cross-source shared group и отсутствие rewrite rows/rights. Final
focused19 pass, native article34 pass, types pass; default workers2 2296 pass/
1122 opt-in skips (3423), exit0, 48.16 s. Own tmpfs cleaned; docs/format/diff pass.
Article stdin CLI unchanged;
новые sources пока library-only, не exporter рабочих данных/полная inventory.

M1b6 добавляет optional `decoration` с selected arrays: avatars id/avatarUrl,
videos id/published/thumbnailUrl/videoUrl, seasons season/backgroundUrl/bannerUrl.
Список не принимает email/profile/managerEmail/full configuration. Avatar и theme
URLs public, published video URLs public, unpublished video refs restricted.
Duplicate IDs/season names и extra fields отвергаются; ограничения 10000 avatars,
5000 videos, 4 seasons, URL 4096 chars; nullable URL пропускаются. Shared collision
с club content не меняет публичность этих references автоматически. Focused22
JSON/unit pass и types pass; не новая SQL/object/browser проверка. Partial scope
остаётся, omitted sources не считаются полными; article stdin CLI unchanged.
Default workers2 2299 pass/1122 opt-in skips (3426), exit0, 48.97 s;
docs/format/diff pass, no new dependencies or ACL/API changes.

### M1b7: selected-source CLI и declared inventory

CLI поддерживает прежний `{articles}` либо `{content, inventory?}`. Content —
selected posts/media/articles/comments/decoration по схемам выше, без `.env`/
working DB/object fetch; stdin ограничен 1 MiB. `snapshotCoverage` сообщает
missing source/text/richText fields. `selectedFieldsComplete` означает наличие
полей, не всех строк базы, не отсутствие issues и не полноту objects.

Optional inventory: `objects:[{objectId,urlHashes}]`, `externalUrlHashes:[hash]`.
objectId — opaque ASCII identity 1–80 chars, hashes — exact SHA256 URLs; лимит
10000 objects/100 aliases per object/10000 external hashes. Duplicate identities
или неоднозначные aliases отклоняются generic error. Report `objectMap` даёт
public/restricted/shared refs, заявленные external refs, unresolved URL hashes
и unassociated-in-snapshot objects. **Никогда не orphan/delete authorization.**
Scope `declared-selected-inventory-not-rollout`: supplied aliases/external labels
не проверяются сетью и не доказывают рабочую object identity/ACL. Нельзя применять
результат автоматически к рабочим objects, особенно при issues/missing fields.
Final library/native CLI25 pass, types pass; default workers2 2302 pass/1122
opt-in skips (3429), exit0, 51.76 s. No new dependency or production endpoint.

### M1b8: missing-parent associations остаются в карте — 12 октября 2026

Найдено и воспроизведено: выбранные post_media/comment строки с отсутствующим
в снимке parent сохраняли issue, но теряли URL reference. Declared object тогда
выглядел unassociated-in-snapshot несмотря на имеющуюся строку ссылки.
RED1 → collector сохраняет валидные ссылки с `visibility: unknown`, parent issue
остаётся. Malformed JSON/URL по-прежнему diagnostic, без раскрытия значений.

`unknown` — добавленное значение offline JSON-контракта groups/objectMap.objects,
не новый application endpoint или доступ к объекту. Оно имеет приоритет над
public/restricted/shared при совмещении references или aliases одного объекта:
неполная родительская связь не становится доказанной через другую ссылку.
Все reference paths остаются; known public cover не разрешено молча закрывать.
Любое `unknown`/issue требует ручного разрешения полноты/идентичности, **не ACL,
orphan, удаление или разрешение private delivery**. Потребитель должен обрабатывать
новое значение как unresolved, не подставлять public/restricted по умолчанию.

Focused library + actual CLI28 pass (2.36 s), включая public same-URL и отдельный
public alias рядом с unknown parent; исходные URL не выходят в stdout. SQL/S3
не запускались: это offline JSON/CLI исправление, не live inventory acceptance.
Default workers2 2305 pass/1133 opt-in skips (3443), exit0, 49.51 s;
types/docs54/format/diff pass. SQL/browser/build с неизменённым приложением
не повторялись; отсутствующие S3 details и reviewed rollout всё ещё gated.

### M1b9: URL-кандидаты неизвестных article blocks — 12 октября 2026

RED1 воспроизвёл потерю `url/urls/photos` неизвестного блока при наличии
публичной обложки с тем же URL: объект ошибочно выглядел только public.
Collector теперь сохраняет эти известные поля как `unknown` candidates с
неизменным unknown-shape issue. Это сырая сохранённая связь, не утверждение,
что renderer поддерживает этот блок или что URL является собственным объектом.
При отсутствии cover связь тоже не теряется. Некорректные URL/элементы/массивы
отдельно диагностируются, исходные значения не попадают в отчёт.

Не выполняется рекурсивный поиск произвольных полей неизвестных объектов:
unknown-fields/shape и прочие issues по-прежнему запрещают считать карту полной.
Никаких ACL/delete/publication changes. Final focused library/CLI regression30
pass (1.80 s), types pass; actual SQL/storage/browser этим срезом не проверялись.
Default workers2 2307 pass/1133 opt-in skips (3445), exit0, 53.42 s;
types/docs54/format/diff pass. Рабочие файлы/данные/ACL не затронуты.

### M1b10: неподдерживаемый rich-text block — 12 октября 2026

RED1 показал: сохранённый children[].link внутри неизвестного типа блока
поста получал public-класс родителя, хотя присутствовал unknown-shape issue.
Теперь explicit link candidate сохраняет `unknown`; совпадающее публичное фото
не устраняет неопределённость. Поддерживаемые paragraph/heading сохраняют прежнюю
классификацию. Политика renderer/access не меняется, неизвестный тип не получает
поддержку; issue и hashed reference paths остаются. Focused library/CLI31 pass
(2.79 s), types pass; это offline классификация, не SQL/S3/direct URL acceptance.
Default workers2 2308 pass/1133 opt-in skips (3446), exit0, 51.84 s;
types/docs54/format/diff pass, неизменённые build/browser/SQL не повторялись.

### M1c runtime preflight — 12 октября 2026

Официальный MinIO pinned RELEASE.2025-06-13T11-33-47Z недоступен: quay registry
401, Docker Hub pull access denied, official archived linux-arm64 binary HTTP410.
Контейнер не создавался, registry credentials/рабочий bucket не читались.
Основание выбора runtime: [официальная container документация](https://min.io/docs/minio/container/index.html).
Нужен доступный own isolated runtime (official-source build либо собственный
S3-compatible test stand); это конкретный blocker actual GET/HEAD/range.
SDK loopback wire не объявляется policy acceptance. Guest/paid/expired/blocked
application API/direct object matrix и M2 reviewed delivery всё ещё open.

Next: isolated runtime и actual storage acceptance на известных synthetic objects;
рабочая inventory/object resolution отдельно gated. M1b rollout не закрыт,
M2 delivery contract/rollout требует отдельного review.

1. На собственном изолированном S3-совместимом хранилище проверить public/private
   объекты: guest/expired/blocked/paid через настоящее API и прямой GET/HEAD/range.
   Loopback wire выше не заменяет эту проверку.
2. Отдельной согласованной read-only процедурой получить карту рабочих объектов
   и всех SQL/JSON ссылок, ACL/policy и CDN. Не использовать имя папки как права.
   Shared public/private объект требует явного решения или копии, не смены ACL вслепую.
3. Выбрать проверенный private delivery путь: сервер с live access-check либо
   ограниченная подписанная ссылка. Срок ссылки и отзыв при блокировке — часть контракта.
4. Репетиция переноса, backup/rollback, старые сохранённые URL и browser cache;
   orphan/delete и публичные teaser/avatar остаются отдельными классами.

**M1 открыт**, M2 не начат. Изменение одного `public-read` на `private` сейчас
сломает все текущие direct URL и не исправит старые объекты, bucket/CDN policy
или внешние ссылки. Массовые ACL/URL/данные и смысл подписок не изменялись.
