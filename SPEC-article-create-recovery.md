# Spec: создание статьи без дублей после потери ответа

## Статус — Accepted for local backend implementation, 13 октября 2026

Пользователь после предложения контракта поручил: «я спать а ты делай дальше».
Принято как согласие на контракт и локальную backend реализацию/новую additive
миграцию. Не разрешение рабочей миграции/выкладки. Фронт не трогать.

## Цель и исходное состояние

Сегодня admin.createArticle возвращает числовой ID; каждый вызов создаёт новую
статью. Статья и teaser-пост уже сохраняются одной транзакцией, но ключа операции
нет. Источники: apps/backend/src/admin/router.ts, content/article-writes.ts,
content/content-write.service.ts, db.ts. Существующие post_creation_requests и
ADR-004 — образец, не журнал для статей.

Успех: повтор одного создания после lost reply/restart/reload не создаёт другую
статью или teaser. Две намеренно одинаковые статьи с разными ключами допустимы.
Название, время и список статей не являются идентификатором операции.

## Предположения для согласования

- Существующие авторизация и tRPC остаются; роли/квоты не меняются.
- Совместимость: старые запросы без ключа работают как раньше, без гарантии retry.
- Клиент создаёт ключ один раз ДО первой отправки и сохраняет его по аккаунту.
- Отдельный журнал хранит хеш данных и исходный ID, без копий текста/медиа.
- Успешные ключи без автоматического TTL; удаление статьи не удаляет результат.

## API: admin.createArticle

Добавить optional idempotencyKey: lowercase UUID v4, 36 символов. Переданный
пустой/невалидный ключ — BAD_REQUEST, не fallback к unkeyed созданию.
Ответ остаётся number — исходный articleId.

```ts
// Предложение интерфейса, не внедрённый код.
type CreateArticleRequest = ExistingCreateArticleInput & {
  idempotencyKey?: string;
};
type CreateArticleResult = number;
```

Ключ привязан к серверному authenticated actorUserId и admin.createArticle:v1.
Автор не принимается от клиента. Тот же ключ другого автора — отдельная операция,
без возможности чтения чужого результата. Текущая adminProcedure проверяется
перед replay и status, включая blocked/revoked session; новых прав не добавлять.

| Ситуация                                | Результат                                       |
| --------------------------------------- | ----------------------------------------------- |
| Новый ключ                              | Создать статью/teaser и journal result атомарно |
| Автор, ключ и данные совпадают          | Вернуть исходный ID; новых записей нет          |
| Автор/ключ совпадают, данные отличаются | CONFLICT; ничего не менять                      |
| Параллельные одинаковые запросы         | SQL-lock сериализует; один результат            |
| Ошибка до commit                        | Полный rollback; тот же ключ можно повторить    |
| Ответ потерян после commit              | Тот же ключ возвращает исходный ID              |
| Позднее статья изменена/удалена         | Исходный ID; не откатить/не воскресить статью   |
| Нет текущего права                      | UNAUTHORIZED/FORBIDDEN до replay/status         |
| Журнал/БД отсутствуют или недоступны    | Generic INTERNAL_SERVER_ERROR, fail closed      |

SHA-256 fingerprint канонического принятого payload после текущих Zod trim/defaults,
без ключа; optional coverUrl → null, sortOrder → 0. Объектные ключи сортируются
рекурсивно, массивы sections/urls сохраняют порядок. Блоки хешируются ДО текущего
фильтра пустых блоков в storage: изменённый принятый payload означает конфликт.
Серверные время/ID не входят. Правила v1 закрепляются тестами, не меняются молча.

Конкурентный повтор ждёт SQL-lock в пределах существующего настроенного таймаута.
Timeout — generic INTERNAL_SERVER_ERROR и неизвестный результат попытки, не
разрешение заменить ключ или перехватить «зависшую» операцию. Проверить статус
либо повторить тот же ключ/payload. Существующий tRPC error envelope сохраняется.

## API: admin.articleCreationStatus — новый read-only query

Input: { idempotencyKey: string }, та же UUID-проверка. adminProcedure, только
ключ текущего автора. Не возвращать текст, URL, fingerprint или actorUserId.

```ts
type ArticleCreationStatus =
  | { status: "notRecorded" }
  | { status: "created"; articleId: number }
  | { status: "deleted"; articleId: number };
```

notRecorded — нет подтверждённой записи на момент чтения. Первый запрос может
ещё выполняться/закоммититься позднее: это НЕ доказательство несохранения и НЕ
разрешение создать с новым ключом. Query ничего не создаёт. created/deleted —
снимок текущего состояния, не запрет дальнейшего удаления. Некорректный journal
result/ошибка схемы/БД — INTERNAL_SERVER_ERROR, не notRecorded.

## Перезагрузка: граница ответственности

Серверная гарантия переживает перезапуск API и reload только при передаче прежнего
ключа. Фронтендер позднее должен сохранять ключ до запроса изолированно по аккаунту.
Для status достаточно ключа; для create replay нужны также те же данные. Новый
ключ или старый ключ с изменённым телом — не восстановление исходной операции.
Политика клиентского хранения текста/файлов, автоматическая запись и UX не входят
в этот срез. Без подключения клиента весь browser reload-сценарий не закрыт.

## Хранение и миграция

Предлагается отдельная article_creation_requests: requestKey (SHA-256 namespace/
actor/key, PK), actorUserId, payloadHash, articleId, createdAt. Unique no-op upsert
и current locking read не перезаписывают победителя. Журнал, статья и teaser —
одна SQL-транзакция. Успешная строка содержит articleId; пустой результат — ошибка.
Без каскадного удаления при удалении статьи и без TTL. Иначе поздний retry может
создать удалённый материал заново. Retention/account-deletion требует отдельной
review-процедуры; не расширять обещание бессрочного хранения персональных данных.

Номер миграции не выбирается до schema review. Additive migration, собственный
одноразовый backend_test loopback/tmpfs. Keyed create/status при отсутствующей
схеме fail closed; никакого auto-DDL/unkeyed fallback. Старый unkeyed путь прежний.
Откат кода сохраняет журнал. История 0017–0019/рабочий rollout — отдельные gates.

## Структура, стиль и проверка после согласования

Существующий TypeScript/NestJS/tRPC, Drizzle/MySQL, Vitest; новых dependencies нет.
Thin admin handler передаёт серверного автора в ContentWriteService. Hash/ledger/
transaction принадлежат content. Файлы: admin/router.ts, content/article-writes.ts,
новый content/article-creation-request.ts, db.ts, database schema/отдельная миграция.
Update/delete не получают новую replay-семантику. Фронт и generated artifacts
фронтенда не менять; contract handoff — отдельно с фронтендером.

RED/GREEN через настоящий HTTP/JWT/SQL: первый/replay, потеря ответа после commit,
restart с прежней SQL, concurrent calls, payload conflict, другой автор,
blocked/revoke, rollback teaser, replay после edit/delete, status во время
uncommitted create и отсутствующая/некорректная схема. SQL подтверждает одну
статью/teaser и отсутствие повторных побочных эффектов. Unkeyed number совместим.
Reload моделировать новым HTTP-клиентом с прежним ключом — НЕ browser acceptance.

Команды из корня репозитория (Node22 в PATH):

```sh
pnpm exec vitest run tests/nest-admin-articles.mysql.test.ts tests/article-write-consistency.mysql.test.ts --maxWorkers=1
pnpm exec vitest run --maxWorkers=2 --reporter=dot --silent
pnpm build
pnpm check:boundaries
pnpm check:docs
git diff --check
```

Native suites требуют BACKEND_TEST_DATABASE_URL собственного контейнера; skip
не считается приёмкой. Новый ledger suite и серверную проверку типов определить
при разбиении реализации; клиентские contract artifacts не обновлять самовольно.

## Границы и решение пользователя

Всегда: текущая авторизация до replay/status, atomic commit, concurrency/error
tests и малые проверенные коммиты. Сначала согласовать: контракт и новая таблица,
затем план реализации/schema review; rollout отдельно. Никогда: менять фронт,
рабочую БД/старые данные, push/deploy, внешние платежи/письма или угадывать дубли.

Приняты optional UUID key + прежний number; read-only status; отдельный журнал
без TTL с результатом после удаления. Рабочий rollout остаётся отдельным gate.
