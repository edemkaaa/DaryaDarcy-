# Spec: закрытая серверная выдача вложений постов

## Статус — Accepted for local implementation, 13 октября 2026

Пользователь разрешил делать серверную выдачу после code review пункта5 документа
«Задачи_бэкендеру_2026-10-12.md» и подтвердил этот контракт: «Да, делаем так.
Го реализовывать закрытую выдачу вложений постов, фронт и старые файлы не трогай».
Это не разрешение миграции рабочих объектов или включения флага.
Фронтенд не меняется.

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
