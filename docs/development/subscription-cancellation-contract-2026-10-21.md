# Отмена подписки: pending/confirmed и инструкция фронтендеру

## Статус и границы

21 октября исправление проверено локально. Стенд, frontend/generated contract,
рабочая БД, S3 и настройки оплаты не менялись, push/deploy не выполнялись.
Не было настоящих платежей, отмены настоящего автосписания, внешних писем или
обращений к Prodamus. Новых функций оплаты, флагов и миграций не добавлено.

## Что исправлено

Раньше `requestClubCancellation` сохранял запрос в `billing_profiles`, но
`ClubSubscriptionService.cancel` выбрасывал INTERNAL_SERVER_ERROR при
`confirmed=false`. Общий formatter правильно скрывал внутреннюю ошибку, вместе
с ней терялось пояснение о сохранённом запросе. Formatter не ослаблен: ожидание
теперь является штатным результатом, не исключением.

### `club.cancel`

Защищённая mutation без нового входа; владелец только из проверенной сессии.
После сохранения запроса ответ200:

```ts
{
  ok: true,
  cancellationStatus: "pending", // либо "confirmed"
  expiresAt: Date | null,
  message: string
}
```

`ok: true` означает, что запрос принят, а не что автосписание выключено.
`pending` прямо сообщает: запрос сохранён, провайдер пока не подтвердил отмену,
попытка будет повторена, автосписание до подтверждения может оставаться активным.
`confirmed` означает подтверждённую отмену по прежним правилам бэкенда, включая
проверенные случаи без будущих списаний. Оплаченный период не укорачивается.

Ошибка отсутствующей/неопределимой подписки остаётся ошибкой, а не `pending`.
Отсутствие БД/ошибка чтения не превращаются в успешное подтверждение. Прежнее
преобразование исключений durable request helper в безопасный BAD_REQUEST
не менялось; классификация таких исключений не расширялась этой задачей.
401/403 и скрытие SQL/provider details сохранены.

### `club.subscription`

Добавлено `cancellationStatus: "none" | "pending" | "confirmed"`:

- `none`: в текущем снимке нет ожидающего запроса и нет подтверждённой отмены
  действующей оплаченной подписки. Гость/заблокированный контекст тоже получает
  `none`, без чтения чужого журнала.
- `pending`: у текущего аккаунта есть сохранённый запрос для ещё не отменённого
  billing profile. Видно после reload/потери ответа и даже при истёкшем доступе.
- `confirmed`: нет ожидающих профилей и прежний флаг оплаченной подписки
  `cancelAtPeriodEnd=true` подтверждает завершённую отмену.

`hasClubAccess`, `subscribed`, owner/staff semantics, оплаченный срок и смысл
`cancelAtPeriodEnd` не менялись. В обычном ожидании последний остаётся false,
после подтверждения всех профилей становится true. Частичное подтверждение не
выдаётся за полную отмену. Профили/ID провайдера/email наружу не добавлены.

Чтение оплаченного состояния и pending-marker идёт в одном read-only
REPEATABLE READ snapshot. Иначе worker мог подтвердить отмену между двумя
SELECT, и API возвращал ложный `none`. Read endpoint не ставит запросы,
не запускает worker/провайдера и не меняет даты/счётчики. Pending lookup bounded
`LIMIT 1` и использует существующую область `userId`; миграция не нужна.

## Фронтендеру — что подключить без изменения дизайна

В [контроллере отмены](../../apps/frontend/src/features/profile/use-subscription-cancellation.tsx)
после ответа проверять `cancellationStatus`, а не только `ok`.
При pending показывать сохранённое ожидание и пояснение; не писать «автосписание
отменено» до confirmed. При чтении подписки восстанавливать pending после
reload, а не хранить ожидание только в памяти React.

Не очищать неизвестный результат только из-за таймаута/500/abort. Сначала
перечитать `club.subscription` в текущем account scope. `none` при гонке с ещё
выполняющимся POST не доказывает, что тот никогда не завершится: не запускать
автоматический цикл mutation. Проверка статуса — только read; смена аккаунта/
размонтирование по-прежнему должны отменять/игнорировать прежние callbacks.

Обновить [парсер доступа](../../apps/frontend/src/shared/api/club-access.ts),
subscription context и generated API на согласованной версии бэкенда.
В этом изменении frontend не редактировался. `check:api` ожидаемо RED: помимо
прежнего purpose=publicCover добавлены поля отмены в двух ответах. Не обходить
contract check и не менять только типы, забывая runtime parser/controller.

## Доказательства и ограничения

- RED3: service и реальный HTTP воспроизвели pending→500 и отсутствие статуса
  чтения; GREEN32 focused service/HTTP/composition после изменения.
- Собственные tmpfs backend_test,42 миграции: сначала fixture исправлен с2099
  на2030 из-за MySQL TIMESTAMP range (это не product RED). Затем7/8 новых
  native HTTP/JWT/SQL/loopback-provider cases прошли, race-case получил `none`.
  После read-snapshot исправления final93/93 в6 suites GREEN:8 новых cases,
  durable cancellation, registration/SMTP, webhook, settlement и test checkout.
- Подтверждены provider503/обрыв, потеря client response после завершённого API,
  повтор без нового provider call/дублей/переноса backoff, fresh read-only status,
  worker confirmation, partial profiles, другой аккаунт/гость, истечение и гонка.
- Все3 созданных контейнера убраны по ID/name/label/image/mount/loopback guards;
 3 прежних stopped containers, images/volumes/рабочие данные сохранены. Evidence
  вне Git: workspace `.local-artifacts/cancellation-status-20261021.CnqkWE`.
- Это не live/browser-приёмка и не подтверждение отмены реального Prodamus.
  Обновление клиента и совместная проверка после отдельного выпуска ещё нужны.
