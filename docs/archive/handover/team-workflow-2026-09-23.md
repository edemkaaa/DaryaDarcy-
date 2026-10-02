> Архивный материал: сохранён для истории, не является текущей инструкцией запуска, деплоя или источником состояния проекта. Актуальная навигация — [документация](../../README.md).

# Team workflow

Private repository: https://git.daryadarcy.com/darya/daryadarcy-app
Owner: Darya. Ivan maintains the repository during the handover.

## Branches

- `main`: initial reviewed build baseline, not a verified mirror of live production.
- `stage`: integration branch, initially the same baseline as main.
- `feature/*` and `fix/*`: work branches, reviewed through merge requests into stage.
- `stage` → `main`: release merge request after staging acceptance by the Owner.
- `handover/*`: sanitized historical snapshots; keep these separate from new work.
- `stabilize/reproducible-build`: traceable local build fixes before import.

The historical prod-stable-2026-09-17 tag was supplied in the handover; its name
is not proof that its source matches the deployed production bundle.
Sanitization rewrote historical commit IDs. Full original archives remain in
protected local custody, not in GitLab. Do not push them or their secret files.

main/stage should reject direct pushes and force pushes; maintainers merge
reviewed merge requests. No automatic production deployment is configured.
Owner approval for production is a separate release requirement, not satisfied
merely by a maintainer merging code.

## Local verification

Node 22.23.3, pnpm 9.12.0. Use pnpm-lock.yaml, not the legacy npm lock.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
pnpm run verify
pnpm run build
pnpm run build:web
CHECK_WEB_DIST=1 pnpm run verify
pnpm exec vitest run --exclude '**/s3-connection.test.ts'
```

Build outputs overwrite local generated directories: use a disposable build
copy, not preserved handover artifacts. Real production.env, S3 credentials,
database dumps and SSH keys must never be supplied to build jobs.

The expanded offline suite currently has 174 passes, 8 pre-existing screen
expectation failures and 1 pre-existing skipped test. Tests are not disabled to
hide these failures. The S3 test is excluded here because it writes to a real
bucket; it requires a separately approved isolated integration environment.

## Not ready yet

Runner, automatic CI pipelines, a staging environment and browser acceptance
remain to be configured. main/stage are Git branches, not running environments.
SMTP and restore-test completion are separate infrastructure tasks.
See BUILD-STATUS.md for build constraints; a successful local build does not
authorize deployment, payment tests, data migrations or real notifications.
