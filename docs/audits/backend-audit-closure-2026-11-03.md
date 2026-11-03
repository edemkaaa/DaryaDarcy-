# Backend: оставшиеся P1–P3, продолжение 3 ноября

Исходный HEAD2453017a, чистая feature/stage-one-completion-2026-10-10.
Сверены исходная инструкция senior Nest/TypeScript, текущий план,
[карта модулей](backend-module-map-2026-11-03.md) и
[предыдущий срез](backend-architecture-followup-2026-11-03.md).
Изменения локальные, без frontend, рабочей БД/S3, аккаунтов, платежей,
внешних писем, push или выкладки.

## Конкретные находки и проверка до исправления

| Сценарий | Проблема и последствие | Проверка → ожидаемый результат |
| --- | --- | --- |
| Письмо после задержки worker | identity/access.ts проверял leaseId только при финальной записи. Задачу мог забрать другой worker, а прежний всё равно отправлял письмо. | Настоящий MySQL: после claim задержать чтение users, сменить/просрочить lease → send не происходит, чужое состояние не меняется. |
| Отмена подписки после задержки worker | billing/cancellation.ts имел такую же щель перед запросом к провайдеру. | Та же real-SQL barrier, без настоящего провайдера → нет запроса от старого владельца. |
| Пересоздание API-контейнера | edge.conf/edge.video.conf разрешали api hostname только при старте edge. Новый IP мог остаться невидимым. | Real Nginx + Docker DNS: заменить API, занять его старый IP → новый backend появляется без restart edge. |
| Несколько API в старом resource profile | Память считалась на один API, а TEST-ingress добавляет отдельный пул. Масштабирование может превысить RAM/max_connections. | Настоящий Compose merge + pure policy: две API-реплики/TEST учитываются, недостаточные бюджеты и несовпадающие secrets отвергаются без их вывода. |
| P3: шаблонный неиспользуемый код | Четыре AI/data helper и mysql-utf8 не имели consumers. Это не пользовательская ошибка, а необязательная чистка. | Tracked references/import graph, Nest registration, package exports и три entrypoints; затем типы/build/API и регрессия. |

Четыре SQL-регрессии до исправления дали send=1 вместо0; после исправления4/4.
Оба edge-сценария до исправления не увидели новую API-реплику; после —2/2.
Первичные ошибки окружения/фикстуры отделены от RED доказательства ниже.

## Сделано в коде

- Непосредственно перед SMTP/отменой проверяются текущий leaseId, срок lease
  по часам MySQL и актуальное терминальное состояние задачи. Срок claim также
  задаётся часами БД. Старый worker пропускает задачу, не затирая нового владельца.
- В двух edge templates появился dynamic API upstream с Docker resolver.
  Пути, payment запреты, HTTP-адаптер и правила доступа сохранены.
- Добавлены кандидат multi-api Compose и offline preflight. На двух API+TEST
  он считает три пула по10 плюс резерв10, то есть минимум40 соединений.
  Старый8GiB бюджет после scale2 отвергается. Ответ не содержит raw env/secrets
  и всегда говорит productionApproval=false.
- Удалены `_core/dataApi.ts`, `_core/imageGeneration.ts`, `_core/llm.ts`,
  `_core/voiceTranscription.ts`, `database/mysql-utf8.ts`: пять файлов/748 строк.
  Package backend private, публичных package exports нет; найдены только
  self-comments/историческая документация. Одноимённая локальная функция в
  tooling/data/backfill-feed-text-from-json.mjs не импортировала удалённый helper
  и сохранена. Migration/recovery/media helpers и используемые типы сохранены.
- Runtime/ORM/API DTO не менялись; новых пакетов/очередей нет. Действующие
  совместимые db/platform-db factories не удалялись.

## Решения по архитектуре, а не новые слои

**Пул остаётся process-owned.** В production каждый API — отдельный процесс с
одним пулом10. App factories заимствуют его, а executable закрывает после drain.
Создавать ещё один пул на NestModule/запрос ухудшило бы бюджет и управление
жизненным циклом. Замена на универсальный repository/DI wrapper пользы здесь
не доказала. Не считать осознанную process boundary незакрытой ошибкой.

**Совместимые фасады остаются переходной границей.** У SQL есть конкретные
feature-владельцы, eager runtime-цикл уже разорван. Удаление живых CLI/test/
standalone exports ради размера файла нарушило бы совместимость без результата.
Большой размер db.ts сам по себе не является дефектом поведения.

**Повторы внешней отправки.** Новая проверка закрывает подтверждённый stale-owner
случай ДО эффекта. Она не делает обычный SMTP exactly once: при принятом письме и
потерянном подтверждении локальная БД не узнает, доставлено ли оно. Durable outbox,
повторы и стабильный Message-ID платёжных писем сохранены. Если потребуется
строго исключить повтор после такого сбоя, нужен провайдер с идемпотентным API и
отдельный контракт; простая новая очередь этого не гарантирует. Публикационный
push остаётся best effort по решению владельца. Legacy email-binding и online
shop не включались; невыбранные отключённые пути не объявляются принятыми.

## Команды и фактические результаты

Node22.23.2, Nest12.1.2, tRPC11.8.0, Drizzle0.45.3/mysql2 3.24.5,
MySQL8.4/arm64, Vitest4.1.11. На своей tmpfs-БД применены51 настоящая миграция;
история/рабочие данные не ремонтировались. Контейнер удалён, tmpfs уничтожен.

| Команда/профиль | Результат |
| --- | --- |
| pnpm exec vitest run --project unit --maxWorkers=2 | 4055 passed/98 skipped; 316 passed/30 skipped files;100,50с;exit0 |
| pnpm exec vitest run --project mysql | 1570 passed/299 skipped;97 passed/22 skipped files;255,37с;exit0 |
| tests/worker-stale-lease.mysql.test.ts | RED4failed → GREEN4passed на реальном MySQL |
| API_EDGE_DOCKER_ACCEPTANCE=true … tests/api-replica-edge.test.ts | Финальный2/2,24,05с,exit0; Docker DNS/Nginx1.30.5, POST не повторён |
| API_MULTI_COMPOSE_ACCEPTANCE=true … tests/multi-api-compose.test.ts + tests/multi-api-policy.test.ts | 14/14,1,33с,exit0; реальные merge/CLI, только synthetic env |
| pnpm check | root/frontend TypeScript,exit0; frontend source не менялся |
| pnpm lint:backend / pnpm build / pnpm build:prodamus-test | exit0/exit0/exit0 |
| pnpm check:api | 107 процедур/46501 байт,exit0; контракт прежний |
| pnpm check:boundaries | 904 файла,exit0 |
| pnpm check:docs | 171 current documents,exit0 |

Наборы пересекаются, их нельзя суммировать как уникальные тесты.98 unit skip
включают четыре opt-in proxy/Compose сценария, выполненные отдельно.299 SQL skip
не выданы за успех: реальные S3/провайдеры/browser и прочие opt-in не приняты.
Изменены25 файлов:16 кода/тестов/infra (включая пять удалённых) и9 документов.
Коммиты:34e79acb (leases),8e8fac05 (edge),3b61fc6d (preflight),6b7a7228 (cleanup).

## Инструкция и использованные практики

Применены git-workflow, incremental-implementation, systematic-debugging,
test-driven-development, code-review, security-and-hardening, code-simplification
и verification-before-completion. Сначала смысловой RED, затем узкий фикс,
раздельные commits и реальная SQL/HTTP/proxy регрессия. Не вводились DDD/CQRS,
базовый repository, замена ORM, раннера или HTTP adapter.

Предыдущая [версионная сверка Nest и практик тестирования](backend-maintainability-2026-11-03.md)
сохранена: [Nest Modules](https://docs.nestjs.com/modules),
[Nest Testing](https://docs.nestjs.com/fundamentals/testing),
[пример именно12.1.2](https://github.com/nestjs/nest/blob/v12.1.2/sample/01-cats-app/src/cats/cats.controller.spec.ts),
[Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices),
[Testing Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices).
Использованы явные границы, настоящий NestFactory/HTTP и проверки эффектов/отказов;
Jest helpers из примера не переносились в Vitest. [Testcontainers](https://node.testcontainers.org/)
рассмотрен: сохранён существующий owner-checked MySQL/tmpfs harness, новый пакет
не нужен. Context7 уточнил Compose health/config; [NGINX upstream](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
и [proxy retry](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_next_upstream)
использованы для resolver и сохранения запрета non-idempotent retry.

## Окружение и точный остаток

Первый proxy-run был сорван нехваткой диска, затем исправлены проблемы самой
фикстуры (readonly copy/доступ к internal network). Эти ошибки не названы RED
приложения. Для воспроизведения дефекта использован последующий semantic RED.
Docker перезапущен; удалены255 старых trace.zip наших завершённых прогонов
(348,6MiB) и подтверждённо устаревший update cache build22943 при работающем23880
(около1,8GiB). Сохранены более новый pending update, скриншоты/отчёты, БД,
оригиналы, образы и чужие файлы. Повреждённый локальный Node container image не
удалялся; proxy transport fixtures используют исправный pinned Python image,
настоящие API-тесты — Node22 на хосте. Полная сборка API Docker image этим не принята.
Финальный системный Git потребовал лицензию обновлённого Xcode; использован
уже установленный CommandLineTools через DEVELOPER_DIR только для команд.
Глобальные настройки/лицензии не менялись, docs check затем прошёл.

Логи, cleanup manifests и коды — ../.local-artifacts/backend-audit-closure-20261103/:
baseline.log, stale-lease-red.log/stale-lease-green.log, edge-red-valid.log,
edge-final.log, compose-green.log, policy-final.log, unit.log, sql.log,
migration.log/sql-cleanup.json, types-final.log, lint.log, build.log,
build-test-ingress.log, api.log, boundaries.log, trace-cleanup.json,
obsolete-update-cache-cleanup.json.

**P1 ещё открыт на сервере:** нет read-only подтверждения его текущего состояния,
реальных лимитов/конфигурации и репетиции выпуска. Ничего не масштабировано,
0050 не применялась к рабочей БД. Готов [порядок DevOps](../operations/multi-api-release-preflight-2026-11-03.md).
Далее нужны доступ к серверу, проверенные ресурсы/native image build, бэкап/
preflight и согласованный выпуск. **P2/P3:** выбранные локальные дефекты исправлены,
удаление мёртвого кода закончено; pool/facades и граница SMTP явно описаны как
сохраняемые решения/ограничения, а не обещание незаметной переработки архитектуры.

**Весь аудит и договорная приёмка не объявляются завершёнными.** LIVE/SMTP/S3,
устройства, пилот и все невыбранные сценарии требуют своих доказательств.
