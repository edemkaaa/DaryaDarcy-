# Отдельные CI-профили checkout

30 октября 2026. Дополнение к существующим verify jobs, без изменения frontend
source, API-контракта, рабочего сервера, БД, S3 или платёжных настроек.

**Уточнение после публикации:** свежая read-only проверка GitLab 30 октября
подтвердила выключенный CI/CD и отсутствие проектных runners; общий/групповой
также выключены. Pipeline/jobs дают 403, поэтому настоящий удалённый прогон
не принят. [Результат и действия DevOps](gitlab-ci-gate-2026-10-30.md).
Локальные результаты ниже сохраняются с прежними границами.

## Зачем

`NEXT_PUBLIC_*` в Next фиксируются при build. Один build:web с флагами по умолчанию
не проверяет opt-in TEST/guest/NORMAL интерфейс. `test.skip` может дать успешный
процесс без приёмки нужной ветки. Поэтому добавлены отдельные matrix jobs
checkout-browser в GitLab и GitHub, каждый со своим checkout/workspace и build.
Общий verify/SQL и его browser regression остаются прежними; ошибки общего
набора не скрываются, allow_failure/continue-on-error не добавлены.

## Профили

| Профиль       | TEST  | NORMAL recovery | Guest recovery | Что запускается                                                                         |
| ------------- | ----- | --------------- | -------------- | --------------------------------------------------------------------------------------- |
| prodamus-test | true  | true            | true           | prodamus-return.spec.ts и guest-contact-fields.spec.ts                                  |
| guest-normal  | false | true            | true           | playwright.guest-checkout.config.ts: guest-checkout-recovery и normal-checkout-recovery |

CLUB_TEST_CHECKOUT=false в обоих; VK/обложки/private-library public flags=false
для минимального checkout-набора. TEST с guest=true намеренно проверяет
приоритет TEST: создание не должно уйти в гостевой LIVE endpoint.
Это тестовые сборки, не профиль выпуска рабочего сайта.

## Запуск

Из корня отдельной копии проекта с установленными locked dependencies и Chromium:

```sh
node tooling/scripts/check-checkout-browser.mjs prodamus-test
node tooling/scripts/check-checkout-browser.mjs guest-normal
```

Команды выполняют build:web и настоящий Playwright. Они пересобирают .next в
каталоге выполнения; локально использовать отдельный checkout/архив, не запускать
оба профиля параллельно в одной папке. CI запускает их в разных jobs.
В этом срезе локальная проверка выполнена в своей копии Git-снимка с symlink
на прежние dependencies; текущая .next основного checkout сохранена по SHA.

Runner явно очищает DATABASE_URL/BACKEND_TEST_DATABASE_URL/API_PROXY_TARGET и
NEXT_PUBLIC_API_BASE_URL. API/платёжные ответы synthetic, backend/SMTP/SQL/S3
для этих jobs не нужны. CI=true запрещает Playwright незаметно переиспользовать
уже работающий локальный Next другого профиля. Runtime флаги сайта не меняются.

## Отказ вместо ложного успеха

Неподдерживаемый профиль отклоняется до запуска команд. Ошибка build прекращает
последующие шаги; ненулевой browser exit сохраняется. JSON report обязателен;
в каждом нужном spec должны быть реальные passed tests. Unexpected/flake и
необъяснённый skipped дают отказ, даже если дочерний процесс вернул 0.

Разрешён ровно один legacy skip, только в guest-normal:
`guests keep the existing checkout even when the NORMAL integration build is enabled`.
Он проверяет старый guest checkout, который несовместим с включённым новым guest
режимом; новый guest отдельно принят собственными 18 сценариями. В TEST skips нет.
Пропуск всего файла или набора не может пройти этот guard.

JSON reports имеют уникальный путь apps/frontend/test-results/checkout-<profile>-<uuid>/report.json.
CI сохраняет test-results на 7 дней и при ошибке. В GitHub artifact name содержит
matrix profile; jobs не отменяют друг друга после первого отказа. Отчёты содержат
синтетические тестовые данные, реальные секреты/покупатели не используются.

## Что проверено

- RED: до runner 5 отказов / 5 pass guard-tests; после 10 pass. Проверяются оба профиля,
  чистые DB/proxy env, очередность, ошибки build/browser, missing report,
  все-skipped/пропавший spec/чужой skip и единственное разрешённое исключение.
- Вместе с SQL preflight/scheduling и staging smoke: 41 unit pass, без SQL подключения.
- Настоящие production builds в своей копии: оба построились. TEST 16 pass/0 skip,
  guest/NORMAL 32 pass/1 предусмотренный skip; JSON guard принял оба,0 unexpected/flake.
- Обе YAML matrices разобраны; по 2 профиля, SQL services только у прежнего verify,
  ошибки новых jobs обязательны, artifacts сохраняются при отказе.
- Основной BUILD_ID/required-server-files/build-manifest/routes-manifest совпали
  по SHA до/после. Своя копия source/.next и symlink dependencies удалены;
  логи и 2 JSON reports сохранены вне Git в .local-artifacts/ci-checkout-20261030-01ac3c5f.

Финальные проверки: полный unit 3677 pass/78 skip, root tsc, API 105,
boundaries 854,135 документов и формат изменённых CI/tool/test прошли.
SQL 1511 из предыдущего среза не повторялся: SQL/runtime здесь не менялись.

Настоящий удалённый pipeline не запускался и не подтверждён: нового push нет,
ранее GitLab API давал 403. Три известные ошибки fixtures редакторов остаются
во frontend handoff и в общем browser regression, этот job их не «исправляет».
Полная native Docker-сборка DevOps, LIVE Prodamus/письмо и внешняя приёмка
не закрываются тестами синтетических checkout-сценариев.

## Основания

- [GitLab parallel matrix](https://docs.gitlab.com/ci/jobs/job_control/).
- [GitHub matrix](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs).
- [GitLab pipeline](../../.gitlab-ci.yml), [GitHub workflow](../../.github/workflows/ci.yml).
