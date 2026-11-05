# Сборка и приёмка бэкенда на Linux AMD64

Пакет подготовлен 5 ноября 2026 года из
`ec5ba40aeea8f14cd7340bc08a1c7b9730a75bf7`. Код бэкенда соответствует
ARM64-кандидату `05056a6a`. Коммит `ec5ba40a` добавляет сценарий Pen Pals в
приёмку образа. [Результаты ARM64](backend-image-local-acceptance-2026-11-03.md#кандидат-05056a6a--5-ноября).

Для приёмки нужна отдельная Linux-машина с x86_64, локальным Docker Engine,
Buildx, Bash, Git, Node.js 22 и pnpm 9.12.0. Оставьте около 10 ГиБ свободного
места для рабочего каталога и слоёв Docker. На стенде одновременно работают
две реплики API и одноразовая MySQL. Сборка скачивает зависимости из npm,
Docker Hub и репозитория Debian.

## Получить исходники

При доступном GitLab выполните эти команды из чистой ветки кандидата.
Проверка предка остановит процесс, если сначала нужно объединить свежие
изменения staging.

```bash
set -euo pipefail
test -z "$(git status --porcelain)"
git fetch --no-tags origin refs/heads/staging
git merge-base --is-ancestor FETCH_HEAD HEAD
revision=$(git rev-parse HEAD)
```

Для локальной репетиции без GitLab скопируйте на Linux два файла из
`../.local-artifacts/amd64-handoff-20261105` рядом с локальным репозиторием:

- `backend-ec5ba40a-source.tar.gz`
- `backend-ec5ba40a-source.tar.gz.sha256`

Архив содержит только отслеживаемые исходники, нужные для сборки бэкенда,
миграций и приёмки. Он подходит для чистой машины без клона Git.
Выполните команды в каталоге, где лежат оба файла.

```bash
set -euo pipefail
umask 077
archive="$PWD/backend-ec5ba40a-source.tar.gz"
sha256sum -c backend-ec5ba40a-source.tar.gz.sha256
workspace=$(mktemp -d "$PWD/daryadarcy-amd64.XXXXXXXX")
gzip -dc "$archive" > "$workspace/source.tar"
revision=$(git get-tar-commit-id < "$workspace/source.tar")
test "$revision" = ec5ba40aeea8f14cd7340bc08a1c7b9730a75bf7
tar -xf "$workspace/source.tar" -C "$workspace"
cd "$workspace/daryadarcy-app"
```

## Собрать и принять образ

Продолжите в том же Bash после одного из вариантов подготовки исходников.

```bash
set -euo pipefail
umask 077
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
test "$(node -p 'process.versions.node.split(".")[0]')" = 22
test "$(pnpm --version)" = 9.12.0

unset DOCKER_HOST BUILDX_BUILDER
export DOCKER_CONTEXT=default
endpoint=$(docker context inspect default --format '{{.Endpoints.docker.Host}}')
case "$endpoint" in
  unix://*) ;;
  *) printf '%s\n' 'Для приёмки нужен локальный Docker' >&2; exit 1 ;;
esac
case "$(docker info --format '{{.OSType}}/{{.Architecture}}')" in
  linux/x86_64|linux/amd64) ;;
  *) printf '%s\n' 'Нужен нативный Docker на Linux AMD64' >&2; exit 1 ;;
esac

evidence="$PWD/../.local-artifacts"
mkdir -p "$evidence"
image="daryadarcy-audit-api:${revision:0:8}-amd64"

CI=true NODE_ENV=test pnpm install --frozen-lockfile --ignore-scripts
docker pull --platform linux/amd64 mysql:8.4
docker buildx build --builder default --platform linux/amd64 --load \
  --progress=plain --build-arg "SOURCE_REVISION=$revision" \
  --tag "$image" --file infrastructure/deploy/teamassist/Dockerfile.backend . \
  2>&1 | tee "$evidence/build-amd64-${revision:0:8}.log"

test "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")" = linux/amd64
test "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" = "$revision"
docker image inspect --format '{{.Id}}' "$image"
node tooling/scripts/accept-backend-image.mjs "$image" \
  | tee "$evidence/accept-amd64-${revision:0:8}.log"
```

Для этого пакета ожидаются 51 миграция и 60 прошедших тестов.
Раннер напечатает путь к каталогу с `result.json`, `migrations.log` и
`image-tests.log`. В `result.json` сверяются `passed: true`,
`cleaned: true`, `architecture: "amd64"`, `sourceRevision` и ID образа.
Приёмка использует свои контейнеры, закрытую сеть и временную MySQL.

Архив проверен локально по SHA-256 и идентификатору коммита. Проверка
frozen lockfile прошла для всех шести workspace-проектов. Из
распакованного архива собраны бандлы с теми же SHA-256 и пройдены 60 тестов
на уже собранном ARM64 с установленными на Mac зависимостями. Для выпуска нужна отдельная
нативная приёмка AMD64, сверка со свежим staging и серверный preflight.
[Порядок выпуска](release-candidate-2026-11-04.md#точный-остаток-для-реального-обновления).
