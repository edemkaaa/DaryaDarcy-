# Отдельный runner для проверок Daryadarcy

Пакет предназначен только для отдельного Linux amd64 CI-хоста. Не запускать
на действующем сервере приложения или на Mac с почти заполненным диском.
Не содержит deployment jobs, рабочих реквизитов или миграции рабочей БД.

## Текущее состояние

30 октября: GitLab 19.5.0. Существующий Git-доступ имеет `read_api`,
`read_repository`, `write_repository`; для изменения настроек API вернул
403 `insufficient_scope`. Ни CI/CD, ни runners этим ключом не изменены.
Открыта вкладка входа в GitLab; ожидаются пользовательская сессия и CI-хост.
Этот пакет пока не установлен и не является подтверждением рабочего runner.

## Машина

Стартовый профиль для проверки: 4 vCPU, 8 ГиБ RAM, 40 ГиБ SSD, Docker Engine
и Compose plugin. Это конфигурация для первого прогона, не измеренная ёмкость.
Задачи выполняются по одной: job до 4 ГиБ, единственный MySQL service до
2 ГиБ, manager до 256 МиБ. После первого прогона проверить память, диск,
время и отсутствие OOM; лимиты рабочего приложения не меняются.

Исходящий HTTPS нужен для GitLab, Docker registry, pnpm/npm и установки
Playwright. Входящие порты для runner открывать не требуется. На машине
не должно быть production env, резервных копий или иных проектов.

## Настройки GitLab

1. В `team/daryadarcy` включить CI/CD, видимость результатов только участникам
   проекта (`builds_access_level=private`). Остальные возможности не менять.
2. Создать **проектный** runner `daryadarcy-staging-ci`: привязать только к
   этому проекту, включить Run untagged jobs, не назначать другие проекты.
   Он должен принимать staging. Не изменять защиту ветки ради runner;
   Protected включать только если все целевые refs действительно protected.
3. Использовать новый runner authentication token `glrt-…`, не старый общий
   registration token и не пользовательский API-токен. Не добавлять его в
   репозиторий, переписку или CI variables. Общие runners включать не требуется.

## Конфигурация на выделенной машине

Создать новый закрытый каталог `/etc/daryadarcy-ci/runner` (root, 0700).
Положить туда копию `config.toml.example` под именем `config.toml`, заменить
placeholder токеном проектного runner через закрытый редактор. Права файла 0600.
Не перезаписывать существующий config другого runner и не выводить файл в лог.

Токен связывает manager с уже созданным runner; при первом запуске manager
создаёт system ID в этом же каталоге. Проверить его появление и регистрацию
manager в GitLab. Если GitLab требует повторной регистрации, использовать
интерактивный `gitlab-runner register` с тем же authentication token, сохранив
закрытую копию config и восстановив настройки executor из примера. Нельзя
подменять токен общим legacy registration token или создавать дубли вслепую.

Оставить `concurrent=1`, `limit=1`, Docker executor, `privileged=false`,
`services_privileged=false`. Job-контейнеры не получают Docker socket, host
directories, SSH-ключи или рабочие env. Socket доступен самому manager:
это контроль Docker на выделенной машине, а не полная изоляция от её владельца.
TOML `volumes=[]` и `disable_cache=true` не создают общий кеш между jobs.

Из корня этого репозитория на выделенном CI-хосте:

```sh
export RUNNER_CONFIG_DIR=/etc/daryadarcy-ci/runner
docker compose -f infrastructure/ci/gitlab-runner/compose.yaml config --quiet
docker compose -f infrastructure/ci/gitlab-runner/compose.yaml up -d
docker compose -f infrastructure/ci/gitlab-runner/compose.yaml ps
```

`up` запускает только runner, не приложение и не рабочую БД. Образ manager
зафиксирован по версии и digest; manifest 19.5.0 проверен без pull на Mac.
Настройки runner и его токен остаются на CI-хосте вне Git.

## Приёмка

1. В GitLab runner Online, не Paused; manager Linux/amd64, Run untagged включён.
   Убедиться, что у проекта и группы нет production переменных, доступных этим
   jobs. Не копировать рабочие секреты для прохождения проверок.
2. Выполнить CI lint для **staging**, проверить состав: `verify` и две ветки
   `checkout-browser`. Никаких deploy/environment jobs в согласованном YAML нет.
3. Запустить pipeline нужного SHA staging. Зафиксировать pipeline URL и SHA.
   Проверить, что jobs исполняются именно на этом runner, а MySQL доступен
   только как одноразовый service `backend-mysql` с базой `backend_test`.
4. Дождаться реальных результатов всех трёх jobs и JSON artifacts checkout.
   Pending/Skipped/ручной job без запуска не являются успехом. Проверить OOM,
   память и диск CI-хоста. Известные ошибки frontend fixtures не скрывать.
5. После следующего согласованного push в staging подтвердить автоматическое
   создание нового pipeline. Ручной запуск не доказывает push-trigger отдельно.

Runner не выполняет полную сборку production Docker images: это отдельный
[пакет DevOps](../../deploy/teamassist/README.build.md).
Профили checkout: [описание CI](../../../docs/operations/checkout-browser-ci-2026-10-30.md).

## Остановка

Сначала Pause только этот runner в GitLab, дождаться окончания собственной job,
затем `docker compose -f infrastructure/ci/gitlab-runner/compose.yaml stop`.
Config и токен сохраняются вне Git. Удаление runner или ротация токена — явное
действие для этого runner; `docker system prune` и удаление чужих volumes не нужны.

## Основания

- [Регистрация с authentication token](https://docs.gitlab.com/runner/register/).
- [Настройки Docker executor](https://docs.gitlab.com/runner/configuration/advanced-configuration/).
- [Новый порядок создания runner](https://docs.gitlab.com/ci/runners/new_creation_workflow/).
