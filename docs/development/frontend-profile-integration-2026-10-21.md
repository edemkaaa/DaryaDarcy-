# Интеграция staging: профиль и оставшиеся API-подключения

## Актуализация: совместная интеграция21 октября

По новому прямому поручению три перечисленных ниже frontend остатка реализованы
локально: явный publicCover только в ветке обложки, generated API90 и runtime
cancellationStatus. Pending восстанавливается после перезагрузки, виден после
истечения доступа и не превращает служебный доступ в оплаченную подписку.
Проверка отмены читает статус, не повторяет запись; none после потерянного ответа
не считается подтверждённой отменой. Старые callbacks защищены account scope.
Дизайн/стили, оплата, роли, квоты и прежние серверные flags не менялись.

RED8 parser и RED2 actual React provider; cover RED1 на предыдущей сборке с
неизменённым producer. После fresh сборки37 parser/4 provider и64 Playwright
GREEN, включая reload/pending/expired/lost ACK/account switch/cover/saved.
Браузерные API ответы контролируемые; это не реальная отмена у провайдера или
upload в S3. Root3057 pass/1586 skips, types/lint/check:api/boundaries722/docs68,
audit0 и production build GREEN. Исторические сведения ниже сохранены.
Выпуск и живые проверки пока pending; точный receipt будет в operations/todo.

## Что подтянуто

Локально объединён `origin/staging` на `39e66a2` с нашей веткой на `5b7b26c`.
Merge commit — `798f079`, без конфликтов. Весь `apps/frontend` совпадает со
staging; ручных правок фронта, дизайна и generated contract не было.
Push/deploy не выполнялись, рабочая БД, S3 и существующие файлы не менялись.

Фронтендер добавил явное сохранение имени/анкеты вместо автоматической отправки
кэшированного профиля, account-scoped восстановление неизвестного результата,
отдельную загрузку аватара и обновление кэша статьи после изменений. Эти изменения
сохранены. После неизвестного сохранения клиент сверяет результат свежим
`GET /api/auth/me`, а не автоматически повторяет запись.

## Что исправлено на бэкенде

### `profile.update`

- Ответ прежний: `{success:true}`. Частичный patch сохраняет остальные поля,
  пустой patch остаётся no-op. Владелец только из сессии; присланные `userId`,
  `role`, `email` не дают дополнительных прав.
- Имя обрезается по краям и не может состоять только из пробелов.
- Имя и URL проверяются по существующему пределу SQL TEXT: максимум65535
  UTF-8 байт. Это не новый продуктовый лимит имени. Превышение даёт400 до SQL,
  а не500 от хранилища; многобайтовые строки проверяются по байтам.
- URL аватара — абсолютный HTTP(S). `javascript:`, `data:`, `file:` запрещены400.
  Это проверка контракта изображения, не утверждение о доказанном XSS или новая
  host allowlist. Загрузка через `profile.uploadAvatar` прежняя.

Текущие формы фронта уже отправляют `name.trim()`. Новым потребителям нужно
сравнивать нормализованное имя при восстановлении, а не пробелы исходного ввода.
Не переотправлять старые поля профиля вместе с новым аватаром.

### Публичный пользователь

`auth.me` использует тот же явный DTO, что REST `/api/auth/me`: `id`, `openId`,
`name`, `email`, `phone`, `loginMethod`, `gender`, `avatarUrl`, `lastSignedIn`,
`role`. `lastSignedIn` — ISO string. Гость остаётся `null` в tRPC и `{user:null}`
в REST. REST envelope не менялся.

Внутренние `sessionVersion`, причины блокировки, маркер удаления и SQL timestamps
больше не выходят через tRPC. Новые колонки не попадают в DTO автоматически.
Правила ролей, входа, отзыва сессий и обработки сбоев не менялись. Новый frontend
использует REST `getMe` и уже совместим с этой формой ответа.

## Фронтендеру: что ещё не вошло в `39e66a2`

1. В `articles-admin.tsx` публичная обложка вызывает `admin.uploadPhoto` без
   обязательного `purpose:"publicCover"`. Добавить поле только в этой ветке;
   закрытые вложения не переводить на публичный fallback. Подробнее:
   [upload handoff](frontend-security-upload-contract-2026-10-21.md).
2. Контроллер отмены и `parseClubAccess` ещё не используют `cancellationStatus`.
   Показывать `pending` как сохранённое ожидание, не как подтверждённое отключение
   автосписания; восстанавливать его после reload. Подробнее:
   [cancellation handoff](subscription-cancellation-contract-2026-10-21.md).
3. Обновить generated API через `pnpm api:contract` на согласованном backend.
   `check:api` сейчас ожидаемо RED: обязательный purpose, поля отмены и DTO
   `auth.me`. Не подавлять проверку и не возвращать небезопасные старые ответы.
   Одной генерации недостаточно — runtime parser/controller тоже должны читать
   статус отмены.

Новый дизайн, новая регистрация и новый API профиля не нужны. После совместного
подключения повторить браузерные сценарии сохранения/аватара/смены аккаунта;
в этом backend-срезе браузерная и мобильная приёмка не запускались.

## Доказательства и ограничения

- RED9 на настоящем локальном HTTP, затем112 focused tests GREEN. Быстрая серия
  заменяет SQL/session boundaries и не выдаётся за сквозную приёмку.
- Собственная loopback/tmpfs `backend_test`,42 настоящие миграции:26/26
  HTTP/JWT/MySQL tests GREEN (25 profile +1 registration/subscription flow).
  Проверены UTF-8 границы,400 без записи, partial/replay/no-op, fresh REST read
  после намеренно отброшенного клиентом успешного ответа, равенство DTO и
  неизменность другого аккаунта. Потеря ACK инъецирована после завершения API;
  это не физический обрыв сети посреди транзакции.
- Контейнер удалён по ID/name/label/image/mount/loopback guards. Три прежних
  stopped containers, images/volumes сохранены. Evidence вне Git:
  workspace `.local-artifacts/profile-integration-20261021.HtuvyI`.
- Финальный Vitest3025 pass/1559 opt-in skips,219 passed files/102 skipped.
  Root types/backend build GREEN. Artifact-only API generation90 procedures/
  35402 bytes без записи во frontend. Пропущенные DB/S3/browser checks не
  считаются внешней приёмкой. S3 и настоящий аватарный upload здесь не проверялись.
- На момент profile-среза9a15836 из validation-аудита были закрыты только профиль
  и публичный DTO. Следующий срез по датам, sortOrder и пустым постам описан ниже.
  Memory/rollout/legacy-файловые gates остаются в активном плане.
- Review: новых зависимостей, миграций, SQL queries, флагов или auth policy нет.
  Boundaries720/docs68/формат scoped code/diff GREEN. Историческая ссылка на
  удалённый фронтендером sync-profile исправлена без переписывания старого аудита.
  `check:api` отдельно запущен и остаётся RED по описанным трём отличиям.

## Следующий backend-срез: валидация контента,21 октября

После отдельного поручения исследован оставшийся validation-остаток. Причины:
даты принимались как произвольные строки перед `new Date`, sortOrder — любой
number перед SQL INT, а непустая сырая строка могла превратиться в пустую после
санитизации. Исправления локальные; frontend/рабочая БД/S3 и выпуск не менялись.

### Даты и порядок

- `admin.createPost/updatePost`: scheduledAt/publishedAt проверяются до записи.
  Невозможная календарная дата, непонятная строка и дата вне существующего MySQL
  TIMESTAMP диапазона возвращают400, а не500 от SQL. Диапазон UTC:
  1970-01-01T00:00:01Z — 2038-01-19T03:14:07Z. Это ограничение существующей
  схемы, не новый срок хранения материалов.
- Сохранены ISO datetime с UTC/offset, date-only и прежний local SQL datetime.
  Для local-строк остаётся прежнее поведение runtime timezone; новый фронт уже
  отправляет ISO. `null` и пустая строка по-прежнему очищают дату, omission не
  меняет поле. Новых требований к расписанию/status в этом срезе не добавлено.
- `admin.createPost/updatePost/createArticle/updateArticle`: sortOrder только
  целый signed SQL INT, от-2147483648 до2147483647 включительно. Отрицательные
  приоритеты и default0 сохраняются, дробь не округляется молча в БД.
- Значения не переписываются при валидации: hash исходного принятого намерения
  создания и повтор с прежним idempotencyKey остаются прежними.

### Пустой пост и публикации только с медиа

Фронт обоих редакторов допускает пост только с медиа и отправляет text=" ".
Поэтому правило не стало запретом пустого текста: после санитизации у нового
или редактируемого тела должен оставаться текст, непустая ссылка фото либо
сохранённое видео/аудио/документ.

Проверка выполняется в существующей транзакции create/update после привязки/
удаления медиа. Если итог пустой,400 откатывает материал, изменения вложений и
новый creation receipt. Никакого S3 DELETE или повторной загрузки не выполняется.
При partial edit учитываются существующие фото/медиа, а не только новый запрос.
Удаление последнего фото/видео/файла допускается, если остаётся другое содержимое
или оно добавлено в том же сохранении.

Metadata-only правки уже пустых legacy-постов намеренно не блокируются; старые
строки не исправляются массово. Это проверка create/update, а не утверждение,
что исторические данные или самостоятельные legacy deleteMedia/system helpers
теперь навсегда обеспечивают глобальную непустоту каждого материала. В текущем
frontend вызовов standalone deleteMedia не найдено, его прежний контракт здесь
не менялся.

### Проверки среза

- RED14 HTTP boundary tests → GREEN64 с регрессией публикации/import. В быстрой
  серии подменены только identity/persistence boundaries; не SQL acceptance.
- Собственная loopback/tmpfs backend_test/fresh42: сначала16 pass/5 RED на
  реальных пустых create/update и удалении последнего вложения. После проверки
  итогового тела160/160 в5 SQL suites: validation21, manual publication52,
  article CRUD38, post idempotency39, video reconciliation10.
- Дополнительная final серия94/94 в4 suites: validation25 (включая INT bounds,
  пустые ссылки и metadata-only legacy edit), private attachments37, private
  videos27, posters5. AWS SDK здесь работает только с loopback transport, не с
  настоящим S3; это не provider ACL/реальная max-size приёмка.
- Все3 своих контейнера удалены по ownership/loopback/tmpfs guards; прежние3
  stopped containers, images/volumes сохранены. Evidence вне Git:
  workspace `.local-artifacts/content-validation-20261021.8sTZyZ` с red/green/final
  logs и cleaned receipts. Нет платежей, внешних писем или push-доставки.
- Artifact-only API generation90/35402 bytes byte-identical предыдущему срезу:
  новых wire types нет, generated frontend не менялся. Предыдущие3 frontend
  задачи из этого документа и ожидаемый check:api RED остаются.
- Final Vitest3049 pass/1584 opt-in skips,220 passed files/103 skipped,40.11s.
  Root types/backend build, формат новых/scoped файлов, boundaries722/docs68/
  diff GREEN. Review: схема/зависимости/флаги/auth/квоты прежние; существующие
  write transactions сохранены, существование media проверяется bounded query
  только при отсутствии непустого текста и фото. Никакого дополнительного
  запроса на каждую карточку каталога или внешнего storage call не добавлено.
