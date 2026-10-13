# Spec: восстановление обычного checkout — AG6/P2

## Статус и объём — Proposed, 14 октября 2026

Пользователь поручил продолжить AG6 после предложения конкретизировать контракт.
Подготовлен первый обозримый срез; это не принятие новой схемы/API или включение
реальных платежей. Реализация начинается после решения по этому контракту.

Цель: вошедший пользователь после потери ответа/reload получает тот же pending
заказ либо подтверждённый результат именно этой покупки. Retry одного намерения
не создаёт второй club_payments. Это защита создания заказов, не гарантия отсутствия
повторного списания со стороны провайдера при повторном открытии платёжной ссылки.

Первый срез — обычный Prodamus checkout авторизованного существующего аккаунта
с валидным email, monthly/semiannual по нынешним правилам. Гостевой checkout остаётся
прежним без новой гарантии recovery: его proof/status требует отдельного решения.
Фронт, TEST-пути, цены/сроки/recurrence/методы оплаты и settlement не меняются.
Весь сценарий первой оплаты гостем этим срезом не закрывается.

Основание: AG6/P2 в [плане](tasks/plan.md), текущие club-checkout.service.ts,
prodamus.ts, club/router.ts, billing/cancellation.ts и schema club_payments/
billing_receipts. Обычный createCheckout сейчас генерирует random orderId на
каждый вызов; TEST header key намеренно отклоняется. Нового native RED пока нет.

## Новый additive API, прежний API сохраняется

Предлагаются две protected tRPC-процедуры через существующую живую сессию.
Никакой новой регистрации, роли или гостевого токена.

```ts
type NormalCheckoutInput = {
  idempotencyKey: string; // strict lowercase UUID v4, один на намерение
  plan?: "monthly" | "semiannual"; // default monthly
};
type NormalCheckoutStatus =
  | { state: "notRecorded" }
  | { state: "pending"; orderId: string }
  | { state: "succeeded"; orderId: string; expiresAt: Date }
  | { state: "failed"; orderId: string };
type NormalCheckoutResult =
  | { state: "pending"; orderId: string; url: string }
  | { state: "succeeded"; orderId: string; expiresAt: Date }
  | { state: "failed"; orderId: string };
// Proposed names; not registered in the current router:
// club.createNormalCheckout: mutation NormalCheckoutInput -> NormalCheckoutResult
// club.normalCheckoutStatus: query {idempotencyKey:string} -> NormalCheckoutStatus
```

Email/actor/price/merchant не принимаются от клиента. Автор и текущая canonical
почта определяются сервером. Отсутствующий/blocked/revoked actor отклоняется до
чтения чужого intent или записи. Истёкшая подписка не запрещает собственную покупку;
служебный доступ не является доказательством оплаты.

Перед первым запросом клиент сохраняет ключ и plan отдельно по аккаунту.
После timeout/reload использует тот же key/plan, не генерирует UUID автоматически.
Статус не возвращает ссылку/почту/receipt/hash. `notRecorded` означает отсутствие
committed результата на момент чтения: первый запрос ещё может завершиться.
Проверка GET сама ничего не создаёт и не подтверждает оплату.

Намеренная новая покупка получает новый ключ только явным действием пользователя.
Смена plan с прежним ключом — CONFLICT. Новая почта того же аккаунта после создания
intent — CONFLICT, не перенос заказа/идентичности. Другой actor с тем же raw key
имеет отдельный namespace и не читает результат прежнего пользователя.

## Операция и результат

| Ситуация                                     | Поведение                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Первый key/actor/plan                        | Один ledger + один pending order атомарно, ответ после commit                  |
| Retry/restart/reload                         | Тот же order; pending возвращает исходную ссылку при неизменной конфигурации   |
| Параллельные одинаковые calls                | User/unique ledger locks, одна операция; duplicate ждёт в existing SQL timeout |
| Тот же key, другой plan/email                | CONFLICT, без нового заказа                                                    |
| Сбой до commit                               | Полный rollback; тот же key можно повторить                                    |
| Потеря ответа после commit                   | Status/replay находит тот же order; новый не создаётся                         |
| Заказ подтверждён                            | succeeded по этому order, без выдачи payment URL                               |
| Заказ failed                                 | failed по этому order; автоматической новой покупки нет                        |
| Уже оплачена другая покупка                  | Её подписка не переводит этот intent в succeeded                               |
| Ledger есть, order отсутствует/не согласован | INTERNAL_SERVER_ERROR, не notRecorded и не пересоздание                        |
| Нет схемы/БД                                 | Fail closed, без auto-DDL/unkeyed fallback                                     |

`succeeded` требует согласованных userId/orderId/amount между ledger, paid
club_payments и canonical billing_receipts существующего settlement. Paid row
без matching receipt либо несовместимые поля — ошибка целостности, не успешная
оплата. Existing receipts не хранят отдельно валюту/domain: не придумывать эти
поля в query и не объявлять дополнительную проверку подписи; её уже выполняет
settlement перед созданием receipt. Сохранить эту границу.

expiresAt берётся из конкретного paid order, не MAX срока по аккаунту. succeeded
остаётся историческим результатом и после истечения; актуальное право читать клуб
определяет club.subscription. Создание/status не выдаёт срок, сессию, письмо,
password token или доступ. Cancel/renewal webhook и worker остаются прежними.

## Модель хранения и воспроизведение ссылки

Предлагается отдельный минимальный normal checkout ledger, не приспосабливать
TEST billing_checkout_intents с обязательными shop/provider/lease полями.
Новая additive миграция получает следующий свободный номер после schema review;
номер пока не зарезервирован и файл не создан. InnoDB/PK(requestKey) обязательны.

Минимальные поля: requestKey SHA256(namespace/actor/key), actorUserId, requestHash
(v1 canonical plan/email), orderId, amountMinor, merchantDomain, checkoutUrlHash,
createdAt. OrderId unique, сохранённый в существующем формате club-/club6m-.
Ledger и pending club_payments записываются одной транзакцией. Actor row current
lock первый, затем ledger/order по согласованному со settlement порядку; не
check-then-insert. При отсутствии полного результата чужую/«зависшую» claim не
перехватывать. Таймаут означает неизвестный результат, не новую операцию.

Подписанная ссылка создаётся существующим buildCheckoutUrl с серверными данными.
Сохраняется её SHA256, не URL с email/signature и не merchant secret. Replay
pending строит кандидат с тем же order/email/plan и сравнивает exact URL hash,
сумму/domain с сохранёнными. Если price/secret/subscription/app URL/config поменялись,
кандидат отличается: PRECONDITION_FAILED, order/ledger сохраняются; новая ссылка
или заказ автоматически не выдаются. Read-only статус прежнего order доступен.
Отдельная цена/подпись для нового намерения допустима по нынешним настройкам.

Успешные ledger rows не удаляются при удалении заказа/rollback клиента и не имеют
автоматического TTL в первом срезе. Retention/account deletion/export/backup требуют
решения до working rollout, как AR ledger. Нет новых внешних запросов при создании:
формируется ссылка, провайдерская оплата выполняется вне этого server transaction.

## Совместимость, флаг и ошибки

Прежние club.createCheckout/reconcileCheckout/claimPending и TEST header guard
остаются неизменными. Новый create не принимает TEST idempotency-key header и
отказывается работать при активном/некорректном TEST mode, без provider fallback.
Normal status читает только normal namespace, не выполняет запрос к провайдеру.

Предлагаемый default-off флаг `NORMAL_CHECKOUT_RECOVERY_ENABLED` закрывает новые
методы до side effects. Флаг не включает guest recovery/реальные платежи и не
переключает существующего клиента автоматически. При выключенном флаге или
недопустимом mode/config — PRECONDITION_FAILED; validation — BAD_REQUEST;
auth/block — прежние UNAUTHORIZED/FORBIDDEN; payload reuse — CONFLICT;
SQL/corrupt ledger — generic INTERNAL_SERVER_ERROR. Существующий tRPC envelope.
Ответы/ошибки не кэшировать публично; key/URL/signature/email в логах не писать.
Роли/CORS/proxy trust/квоты не меняются; новых сторонних зависимостей нет.

## План реализации после принятия

AG6a: native RED duplicate/concurrent/rollback/lost ACK → ledger/keyed creation.
AG6b: native status/order-specific proof/restart/expired/blocked/revoked/config
drift/missing schema и TEST isolation → read-only status и guards. Small slices
в billing/router/schema/affected tests; фронт и его generated contract не менять.
AG6c: передача типов/ключа/recovery фронтендеру, retained preflight/rollout gates.
Реальная оплата/автосписание/SBP/карты/почта не входят в локальную verification.

Существующие pnpm/Node22, TypeScript/NestJS/tRPC, Drizzle/MySQL и Vitest. Match
owning services и existing transactions; positive result после committed writes:

```ts
const result = await database.transaction(async (tx) => {
  // Recheck actor and atomically claim original intent; no provider payment here.
  return createOrReplayNormalOrder(tx, actorId, acceptedInput);
});
return result;
```

После реализации команды из repo; SQL только own loopback/tmpfs backend_test:

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec vitest run tests/normal-checkout-recovery.mysql.test.ts --maxWorkers=1
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm build
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:boundaries
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:docs
git diff --check
```

Новый test file ещё не создан: первая команда для будущего среза, не текущий pass.
Native tests требуют явного BACKEND_TEST_DATABASE_URL собственной БД; отсутствие
переменной/skip не доказывает работу. В fixtures только synthetic merchant config/
SQL receipt, внешнего payform/платежа нет. Проверять единственный order/ledger,
identity/password/session/paid expiry неизменны до settlement; не только UI notice.

Always: auth-before-effect, atomic claim, payload conflict, finite SQL wait,
no logging sensitive data, review и свежая verification. До начала кода принять
первый authenticated scope, новые две процедуры и ledger/schema. Never: frontend,
реальный provider payment/mail/working DB, TEST fallback, изменение цены/recurrence,
TTL/исправление старых данных, push/deploy/автоматическое включение.

## Решение, которое требуется

Принять первый срез только для вошедших аккаунтов: отдельные normal create/status,
минимальный ledger, точный replay/отказ при config drift, guest checkout прежний.
Это разрешает последующую локальную backend реализацию/тестовую миграцию после
schema review; не разрешает working rollout. Гостевой proof/первую оплату и frontend
integration согласовывать отдельно. До решения документ остаётся Proposed.
