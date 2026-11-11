# Тесты и фикстуры: файлы и блоки

Справочник извлечён из путей, комментариев и объявлений. Он не подтверждает ручной разбор каждого блока или готовность выпуска.

[Общая карта](index.md)

## [__tests__/club-tags.test.ts](../../../__tests__/club-tags.test.ts)

Модуль club-tags.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: club-tags comments` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: opens comments only for community posts within 48h` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: closes comments after 48 hours` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: computes close time from publishedAt` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: routes community tag to community tab` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/comment-count-label.test.ts](../../../__tests__/comment-count-label.test.ts)

Модуль comment-count-label.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: commentCountLabel` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: declines Russian comment counts` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exports char limit matching API` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/documentation-cli.test.ts](../../../__tests__/documentation-cli.test.ts)

Модуль documentation-cli.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tsx` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sandbox` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `check` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `write` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `describe: documentation command in an isolated Git repository` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks untracked docs, fails on a missing file and passes after correction` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: excludes archive content but checks its navigation entry point` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept ignored generated files as committed link targets` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/documentation-links.test.ts](../../../__tests__/documentation-links.test.ts)

Модуль documentation-links.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `files` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: documentation file links` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports a missing document with its source line` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the same document after its link is rebased` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a directory only when the inventory contains its children` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: supports images and reference definitions` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: supports angles, percent-encoded spaces, titles, query and fragment` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: supports balanced parentheses in Expo route paths` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects links outside the repository` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts repository-root paths` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not fetch URLs or treat headings as file paths` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores fenced examples and inline code but preserves line numbers` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handles bad encoding without crashing the rest of the scan` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/inspiration-titles.test.ts](../../../__tests__/inspiration-titles.test.ts)

Модуль inspiration-titles.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: stripInspirationDescription` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes trailing description after em dash` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps dashes inside the title` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns entries without a separator unchanged` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: formats comma-separated title lists` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/password-roundtrip.test.ts](../../../__tests__/password-roundtrip.test.ts)

Модуль password-roundtrip.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: password compatibility` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the existing scrypt format and verifies correct passwords` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verifies a legacy-format fixture generated independently` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/photo-urls.test.ts](../../../__tests__/photo-urls.test.ts)

Модуль photo-urls.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: API photo URLs` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps valid signed URLs unchanged and in order` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid types, local and executable URLs` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains canonical uploaded photos alongside old signed CDN URLs` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/post-text-sanitize.test.ts](../../../__tests__/post-text-sanitize.test.ts)

Модуль post-text-sanitize.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: post-text-sanitize` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: strips control characters after line breaks` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: splits richText blocks on embedded newlines` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stores rich text with links when plain text matches` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: realigns rich text when plain text only differs by trailing whitespace` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves italic flags for EB Garamond rendering` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps multiple formatted children in one paragraph` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/qr-output.test.ts](../../../__tests__/qr-output.test.ts)

Модуль qr-output.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `script` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sandbox` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: local QR tool` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: writes a real PNG to the generated-artifacts folder, not the project root` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails without a URL and creates no artifacts` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/quiz-data.test.ts](../../../__tests__/quiz-data.test.ts)

Модуль quiz-data.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Quiz Data` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should have exactly 10 questions` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should have unique question IDs` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: each question should have at least 4 answers` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: each answer should have at least one score entry` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should have results for all 7 aesthetics` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should have display names for all aesthetics` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: Scoring Logic` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: createEmptyScores should return all zeros` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: calculateResult should return cottagecore for all cottagecore answers` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: calculateResult should return darkAcademia for dark academia answers` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: calculateResult should return witchcore for witchcore answers` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: calculateResult should handle null answers gracefully` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: calculateResult should detect blend when scores are close` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/repository-boundaries.test.ts](../../../__tests__/repository-boundaries.test.ts)

Модуль repository-boundaries.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `repositoryRoot` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: repository ownership boundaries` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the legacy Vite client inside the apps workspace` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps deployment assets outside application source` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: owns the API service inside the backend application` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: owns the schema and migrations inside the database package` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: owns the Next.js client and preserves the Expo source separately` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: owns platform-neutral contracts inside the shared package` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: declares application and package workspace globs` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps repository automation under tooling` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/rich-text-anchors.test.ts](../../../__tests__/rich-text-anchors.test.ts)

Модуль rich-text-anchors.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: rich-text-anchors` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: tracks the nth occurrence of repeated anchor text` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: resolves the same occurrence after unrelated text edits elsewhere` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not confuse two different list items` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/rich-text-ranges.test.ts](../../../__tests__/rich-text-ranges.test.ts)

Модуль rich-text-ranges.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: rich-text-ranges` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: roundtrips multiple bold ranges in one paragraph` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: roundtrips bold + link in different phrases` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: roundtrips multiple links in one paragraph` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/rich-text-save.test.ts](../../../__tests__/rich-text-save.test.ts)

Модуль rich-text-save.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: rich-text-save` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps links after plain text whitespace normalization` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves bold formatting instead of dropping rich text` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers links when plain text is sanitized but anchor text stays the same` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/s3-connection.test.ts](../../../__tests__/s3-connection.test.ts)

Модуль s3-connection.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `hasS3Credentials` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: Timeweb S3 Connection` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should have S3 environment variables configured` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should successfully upload a test file to S3` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/trpc-contract.test.ts](../../../__tests__/trpc-contract.test.ts)

Модуль trpc-contract.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `expectedProcedures` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: public tRPC contract` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps every public namespace and procedure available` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [__tests__/web-viewport.test.ts](../../../__tests__/web-viewport.test.ts)

Модуль web-viewport.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: clamps the content width and keeps full screen dimensions` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the shrunken layout viewport instead of stale innerWidth` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: falls back to innerWidth when the layout width is unavailable` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps server and initial hydration measurements deterministic` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/accessibility-actions.spec.ts](../../../apps/frontend/e2e/accessibility-actions.spec.ts)

Модуль accessibility-actions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `decoration` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `closedPanelButton` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `test: closed club filters cannot receive keyboard or programmatic focus` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: closed filters remain off-screen after resizing and rapid reopening` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: comment links and actions work with the keyboard and menu focus is restored` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: main screens expose named visible buttons without horizontal overflow` | 236 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: visual quiz choices have a name and announce their selected state` | 276 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the filter reset remains fully reachable by scrolling and keyboard on narrow and short screens` | 298 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/admin-action-recovery.spec.ts](../../../apps/frontend/e2e/admin-action-recovery.spec.ts)

Модуль admin-action-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `expiry` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Kind` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Request` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `setup` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 106 | Функция. Подробности и ограничения — в исходнике. |
| `start` | 111 | Функция. Подробности и ограничения — в исходнике. |
| `replay` | 120 | Функция. Подробности и ограничения — в исходнике. |
| `confirmed` | 126 | Функция. Подробности и ограничения — в исходнике. |
| `accept` | 65 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `test: two simultaneously ready tabs cannot create separate intents` | 248 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: 429 persists a cooldown through reload and status remains available` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: recovery actions and members remain reachable at 320x400` | 371 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: admin-recovery-320x400.png` | 395 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/admin-action-results.spec.ts](../../../apps/frontend/e2e/admin-action-results.spec.ts)

Модуль admin-action-results.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `article` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: blocking and unblocking members use confirmed replies and refresh the visible state` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a malformed deletion verification list cannot unlock article actions` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/admin-attachments.spec.ts](../../../apps/frontend/e2e/admin-attachments.spec.ts)

Модуль admin-attachments.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `post` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `Write` | 65 | Контракт типов. Подробности и ограничения — в исходнике. |
| `assetIdFor` | 66 | Функция. Подробности и ограничения — в исходнике. |
| `receipt` | 72 | Функция. Подробности и ограничения — в исходнике. |
| `api` | 86 | Функция. Подробности и ограничения — в исходнике. |
| `editor` | 103 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 105 | Функция. Подробности и ограничения — в исходнике. |
| `choose` | 131 | Функция. Подробности и ограничения — в исходнике. |
| `alerts` | 148 | Функция. Подробности и ограничения — в исходнике. |
| `test: the full editor restores existing attachments without reuploading or removing them` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: removing and adding attachments commits once and the reopened editor reads the saved media` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an attachment-only full post previews filenames at mobile and desktop widths and then saves` | 253 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: partial upload failure retains files and reuses the confirmed upload on explicit retry` | 322 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unconfirmed full editor write is not repeated and keeps the attachment` | 381 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: closing during upload ignores a late result and resets attachments and preview for a new draft` | 412 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/admin-paged-reads.spec.ts](../../../apps/frontend/e2e/admin-paged-reads.spec.ts)

Модуль admin-paged-reads.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fullPost` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `card` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `counts` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: admin loads pages only for posts and bounded calendar data for its own period` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: admin-paged-posts.png` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: admin-bounded-calendar.png` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: editing fetches the full draft and discards a late read after switching sections` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed next page retries without losing cards or repeating an ID` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unknown deletion checks the exact post rather than an incomplete page` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed counters show no fake zero and can be retried independently` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late private detail is discarded when the account changes` | 229 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a quick editor save invalidates retained admin pages and counters` | 285 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/admin-statistics.spec.ts](../../../apps/frontend/e2e/admin-statistics.spec.ts)

Модуль admin-statistics.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: statistics hide cached numbers after a failed refresh and recover on retry` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: statistics-error.png` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: statistics-recovered.png` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unavailable initial read can recover to genuinely zero statistics` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/article-admin-cache.spec.ts](../../../apps/frontend/e2e/article-admin-cache.spec.ts)

Модуль article-admin-cache.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `beforeTitle` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `afterTitle` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `readsToRefresh` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `tab` | 120 | Функция. Подробности и ограничения — в исходнике. |
| `total` | 122 | Функция. Подробности и ограничения — в исходнике. |
| `primeCache` | 125 | Функция. Подробности и ограничения — в исходнике. |
| `test: a rejected article edit does not invalidate confirmed admin data` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/article-cache-consistency.spec.ts](../../../apps/frontend/e2e/article-cache-consistency.spec.ts)

Модуль article-cache-consistency.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `navigate` | 5 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/article-cover-recovery.spec.ts](../../../apps/frontend/e2e/article-cover-recovery.spec.ts)

Модуль article-cover-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `coverUrl` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `oldCover` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `title` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `body` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `button` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `check` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `retry` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `restore` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `barrier` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 146 | Функция. Подробности и ограничения — в исходнике. |
| `edit` | 150 | Функция. Подробности и ограничения — в исходнике. |
| `choose` | 158 | Функция. Подробности и ограничения — в исходнике. |
| `stored` | 165 | Функция. Подробности и ограничения — в исходнике. |
| `test: a successful cover upload changes only the editor until an explicit article save` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a lost response restores the exact new article and private file after reload without another cover upload` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: ready discovered immediately before retry avoids a duplicate cover upload` | 288 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: status failure keeps the journal and does not unlock blind retry` | 305 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a conflict needs explicit discard before choosing a new cover` | 324 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an avatar receipt is not accepted as a public cover receipt` | 346 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a delayed upload cannot replace another article's cover` | 360 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a cancelled new article cannot donate its banner to a different new draft` | 389 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: another account cannot restore or apply an old upload, including a late response` | 412 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: IndexedDB write failure prevents an upload without a durable intent` | 447 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a stale second tab cannot overwrite the first tab's durable cover intent` | 468 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unavailable browser storage can be rechecked before choosing a cover` | 500 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: pending article creation is resolved before restoring a different draft's cover` | 535 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/article-creation-recovery.spec.ts](../../../apps/frontend/e2e/article-creation-recovery.spec.ts)

Модуль article-creation-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uuid` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `titleField` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `storedOperation` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `deferred` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `openArticles` | 124 | Функция. Подробности и ограничения — в исходнике. |
| `loseCreation` | 128 | Функция. Подробности и ограничения — в исходнике. |
| `restore` | 145 | Функция. Подробности и ограничения — в исходнике. |
| `test: lost committed response and reload recover one article and teaser without another POST` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: notRecorded keeps the original operation and only an explicit replay sends the exact payload` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: notRecorded can precede a late commit; replay still uses the original key` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: deleted result never automatically creates a replacement` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: CONFLICT retains the key and immutable payload instead of starting another operation` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late status reply cannot reset a different form after navigation` | 299 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late status reply cannot enter the new account's form or clear its operation` | 338 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: another tab cannot overwrite the outstanding operation with a new payload` | 388 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: storage failure prevents creation before any POST` | 418 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a real client timeout retains the persisted operation without automatically repeating the POST` | 435 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/article-draft-recovery.spec.ts](../../../apps/frontend/e2e/article-draft-recovery.spec.ts)

Модуль article-draft-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `recover` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `retryRead` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `create` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `title` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `restore` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `seed` | 41 | Функция. Подробности и ограничения — в исходнике. |
| `stored` | 104 | Функция. Подробности и ограничения — в исходнике. |
| `openArticles` | 154 | Функция. Подробности и ограничения — в исходнике. |
| `test: a damaged new draft leaves healthy drafts usable and is archived with original file bytes only after confirmation` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a damaged edit blocks only that article and the server article can be opened after archiving` | 204 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed backup leaves the original draft locked and can be retried` | 231 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a valid replacement from another tab is preserved and can be discovered without reloading the page` | 270 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an initial IndexedDB read failure can be retried and does not require deleting data` | 297 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed refresh after archiving preserves the backup and a read retry unlocks the editor` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: two tabs cannot archive the same damaged draft twice or lose its file` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/article-request-states.spec.ts](../../../apps/frontend/e2e/article-request-states.spec.ts)

Модуль article-request-states.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Outcome` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `title` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `originalText` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `recoveredText` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `photo` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `recoveredPhoto` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `viewer` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `articleApi` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `openCachedArticle` | 135 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/articles-pagination.spec.ts](../../../apps/frontend/e2e/articles-pagination.spec.ts)

Модуль articles-pagination.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `article` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `titles` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `edit` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `list` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `scrollEnd` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `body` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `test: article cards load by opaque cursor and only the selected editor reads full content` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed next article page retains cards and retries the same cursor` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late article detail is discarded after switching admin sections` | 176 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: absence from the first page cannot confirm article deletion` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an article detail failure retries without creating a partial form` | 251 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a checked unknown deletion that did not commit allows a deliberate retry` | 276 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: account change discards an old article detail and starts the new owner's page` | 301 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/audit-draft-persistence.spec.ts](../../../apps/frontend/e2e/audit-draft-persistence.spec.ts)

Модуль audit-draft-persistence.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `articles` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `title` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `savedDraft` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `test: an unsent article restores its fields and actual file bytes after reload` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a second article tab cannot overwrite a newer draft` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article storage failure keeps the editor open and reports unsaved input` | 167 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: quiz answers and current question survive reload` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: profile storage failure is visible and prevents an unrecoverable mutation` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an uncertain article update remains blocked after reload` | 263 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article drafts never appear in the next account` | 308 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: separate article drafts both survive switching editors and reloading` | 358 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/audit-remediation.spec.ts](../../../apps/frontend/e2e/audit-remediation.spec.ts)

Модуль audit-remediation.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `now` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `test: both public privacy pages expose the same support address` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: copy protection is released when the retained Club screen is hidden` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: Club background refresh reads the head only and keeps numeric wire cursors` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: moderation never offers to block the signed-in author` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/auth-keyboard.spec.ts](../../../apps/frontend/e2e/auth-keyboard.spec.ts)

Модуль auth-keyboard.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `resizeKeyboard` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `fullyVisible` | 29 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/auth-routing.spec.ts](../../../apps/frontend/e2e/auth-routing.spec.ts)

Модуль auth-routing.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Role` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `actor` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `fixtures` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `enter` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `test: guest admin entry uses a clean login and retains its destination across reload` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed session check does not redirect or request staff data` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a legacy login link is cleaned and still returns an administrator correctly` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unsafe legacy return falls back to the profile` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: profile entry uses a clean login and consumes its return after success` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: login destinations remain independent between two tabs` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a post save entry returns to that exact post after login` | 176 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: renewal uses a clean club URL, survives reload and does not affect normal club entry` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/background-notices.spec.ts](../../../apps/frontend/e2e/background-notices.spec.ts)

Модуль background-notices.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `post` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `notice` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `tick` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `test: profile keeps cached bookmarks and hides its warning after leaving` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: session, subscription and cached content failures have one recovery action` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/bounded-media-read.spec.ts](../../../apps/frontend/e2e/bounded-media-read.spec.ts)

Модуль bounded-media-read.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `script` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BrowserReader` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `test: preserves an exact-limit document in the browser` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: cancels a stalled browser stream without returning a partial file` | 84 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/bounded-post-interactions.spec.ts](../../../apps/frontend/e2e/bounded-post-interactions.spec.ts)

Модуль bounded-post-interactions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `post` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `list` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `row` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `save` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `retry` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `deferred` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `test: unsaving a retained second-page card removes it even when the refreshed head is unchanged` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: one failed group does not block ready cards, and an explicit retry recovers it` | 249 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: detail reuses fresh marks and confirmed changes reach the retained list without another read` | 293 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a cold detail reads only its post` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: feed and club reuse overlapping marks and request only previously unseen posts` | 333 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: opening a detail after freshness expires reads its current mark without reloading other marks` | 369 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: recovering another post cannot unlock an uncertain save outside the read set` | 412 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late read for a previous account cannot restore its marks` | 486 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/bounded-request-pages.spec.ts](../../../apps/frontend/e2e/bounded-request-pages.spec.ts)

Модуль bounded-request-pages.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `stamp` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/cache-and-resume.spec.ts](../../../apps/frontend/e2e/cache-and-resume.spec.ts)

Модуль cache-and-resume.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: browser really reuses hashed artwork on a second visit` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: browser-image-cache` | 202 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/capabilities-cache.spec.ts](../../../apps/frontend/e2e/capabilities-cache.spec.ts)

Модуль capabilities-cache.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `capabilities` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `deferred` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `phoneOffer` | 58 | Функция. Подробности и ограничения — в исходнике. |
| `startWithCompletedCapabilities` | 60 | Функция. Подробности и ограничения — в исходнике. |
| `resume` | 92 | Функция. Подробности и ограничения — в исходнике. |
| `test: capabilities: confirming the initial member does not repeat a completed public read` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: capabilities: the guest keeps the same completed public read` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: capabilities: switching accounts preserves public freshness without extending its lifetime` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: capabilities: stale public data is rechecked on network recovery` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: capabilities: an error with previously cached data is not restored as success for another account` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: capabilities: identity confirmation cancels an unfinished read and ignores its late response` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/carousel-mouse-drag.spec.ts](../../../apps/frontend/e2e/carousel-mouse-drag.spec.ts)

Модуль carousel-mouse-drag.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `drag` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `noDim` | 58 | Функция. Подробности и ограничения — в исходнике. |
| `test: home promo does not dim or reload the image on mouse press` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: gallery photo does not dim or reload on mouse press` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a short mouse movement remains a click; blur cancels a swipe and outside release completes it` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: testimonial dragging preserves its previous and next buttons` | 163 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: dragging quiz image choices never selects an answer; a normal click does` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: mouse swiping preserves native keyboard and horizontal wheel scrolling` | 223 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native touch on galleries with mouse swiping` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-access.spec.ts](../../../apps/frontend/e2e/club-access.spec.ts)

Модуль club-access.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `expiration` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `test: a moderator role does not override a server refusal of club access` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: owner keeps the existing access exception without a paid period` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a fresh permission refusal closes previously confirmed service access` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-navigation.spec.ts](../../../apps/frontend/e2e/club-navigation.spec.ts)

Модуль club-navigation.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `clubMenu` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `appMenu` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `memberApi` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `test: club navigation restores the app menu when confirmed club access is lost` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-pagination.spec.ts](../../../apps/frontend/e2e/club-pagination.spec.ts)

Модуль club-pagination.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ok` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `failure` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `Post` | 33 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Input` | 34 | Контракт типов. Подробности и ограничения — в исходнике. |
| `clubApi` | 41 | Функция. Подробности и ограничения — в исходнике. |
| `paged` | 84 | Функция. Подробности и ограничения — в исходнике. |
| `list` | 100 | Функция. Подробности и ограничения — в исходнике. |
| `scrollToEnd` | 102 | Функция. Подробности и ограничения — в исходнике. |
| `refreshList` | 107 | Функция. Подробности и ограничения — в исходнике. |
| `test: a club rubric finds a publication beyond the first 200 records without downloading the archive` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the unfiltered club list exposes all 221 posts through successive pages` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: appending a club page preserves scroll and removes overlapping IDs` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed next page keeps loaded posts and retries the same cursor once` | 247 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an initial club error offers retry instead of an empty section` | 282 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: retry in an empty filtered section displays loading until the page arrives` | 302 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a server-filtered empty rubric stops without scanning unrelated pages` | 337 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a repeated cursor stops automatic loading and exposes a recoverable error` | 364 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: rubric and board filters find a Russian-tagged match on a later page` | 393 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: pull to refresh updates the loaded page without losing its posts` | 434 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: pagination uses offsets within the selected category and board tag` | 458 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a missing category API is an error, never an unfiltered fallback` | 564 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a forbidden refresh hides all retained club pages` | 677 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: refresh cancels an older page request before starting a new chain` | 702 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club keeps publication dates and ID ties in API order across three pages` | 753 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club appends an API page without locally moving a newer-dated card ahead of loaded posts` | 821 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-payment.spec.ts](../../../apps/frontend/e2e/club-payment.spec.ts)

Модуль club-payment.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `destination` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `expiration` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pay` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `check` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `member` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `deferred` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 111 | Функция. Подробности и ограничения — в исходнике. |
| `test: legacy build ignores TEST return parameters and recovery journals without switching modes` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: profile renewal uses the existing email and never submits a password` | 233 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a known checkout refusal permits an explicit retry` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unknown checkout asks before preparing another order and never retries automatically` | 302 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: checkout-error-390.png` | 319 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a timed-out checkout remains uncertain and enables a controlled manual retry` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: leaving the club fences a late payment URL and retains the uncertainty` | 361 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an account change cannot follow the previous person's payment URL` | 390 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a guest return opens the email login path without granting access` | 424 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: claim granted does not open access without a fresh subscription` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: automatic return checking is finite, sequential and does not create payments` | 489 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a confirmed later access period updates renewal without claiming payment success` | 514 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: renewal-confirmed-390.png` | 536 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: one pending manual verification disables both check and payment actions` | 607 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: leaving a return check stops the campaign and does not restart it on tab return` | 632 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: recovery handles malformed replies, rate limits and a valid queued instruction` | 653 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-preload.spec.ts](../../../apps/frontend/e2e/club-preload.spec.ts)

Модуль club-preload.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `listSelector` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `imageUrl` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `setup` | 22 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-rich-text-links.spec.ts](../../../apps/frontend/e2e/club-rich-text-links.spec.ts)

Модуль club-rich-text-links.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: club-rich-text-card.png` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-seasons.spec.ts](../../../apps/frontend/e2e/club-seasons.spec.ts)

Модуль club-seasons.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `winter` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `imageUrl` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `appearance` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `publicConfig` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `snapshot` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `theme` | 48 | Функция. Подробности и ограничения — в исходнике. |
| `background` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `banner` | 50 | Функция. Подробности и ограничения — в исходнике. |
| `form` | 52 | Функция. Подробности и ограничения — в исходнике. |
| `alert` | 54 | Функция. Подробности и ограничения — в исходнике. |
| `images` | 55 | Функция. Подробности и ограничения — в исходнике. |
| `clubApi` | 63 | Функция. Подробности и ограничения — в исходнике. |
| `openSettings` | 67 | Функция. Подробности и ограничения — в исходнике. |
| `transparentBanner` | 73 | Функция. Подробности и ограничения — в исходнике. |
| `expectWinterBannerFit` | 78 | Функция. Подробности и ограничения — в исходнике. |
| `test: winter banner dimensions change with the decoded URL, not pending or superseded images` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed winter banner preserves fallback geometry and explicit retry uses the recovered image size` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: entry and reload keep a neutral background until the configured season arrives` | 231 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a new season waits for both images while the confirmed pair stays visible` | 263 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: Moscow midnight refreshes the server season even in a Los Angeles browser` | 342 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: returning to Club and resuming the page refreshes changed settings while preserving the selected section` | 372 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed background refresh retains the confirmed theme and offers an explicit retry` | 397 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: missing and failed images fall back without changing the banner dimensions` | 462 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: owner settings save all four seasons once, preserve manager email and survive reopening` | 511 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unknown save and failed inspection retain input; fresh unchanged settings permit only a manual retry` | 618 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a lost save reply is resolved by reading the matching revision without another PUT` | 664 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a revision conflict preserves draft and requires explicit replacement with the current settings` | 697 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: malformed save confirmation does not clear the owner's draft` | 743 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: settings read failure offers retry without showing an empty editor` | 768 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: revoking a session during settings save prevents a late success and closes private UI` | 832 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/club-testimonials.spec.ts](../../../apps/frontend/e2e/club-testimonials.spec.ts)

Модуль club-testimonials.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: testimonial navigation works with keyboard and stops at both ends` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/comment-recovery.spec.ts](../../../apps/frontend/e2e/comment-recovery.spec.ts)

Модуль comment-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `now` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `comment` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `textFixture` | 108 | Функция. Подробности и ограничения — в исходнике. |
| `test: deleted-parent-local-notice.png` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: deleted-parent-recovered.png` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a stored keyed text operation cannot downgrade when the server capability switches off` | 280 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an explicitly disabled server gate keeps the existing unkeyed text contract` | 314 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed capability read never silently dispatches an unkeyed text comment` | 332 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the payments screen explains automatic history loading` | 397 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: another tab with a stale empty journal cannot create a second text operation` | 411 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late capability response cannot dispatch a text comment after leaving the screen` | 449 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/comments-moderation.spec.ts](../../../apps/frontend/e2e/comments-moderation.spec.ts)

Модуль comments-moderation.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `png` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `now` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `privatePhoto` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `comment` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `member` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `report` | 46 | Функция. Подробности и ограничения — в исходнике. |
| `commentsApi` | 60 | Функция. Подробности и ограничения — в исходнике. |
| `openComments` | 116 | Функция. Подробности и ограничения — в исходнике. |
| `choosePhotos` | 121 | Функция. Подробности и ограничения — в исходнике. |
| `dialogs` | 134 | Функция. Подробности и ограничения — в исходнике. |
| `managedPost` | 682 | Функция. Подробности и ограничения — в исходнике. |
| `test: a partial private photo failure blocks the frozen comment until explicit discard refreshes the list` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unknown like cannot be repeated until a successful read, and a failed read keeps it blocked` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a confirmed comment like and count survive a failed refresh` | 232 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unknown comment creation keeps its draft and cannot be unlocked by reading alone` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: canceling an edit is disabled while the server is saving it` | 291 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: two synchronous admin block clicks send one write` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an invalid grant response cannot be announced as a successful extension` | 355 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a moderator can use the report inbox without requesting owner-only admin data` | 374 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a reply with two confirmed photos is sent once and updates the loaded comment count` | 480 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a rejected text edit retains the draft and leaves existing comment photos untouched` | 532 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a confirmed moderator deletion refreshes the inbox and affected comments` | 624 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a revoked session cannot show a late successful grant or retain admin UI` | 647 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a void post deletion response is not confirmed while the post still exists` | 748 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a confirmed club grant announces the returned expiry and refreshes members` | 786 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/content-edit-revisions.spec.ts](../../../apps/frontend/e2e/content-edit-revisions.spec.ts)

Модуль content-edit-revisions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `text` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `title` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `compare` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `accept` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `article` | 40 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `fullPost` | 117 | Функция. Подробности и ограничения — в исходнике. |
| `editArticle` | 128 | Функция. Подробности и ограничения — в исходнике. |
| `readDraft` | 137 | Функция. Подробности и ограничения — в исходнике. |
| `test: quick editor reads a full record and preserves its revision on a lost response` | 229 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: post rejects overlong UTF-8 before any write and keeps the full input` | 257 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article private file operation retains original bytes and revision through conflict and a manual rebase` | 317 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: tags keep a restored revision and selected input until manual conflict acceptance` | 366 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: tags with a lost response are confirmed by a read without another mutation` | 396 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/content-refresh.spec.ts](../../../apps/frontend/e2e/content-refresh.spec.ts)

Модуль content-refresh.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `advance` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `navigate` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `test: polls only the visible section, pauses while hidden/offline and resumes stale data` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club refresh preserves the selected section and sees another admin's edits` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an article switched to club access hides its cached sections after polling` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/cursor-fixture.ts](../../../apps/frontend/e2e/cursor-fixture.ts)

Adapt existing synthetic catalogs to the new wire contract, not production requests.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `legacyCursorFixture` | 2 | Adapt existing synthetic catalogs to the new wire contract, not production requests. |
| `cursorFixture` | 8 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/cursor-pages.spec.ts](../../../apps/frontend/e2e/cursor-pages.spec.ts)

Модуль cursor-pages.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `saved` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `test: a forbidden reply group immediately hides retained comments of the post` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: saved polling refreshes the visible tail and rebuilds a changed cursor chain` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late saved page cannot enter another account cache` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: comment roots and nested replies load independently and keep the server total` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: members do not load for payments, and lost moderation replies inspect the exact page-two account` | 307 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: saved tabs request only their own pages, deduplicate overlap and retry the same cursor` | 376 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/editor-fixtures.ts](../../../apps/frontend/e2e/editor-fixtures.ts)

Модуль editor-fixtures.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ok` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `failure` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `editorApi` | 22 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/editor-safety.spec.ts](../../../apps/frontend/e2e/editor-safety.spec.ts)

Модуль editor-safety.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `openQuickEditor` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `contentPost` | 301 | Функция. Подробности и ограничения — в исходнике. |
| `photoPostApi` | 500 | Функция. Подробности и ограничения — в исходнике. |
| `test: a failed save keeps editor text and an explicit retry sends one write` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: audio upload rejection leaves the post untouched and retry commits it once` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unconfirmed save is never automatically repeated` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a pending final write cannot be abandoned; confirmed completion allows a fresh editor` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a private video upload returning HTML 413 preserves its draft without creating a post` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: editing an unpublished article preserves its status` | 270 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a rejected attachment upload cannot unpublish an existing post; retry saves it once` | 316 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed like rolls back and requires a read before repeating an unconfirmed write` | 398 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: two synchronous like clicks send one mutation and confirmed count comes from the post` | 426 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an empty saved category does not show posts from the other category` | 463 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the photo viewer preserves the chosen photo when the viewport changes` | 481 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a photo scroll immediately followed by resize preserves the new selection` | 531 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a refreshed photo list clamps selection and removes empty indicators` | 638 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a rejected audio play does not display playing state` | 725 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed comment photo upload keeps the text and reports its error` | 768 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed article list offers retry instead of showing an empty list` | 818 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: shared image picker decoding errors are caught by its existing profile consumer` | 844 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an expired session during an editor write closes private UI before any error dialog` | 872 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/first-entry-motion.spec.ts](../../../apps/frontend/e2e/first-entry-motion.spec.ts)

Модуль first-entry-motion.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Frame` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `test: reduced motion shows the real screen immediately with no entrance animation` | 217 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/fixtures/cache-audit-proxy.mjs](../../../apps/frontend/e2e/fixtures/cache-audit-proxy.mjs)

Модуль cache-audit-proxy.mjs; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `origin` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `svg` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `video` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `article` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `videoCard` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fields` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `guide` | 48 | Функция. Подробности и ограничения — в исходнике. |
| `capabilities` | 92 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `config` | 101 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stats` | 109 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `answer` | 123 | Функция. Подробности и ограничения — в исходнике. |
| `server` | 213 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/fixtures/carousel-video.webm](../../../apps/frontend/e2e/fixtures/carousel-video.webm)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [apps/frontend/e2e/focus-and-menu.spec.ts](../../../apps/frontend/e2e/focus-and-menu.spec.ts)

Модуль focus-and-menu.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `menu` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `routes` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `menuGeometry` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `changeWindowFocus` | 90 | Функция. Подробности и ограничения — в исходнике. |
| `test: stable-menu.png` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: profile focus checks access without reloading saved posts` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: public pages retain their content and cache when every session check fails` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed private session keeps its error screen during a focus recheck` | 216 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/free-loshadka.spec.ts](../../../apps/frontend/e2e/free-loshadka.spec.ts)

Модуль free-loshadka.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `pdfUrl` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `winterKeys` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Actor` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `openedMaterials` | 65 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/frontend-independent-fixes.spec.ts](../../../apps/frontend/e2e/frontend-independent-fixes.spec.ts)

Модуль frontend-independent-fixes.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: calendar reads its own projection without fetching the stale post archive` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: calendar can retry its projection after a failed read` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: youtube-error.png` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: youtube-recovered.png` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/frontend.spec.ts](../../../apps/frontend/e2e/frontend.spec.ts)

Модуль frontend.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `guestApi` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `publicPaths` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: registration requests an email instruction and stays signed out` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: disabled SMS stays hidden and a failed login offers an actionable error` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: password recovery displays the server instruction` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: local development API` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: administrator signs in with an HttpOnly cookie and can open the editor` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a regular member does not receive administrator controls` | 242 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: administrator creates, edits and deletes a draft through the real API` | 260 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/full-cache-audit.spec.ts](../../../apps/frontend/e2e/full-cache-audit.spec.ts)

Модуль full-cache-audit.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RouteCase` | 28 | Контракт типов. Подробности и ограничения — в исходнике. |
| `routes` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `setup` | 91 | Функция. Подробности и ограничения — в исходнике. |
| `navigate` | 167 | Функция. Подробности и ограничения — в исходнике. |
| `landmark` | 177 | Функция. Подробности и ограничения — в исходнике. |
| `settle` | 186 | Функция. Подробности и ограничения — в исходнике. |
| `test: quiz answers and the current question survive leaving and browser Back` | 434 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: every page route, product and legal slug is in the audit inventory` | 462 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: login fallback has no cached credential response` | 492 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/garden-tour-video.spec.ts](../../../apps/frontend/e2e/garden-tour-video.spec.ts)

Модуль garden-tour-video.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Mode` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `video` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `notice` | 40 | Функция. Подробности и ограничения — в исходнике. |
| `retry` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `ready` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `played` | 50 | Функция. Подробности и ограничения — в исходнике. |
| `test: keeps lazy native playback and the poster frame dimensions` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: leaving Home or hiding the document pauses playback without restarting it on return` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/guest-checkout-recovery.spec.ts](../../../apps/frontend/e2e/guest-checkout-recovery.spec.ts)

Модуль guest-checkout-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `slot` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `saved` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `action` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `result` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `user` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `startPurchase` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `deferred` | 46 | Функция. Подробности и ограничения — в исходнике. |
| `Input` | 53 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Order` | 59 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 64 | Функция. Подробности и ограничения — в исходнике. |
| `loseCheckout` | 211 | Функция. Подробности и ограничения — в исходнике. |
| `test: GUEST/NORMAL ignores a TEST return token and its stored journal` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a new guest purchase requires a phone before saving evidence or creating an order` | 250 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: malformed guest success retains both recovery keys and never grants access or sends a replacement` | 278 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: lost response and reload preserve proof; status never creates another order; manual replay restores its URL` | 302 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: notRecorded cannot rotate an unknown committed purchase` | 331 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: storage refusal prevents every checkout/status call and retains the entered email` | 360 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: 429 persists its pause through reload; time alone does not retry a password or purchase` | 381 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: login with the recipient resumes the guest purchase instead of preparing a NORMAL order` | 412 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: after login a notRecorded guest result keeps its proof and never starts a NORMAL replacement` | 433 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a terminal guest purchase is retained after login until an explicit fresh check hands off to NORMAL` | 456 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a different account cannot see the recipient, dispatch its proof, or receive a late payment URL` | 486 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: guest success does not log in or grant access; a fresh terminal check is required for a new recipient` | 523 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: missing evidence after an unknown result stays blocked, including subsequent manual checks` | 555 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a return without proof never creates a purchase and requires explicit confirmation before starting another` | 572 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: leaving checkout cancels a late redirect while keeping recovery evidence` | 589 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: two tabs share one guest intent without a loop of status requests` | 613 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a client timeout retains the keys and checks the committed order without reopening payment` | 663 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/guest-contact-fields.spec.ts](../../../apps/frontend/e2e/guest-contact-fields.spec.ts)

Модуль guest-contact-fields.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: club phone masks digits, accepts Russian pastes and supports editing` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/handoff-acceptance.spec.ts](../../../apps/frontend/e2e/handoff-acceptance.spec.ts)

Модуль handoff-acceptance.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: one recovered purchase opens club playback; account changes remove payment and media state` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/handoff-existing-flows.spec.ts](../../../apps/frontend/e2e/handoff-existing-flows.spec.ts)

Модуль handoff-existing-flows.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `person` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `receipt` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `deferred` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `register` | 179 | Функция. Подробности и ограничения — в исходнике. |
| `login` | 191 | Функция. Подробности и ограничения — в исходнике. |
| `wake` | 196 | Функция. Подробности и ограничения — в исходнике. |
| `test: 202 keeps registration and explicit resend without claiming delivery or a session` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: registration-accepted-mobile.png` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: SMTP refusal keeps fields and permits a deliberate registration retry` | 242 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: accepted password instructions stay separate from login and leave the old password usable` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the frontend password page reports completion and still requires a separate login` | 288 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: temporary post failure preserves confirmed content and does not manufacture absence` | 387 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: guest public discussion offers login without calling authenticated comments API` | 405 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: public-discussion-mobile.png` | 431 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: returning after an unknown save keeps recovery available before allowing another toggle` | 471 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/header-scroll.spec.ts](../../../apps/frontend/e2e/header-scroll.spec.ts)

Модуль header-scroll.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `headerSelector` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `screenSelector` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scrollTo` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `expectHidden` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `test: header slides out and back without moving content or the bottom menu` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: header-hidden.png` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: header-visible.png` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: navigation resets the header; horizontal and nested scrolling leave it alone` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: keyboard navigation reveals the header and focused controls stay accessible` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: reduced motion disables the slide while retaining direction behavior` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: clicking a header link does not pin it on the next screen` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native wheel scrolling drives the header in both directions` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: touch gestures` | 199 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native touch swipes drive the header in both directions` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/header-surface-scroll.spec.ts](../../../apps/frontend/e2e/header-surface-scroll.spec.ts)

Модуль header-surface-scroll.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `headerSelector` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scrollSelector` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: whole-header-visible.png` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: whole-header-hidden.png` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: quiz progress also scrolls away, leaving no fixed strip` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/home-promo-carousel.spec.ts](../../../apps/frontend/e2e/home-promo-carousel.spec.ts)

Модуль home-promo-carousel.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `banner` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `openHome` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `drag` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `touchSwipe` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `test: homepage promo mouse dragging` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: swipes both ways, wraps, and preserves normal clicks without extra controls` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: short drags and losing focus do not navigate; releasing outside still swipes` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: manual interaction cancels a pending automatic transition and restarts its interval` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: homepage promo touch swiping` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native finger swipes change slides in both directions and a fresh tap follows the link` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: vertical finger scrolling and cancelled swipes keep the selected slide` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/image-hung-response.spec.ts](../../../apps/frontend/e2e/image-hung-response.spec.ts)

Модуль image-hung-response.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `photoServer` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `test: timed-out.png` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: recovered.png` | 204 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/image-loading.spec.ts](../../../apps/frontend/e2e/image-loading.spec.ts)

Модуль image-loading.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `imageUrl` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `raster` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `imagesApi` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `refresh` | 521 | Функция. Подробности и ограничения — в исходнике. |
| `test: a delayed missing photo keeps its frame and shows a readable fallback` | 120 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: missing-photo.png` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a mounted photo outside the carousel viewport does not time out before scrolling` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a transient image error recovers automatically` | 292 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed photo retries after the connection returns` | 319 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: manual retry restores a viewer photo when optimized and original requests fail` | 418 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed optimized preview falls back to the original and waits for it` | 480 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: replacing a photo keeps its reserved frame and clears a previous failure` | 539 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: recreated cards reserve the same frame before reloading a landscape photo` | 605 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/interaction-fixture.ts](../../../apps/frontend/e2e/interaction-fixture.ts)

Adapt old synthetic account marks to a bounded response; no production fallback.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `interactionFixture` | 2 | Adapt old synthetic account marks to a bounded response; no production fallback. |

## [apps/frontend/e2e/layout-fixtures.ts](../../../apps/frontend/e2e/layout-fixtures.ts)

Модуль layout-fixtures.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `gotoWithSession` | 6 | Wait for client startup before interacting with server-rendered controls. |
| `layoutApi` | 19 | Browser-only data: layout checks must not start an API or write to a database. |

## [apps/frontend/e2e/legacy-checkout-guard.spec.ts](../../../apps/frontend/e2e/legacy-checkout-guard.spec.ts)

Модуль legacy-checkout-guard.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `testMode` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mode` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `slot` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `destination` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pay` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `form` | 45 | Функция. Подробности и ограничения — в исходнике. |
| `saved` | 57 | Функция. Подробности и ограничения — в исходнике. |
| `test: unknown checkout survives reload and cancellation sends no new request` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: another tab sees the same unknown request and cannot silently replace it` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unavailable storage blocks checkout before sending bytes` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/loading-feedback.spec.ts](../../../apps/frontend/e2e/loading-feedback.spec.ts)

Модуль loading-feedback.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: access checks have one centered indicator and checkout has one small indicator inside its button` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/local-recovery-notices.spec.ts](../../../apps/frontend/e2e/local-recovery-notices.spec.ts)

Модуль local-recovery-notices.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `notice` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `failQuizWrites` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `test: a shared session retry never accepts another tab's quiz or discards an unsaved answer` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a corrupted avatar uses the shared slot and a general retry never resets its stored copy` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/long-lists.spec.ts](../../../apps/frontend/e2e/long-lists.spec.ts)

Модуль long-lists.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `list` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `longListApi` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `loadAll` | 141 | Функция. Подробности и ограничения — в исходнике. |
| `test: old comment caches expire while a reply draft survives` | 425 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a completed native video releases its offscreen row and can be reopened` | 469 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: feed stops a repeated cursor, deduplicates posts and retries explicitly` | 633 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: windowing preserves the chosen photo and audio playback` | 708 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/media-failure-lifecycle.spec.ts](../../../apps/frontend/e2e/media-failure-lifecycle.spec.ts)

Модуль media-failure-lifecycle.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `embed` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `videoUrl` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `catalogEnabled` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: VK unloads in a hidden retained tab and never autoplays on return` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a denied club post response never requests a VK player` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed access refetch hides a previously loaded video instead of retaining stale playback` | 317 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: loaded VK keeps recovery controls away from the provider's interactive frame` | 387 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/media-performance.spec.ts](../../../apps/frontend/e2e/media-performance.spec.ts)

Модуль media-performance.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `photos` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `svg` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: a ten-photo carousel requests only adjacent slides and loads a distant slide on navigation` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: YouTube covers use our media route instead of the old production site` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: public feed cards and the viewer use bounded previews without fetching the original` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club previews are smaller WebP files served by the real image processor` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club-previews.png` | 204 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the image processor refuses private, signed and foreign sources before fetching` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/media-return.spec.ts](../../../apps/frontend/e2e/media-return.spec.ts)

Модуль media-return.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `svg` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `api` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `test: pattern revalidation retains unchanged images, replaces a new revision, and hides denied files` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: retained pattern images are removed across all panels when the session ends` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: long feeds still release distant rows and never replay a displayed photo's fade` | 266 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a hidden pattern page cancels a late initial read and starts cleanly on return` | 290 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the aesthetic guide keeps its confirmed body on return, stops hidden reads and removes denied content` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/media-upload-contract.spec.ts](../../../apps/frontend/e2e/media-upload-contract.spec.ts)

Модуль media-upload-contract.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `MAX_PHOTO_BYTES` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `coverUrl` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `setup` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `largePng` | 58 | Функция. Подробности и ограничения — в исходнике. |
| `test: article banner accepts the public cover receipt without publishing the article` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an original photo above 4 MiB is prepared within the server limit` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: transparent article PNG is resized/encoded within the limit with alpha preserved` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a rejected private video stays in the draft without publishing or exposing server details` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/member-access-email.spec.ts](../../../apps/frontend/e2e/member-access-email.spec.ts)

Модуль member-access-email.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `endpoint` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `card` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `fixtures` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `openMembers` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `send` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `unconfirmed` | 157 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: pending request excludes duplicates and other member writes; a late reply after tab change is not success` | 208 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: deadline retains an unknown outcome without retrying the request` | 248 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/migration-regressions.spec.ts](../../../apps/frontend/e2e/migration-regressions.spec.ts)

Модуль migration-regressions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ok` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `mockContent` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `test: a guest can open a public library article while club cards stay protected` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a library API failure offers retry and restores articles after recovery` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the patterns aesthetic action opens the quiz` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: checkout rejects executable URLs and keeps the guest on the club page` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a valid HTTPS checkout still opens its payment destination` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club payment return flags update on the client without granting guest access` | 216 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a subscribed member can open renewal and return to the club without reloading` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an authenticated payment return still asks the API before opening club access` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a long locked article can scroll to its club action on a small screen` | 321 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: nested dialogs isolate focus, close only the top window and restore the trigger` | 347 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/mobile-interactions.spec.ts](../../../apps/frontend/e2e/mobile-interactions.spec.ts)

Модуль mobile-interactions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `photos` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `video` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixtures` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `touch` | 63 | Функция. Подробности и ограничения — в исходнике. |
| `center` | 88 | Функция. Подробности и ограничения — в исходнике. |
| `test: touching and swiping a video card preserves its appearance and native scrolling; a fresh tap opens it` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: touch navigation cards do not scale or dim, and canceled movement cannot open a link` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a shelf touch has no press animation and a fresh tap still opens the product` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native horizontal photo swipes change the slide without opening the viewer, and a tap opens it` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: moving off a held action cancels its timer; a stationary hold retains the existing action` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a compatibility click after a moved touch is blocked, while the next tap and keyboard activation work` | 234 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: mouse press feedback and keyboard activation of actions remain available` | 272 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: small finger movement preserves a tap and a native file chooser in the editor` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: two-finger zoom in the pattern viewer and the following close tap still work` | 323 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/moderation-read-response.spec.ts](../../../apps/frontend/e2e/moderation-read-response.spec.ts)

Модуль moderation-read-response.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `report` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 21 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/navigation-cache.spec.ts](../../../apps/frontend/e2e/navigation-cache.spec.ts)

Модуль navigation-cache.spec.ts; объявления и смысловые границы перечислены ниже.

## [apps/frontend/e2e/navigation-layout.spec.ts](../../../apps/frontend/e2e/navigation-layout.spec.ts)

Модуль navigation-layout.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `headerSelector` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tabsSelector` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scrollSelector` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bottomNavigation` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `checkChrome` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `test: details, login, quiz, documents and missing pages all have an exit even when the API fails` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: back preserves actual app history across reload and forward, with a fallback at the initial entry` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: session loading and failure keep home, back and the sections available` | 290 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an external previous page is not used as the app's back destination` | 318 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the login screen's header back has a safe direct-entry fallback` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the same navigation remains mounted between sections and details, with the correct active section` | 345 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/normal-checkout-recovery.spec.ts](../../../apps/frontend/e2e/normal-checkout-recovery.spec.ts)

Модуль normal-checkout-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `slot` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `saved` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `action` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `startPurchase` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `deferred` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `result` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `defaultUser` | 40 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Order` | 48 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 53 | Функция. Подробности и ограничения — в исходнике. |
| `loseCheckout` | 188 | Функция. Подробности и ограничения — в исходнике. |
| `test: lost response and reload restore the same pending order; status does not create another one` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: two NORMAL tabs retain one key and one order for the same account` | 216 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: explicit recovery obtains the original payment URL with the same key and plan` | 285 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: notRecorded is a snapshot and never rotates the key after a late commit` | 299 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an existing paid subscription and payment return do not confirm the new pending purchase` | 316 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: succeeded uses this order's Date; an expired historical purchase does not open current club access` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed allows a deliberate new purchase only after fresh terminal verification` | 359 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: return without saved evidence does not create a purchase or infer success from active access` | 396 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late payment URL cannot navigate after leaving the purchase page` | 411 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an explicit check can recover after a navigation attempt without reviving its cancelled redirect` | 431 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late payment URL cannot enter the next account or bind its order` | 459 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: guests keep the existing checkout even when the NORMAL integration build is enabled` | 481 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a real client timeout retains one order and its key; checking afterwards never reopens payment` | 502 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: missing browser evidence cannot replace a known outstanding purchase even after a failed check` | 534 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/page-end-spacing.spec.ts](../../../apps/frontend/e2e/page-end-spacing.spec.ts)

Модуль page-end-spacing.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `data` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `ending` | 48 | Функция. Подробности и ограничения — в исходнике. |
| `test: the club list retains clearance above its overlaid section menu` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: safe-area growth reserves space in the menu without doubling the page gap` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a shorter viewport keeps the login inputs and final action reachable` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/password-setup.spec.ts](../../../apps/frontend/e2e/password-setup.spec.ts)

Модуль password-setup.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `token` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `secret` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `field` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `passwordField` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `save` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `test: a real expired-link response clears the form without granting a session` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: 429 preserves input but requires a manual retry after Retry-After` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: leaving the document clears its in-memory proof and password before a cached return` | 320 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/payment-mode-fixtures.ts](../../../apps/frontend/e2e/payment-mode-fixtures.ts)

Модуль payment-mode-fixtures.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `modeReturnToken` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `seedOtherPaymentModes` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `paymentModeSnapshots` | 30 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/payments-pagination.spec.ts](../../../apps/frontend/e2e/payments-pagination.spec.ts)

Модуль payments-pagination.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `payment` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `rows` | 134 | Функция. Подробности и ограничения — в исходнике. |
| `list` | 136 | Функция. Подробности и ограничения — в исходнике. |
| `scrollEnd` | 137 | Функция. Подробности и ограничения — в исходнике. |
| `refresh` | 141 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 158 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 162 | Функция. Подробности и ограничения — в исходнике. |
| `test: changing administrator starts a new history and discards the old pending page` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a confirmed club grant invalidates the new payment history cache` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a deleted boundary and a new payment do not skip old records; refresh starts a new chain` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed next page retains payments and retries the same cursor` | 251 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed refresh keeps all confirmed pages until a successful first-page retry` | 273 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: forbidden next page hides retained payment records` | 301 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: payment history does not poll, and a late page after changing tabs is discarded` | 317 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/photo-desktop-navigation.spec.ts](../../../apps/frontend/e2e/photo-desktop-navigation.spec.ts)

Модуль photo-desktop-navigation.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixtures` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `viewer` | 45 | Функция. Подробности и ограничения — в исходнике. |
| `centered` | 48 | Функция. Подробности и ограничения — в исходнике. |
| `mouseDrag` | 73 | Функция. Подробности и ограничения — в исходнике. |
| `test: desktop photo navigation` | 84 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: dragging changes the feed photo without opening it; a fresh click opens the selected photo` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: feed keeps its existing controls and keyboard navigation stops at both ends` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: viewer keys work immediately with focus on close, including Home/End and Escape` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: viewer arrows and mouse dragging work in both directions without moving the window` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a mouse drag released outside the album still finishes and restores clicking` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: losing the window cancels a held mouse drag and restores snapping` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: last photo stays centered after resize and repeated opening` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: single photo has no navigation controls` | 248 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: mobile photo gestures` | 266 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: desktop arrows stay hidden on touch screens` | 273 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native swipes, canceled diagonal gestures and downward dismissal` | 293 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-create-intent.spec.ts](../../../apps/frontend/e2e/post-create-intent.spec.ts)

Модуль post-create-intent.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uuid` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-draft-checkpoint.spec.ts](../../../apps/frontend/e2e/post-draft-checkpoint.spec.ts)

Модуль post-draft-checkpoint.spec.ts; объявления и смысловые границы перечислены ниже.

## [apps/frontend/e2e/post-draft-recovery.spec.ts](../../../apps/frontend/e2e/post-draft-recovery.spec.ts)

Модуль post-draft-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Mode` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `editor` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `field` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `submit` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `saved` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `choose` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `dialogs` | 57 | Функция. Подробности и ограничения — в исходнике. |
| `existing` | 65 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: drafts belong to the authenticated account and return only to their original owner` | 560 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: another tab cannot overwrite the newer draft or send a stale creation` | 591 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed local persistence blocks server writes and keeps input` | 617 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a corrupt draft is not overwritten or submitted and can be explicitly discarded` | 641 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a confirmed commit surviving local cleanup is finished without another server write` | 698 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: legacy version-one drafts remain readable with their selected file` | 732 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-editor-calendar.spec.ts](../../../apps/frontend/e2e/post-editor-calendar.spec.ts)

Модуль post-editor-calendar.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: calendar opens an independent scheduled club editor and a subsequent new post starts with its defaults` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-editor-keyboard.spec.ts](../../../apps/frontend/e2e/post-editor-keyboard.spec.ts)

Модуль post-editor-keyboard.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `keyboard` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `visibleInKeyboardViewport` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `test: keeps the editor and formatting controls above the keyboard without losing selection` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-editor-scroll.spec.ts](../../../apps/frontend/e2e/post-editor-scroll.spec.ts)

Модуль post-editor-scroll.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `scrollWithGesture` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `test: allows immediate input and scroll after automatic draft recovery while a pending save stays protected` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-editor-typing.spec.ts](../../../apps/frontend/e2e/post-editor-typing.spec.ts)

Модуль post-editor-typing.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `EditorWork` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MeasuredWindow` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-formatting.spec.ts](../../../apps/frontend/e2e/post-formatting.spec.ts)

Модуль post-formatting.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `text` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `firstUrl` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `secondUrl` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `select` | 12 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-inline-links.spec.ts](../../../apps/frontend/e2e/post-inline-links.spec.ts)

Модуль post-inline-links.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `tapLink` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `test: keeps taps aligned after native scrolling, resizing and inserting text` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-interactions.spec.ts](../../../apps/frontend/e2e/post-interactions.spec.ts)

Модуль post-interactions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `deferred` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `actions` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `test: confirmed likes read only their post and copy the server count into the retained feed` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed count refresh preserves the confirmed mark and recovers without replaying the mutation` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a post removed before the count read disappears from the cached feed` | 176 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a delayed count refresh cannot restore the previous account's cache` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an old account's pending response cannot change the new account's marks` | 346 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a recovery read cannot unlock a different write that failed after the read started` | 388 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a cancelled recovery read does not unlock an uncertain save with old cached data` | 432 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-management.spec.ts](../../../apps/frontend/e2e/post-management.spec.ts)

Модуль post-management.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `post` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `requests` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `menu` | 40 | Функция. Подробности и ограничения — в исходнике. |
| `test: an account change cancels a late quick-action inspection` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-pages-refresh.spec.ts](../../../apps/frontend/e2e/post-pages-refresh.spec.ts)

Модуль post-pages-refresh.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `list` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `setup` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `end` | 63 | Функция. Подробности и ограничения — в исходнике. |
| `loadThrough` | 68 | Функция. Подробности и ограничения — в исходнике. |
| `minute` | 74 | Функция. Подробности и ограничения — в исходнике. |
| `test: a club comment draft survives eviction of its page and return to the head` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/post-photo-layout.spec.ts](../../../apps/frontend/e2e/post-photo-layout.spec.ts)

Модуль post-photo-layout.spec.ts; объявления и смысловые границы перечислены ниже.

## [apps/frontend/e2e/post-upload-recovery.spec.ts](../../../apps/frontend/e2e/post-upload-recovery.spec.ts)

Модуль post-upload-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

## [apps/frontend/e2e/post-video-carousel.spec.ts](../../../apps/frontend/e2e/post-video-carousel.spec.ts)

Модуль post-video-carousel.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `bytes` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `vk` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `gallery` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `videos` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `carousel` | 99 | Функция. Подробности и ограничения — в исходнике. |
| `navigate` | 101 | Функция. Подробности и ограничения — в исходнике. |
| `test: desktop video carousel` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: resize preserves selection, photos stay separate, and drag never opens the post` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: one saved video retains its existing presentation without carousel controls` | 221 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: mobile video carousel` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native swipe changes previews, and overlay dots allow leaving an open VK player` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `swipe` | 257 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/private-pattern-assets.spec.ts](../../../apps/frontend/e2e/private-pattern-assets.spec.ts)

Модуль private-pattern-assets.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: retired public pattern originals are unavailable while public covers remain available` | 3 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/private-post-attachments.spec.ts](../../../apps/frontend/e2e/private-post-attachments.spec.ts)

Модуль private-post-attachments.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Mode` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `assetId` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `existing` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `field` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `submit` | 40 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `choose` | 68 | Функция. Подробности и ограничения — в исходнике. |
| `receipt` | 80 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/prodamus-return.spec.ts](../../../apps/frontend/e2e/prodamus-return.spec.ts)

Модуль prodamus-return.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `token` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `returned` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dialog` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 140 | Функция. Подробности и ограничения — в исходнике. |
| `test: TEST return ignores foreign checkout journals and only reads its own result` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: Prodamus TEST keeps its checkout endpoint even when the guest LIVE build flag is set` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: mail in the queue is not described as sent` | 295 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unconfirmed payment is never congratulated or granted access` | 307 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a signed-in paid member sees access without being sent to email` | 319 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: old paid flags alone do not query the new result or show success` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed mail delivery does not promise an email or another charge` | 350 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: closing while the result is delayed discards its late reply` | 365 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: rate limiting prevents an immediate new status request` | 397 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: another signed-in account is not granted the receipt owner's access` | 422 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/profile-cache.spec.ts](../../../apps/frontend/e2e/profile-cache.spec.ts)

Модуль profile-cache.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `savedPost` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `test: switching accounts clears a hidden profile and its unsaved state` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/profile-consistency.spec.ts](../../../apps/frontend/e2e/profile-consistency.spec.ts)

Модуль profile-consistency.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `barrier` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `profileApi` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `chooseAvatar` | 744 | Функция. Подробности и ограничения — в исходнике. |
| `checkAvatar` | 754 | Функция. Подробности и ограничения — в исходнике. |
| `retryAvatar` | 756 | Функция. Подробности и ограничения — в исходнике. |
| `avatarJournal` | 758 | Функция. Подробности и ограничения — в исходнике. |
| `test: name changes require an explicit save and supersede a delayed pre-write session read` | 217 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: setup-unknown-result.png` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a rejected setup keeps an editable draft across reload and never trusts the old completed flag` | 317 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: large-avatar.jpg` | 404 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an avatar above 50 MiB is rejected before cropping or uploading` | 437 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: oversized-avatar.jpg` | 441 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed photo upload retains a labeled draft and never changes name or the confirmed avatar` | 461 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: photo-upload-error.png` | 489 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: portrait avatar crop contains photo pixels across the full square` | 508 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late name ACK cannot replace a different account` | 554 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed avatar cropping retains the selection and retries without uploading the original` | 602 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: avatar crop error keeps retry and cancel reachable in a short viewport` | 698 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: damaged avatar journal` | 764 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `damaged` | 773 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `test: downloads the exact copy, respects cancel and enables an explicit new upload after checking the profile` | 785 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: keeps a recoverable receipt key locked while its upload is pending` | 821 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: checks the damaged replacement's receipt even when an older intent remains in memory` | 853 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed profile check does not remove the damaged record` | 893 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: does not remove a valid replacement installed during the profile check` | 959 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an account switch cancels reset without clearing the previous owner's record` | 999 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed local removal keeps reset available and the picker locked` | 1036 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: avatar receipt recovery` | 1060 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a lost committed response survives reload and is checked without uploading again` | 1061 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a ready receipt discovered on retry avoids a second upload` | 1112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an old ready receipt reads the current profile without reapplying the old avatar` | 1132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: status 503 preserves the intent and prevents a blind retry` | 1154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a conflict stops retries and allows only an explicit new photo` | 1172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an invalid ready receipt keeps recovery available` | 1198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: storage failure blocks upload until the exact draft can be saved` | 1216 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: another account never sees or sends the previous owner's pending photo` | 1254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a delayed avatar response cannot update the next account` | 1278 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: name editor closes on the first click beside the input and retains an unsaved draft` | 1323 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a stale name revision preserves the draft and needs an explicit reviewed retry` | 1351 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: closing and reopening a name draft never upgrades its original revision` | 1514 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: missing profile revision blocks a write independently of storage errors` | 1622 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed review confirmation keeps saving blocked and the persisted comparison intact` | 1644 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/profile-saved-access.spec.ts](../../../apps/frontend/e2e/profile-saved-access.spec.ts)

Модуль profile-saved-access.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `post` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `openPost` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bothPost` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `clubPost` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `State` | 26 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `card` | 137 | Функция. Подробности и ограничения — в исходнике. |
| `test: an unpaid member opens saved public posts without opening club-only content` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: public-saved.png` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: saved photo and article cards have content names and independent keyboard destinations` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: subscription lookup failure does not lock public bookmarks or claim an absent subscription` | 249 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: revoked access hides a retained club bookmark snapshot without hiding public ones` | 270 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unpaid member can retry a failed bookmarks read` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a guest still needs login before seeing saved posts` | 308 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/pwa-manifest.spec.ts](../../../apps/frontend/e2e/pwa-manifest.spec.ts)

Модуль pwa-manifest.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: the page links to a standalone manifest with decodable 192/512 PNG icons` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/quiz-multitab.spec.ts](../../../apps/frontend/e2e/quiz-multitab.spec.ts)

Модуль quiz-multitab.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `progressKey` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `resultKey` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stored` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `continueSaved` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `firstAnswer` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `secondAnswer` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `completedResult` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `openQuiz` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `startQuiz` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `test: an old result cannot restart over another tab's new progress` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a stale last-question tab cannot finish or overwrite a newer run` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late answer from a stale tab cannot replace the newer question` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: legacy progress upgrades on the next explicit answer without losing earlier answers` | 177 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/quiz-result-persistence.spec.ts](../../../apps/frontend/e2e/quiz-result-persistence.spec.ts)

Модуль quiz-result-persistence.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `runId` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `title` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `answers` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scores` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `StorageOperation` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `TraceWindow` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `lastQuestion` | 98 | Функция. Подробности и ограничения — в исходнике. |
| `resultVisible` | 119 | Функция. Подробности и ограничения — в исходнике. |
| `operations` | 132 | Функция. Подробности и ограничения — в исходнике. |
| `rawResult` | 134 | Функция. Подробности и ограничения — в исходнике. |
| `test: legacy progress completes without inventing run metadata or duplicating the write` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed required write retains the old result and recoverable answers without a second writer` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a complete guest journey saves once and restarting creates a new run` | 258 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/quiz-result-sync.spec.ts](../../../apps/frontend/e2e/quiz-result-sync.spec.ts)

Модуль quiz-result-sync.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `cottage` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `castle` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `goblin` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `resultKey` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `progressKey` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `TraceWindow` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `saved` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `setup` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `setResult` | 77 | Функция. Подробности и ограничения — в исходнике. |
| `shown` | 90 | Функция. Подробности и ограничения — в исходнике. |
| `start` | 92 | Функция. Подробности и ограничения — в исходнике. |
| `writes` | 94 | Функция. Подробности и ограничения — в исходнике. |
| `stored` | 96 | Функция. Подробности и ограничения — в исходнике. |
| `openResult` | 98 | Функция. Подробности и ограничения — в исходнике. |
| `answerCottagecore` | 194 | Функция. Подробности и ограничения — в исходнике. |
| `test: a retained result refreshes when returning from another application section` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a new blended result resets the previous secondary-aesthetic selection` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: external results preserve a restart and in-progress answers, then sync after successful completion` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a completed result that failed to save stays in memory when another tab changes storage` | 260 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: only the active account's result is read after an account switch` | 293 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/read-response-validation.spec.ts](../../../apps/frontend/e2e/read-response-validation.spec.ts)

Модуль read-response-validation.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: article detail rejects malformed blocks and recovers without a render crash` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: statistics reject incompatible counters and calendar rejects invalid cards` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/real-checkout.spec.ts](../../../apps/frontend/e2e/real-checkout.spec.ts)

Модуль real-checkout.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Fixture` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Mode` | 31 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Intent` | 32 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Write` | 38 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `connection` | 40 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `forbidden` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `extraContexts` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `slot` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `endpoint` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `rows` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `stored` | 53 | Функция. Подробности и ограничения — в исходнике. |
| `pay` | 55 | Функция. Подробности и ограничения — в исходнике. |
| `notice` | 57 | Функция. Подробности и ограничения — в исходнике. |
| `restore` | 59 | Функция. Подробности и ограничения — в исходнике. |
| `prepare` | 102 | Функция. Подробности и ограничения — в исходнике. |
| `login` | 138 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 148 | Функция. Подробности и ограничения — в исходнике. |
| `input` | 162 | Функция. Подробности и ограничения — в исходнике. |
| `loseReply` | 170 | Функция. Подробности и ограничения — в исходнике. |
| `pending` | 209 | Функция. Подробности и ограничения — в исходнике. |
| `exactlyOneOrder` | 212 | Функция. Подробности и ограничения — в исходнике. |
| `ordered` | 364 | Функция. Подробности и ограничения — в исходнике. |
| `test: GUEST: login recovers its existing order without starting a NORMAL purchase` | 335 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/real-content-editors.spec.ts](../../../apps/frontend/e2e/real-content-editors.spec.ts)

Модуль real-content-editors.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Fixture` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `connection` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `extraContexts` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sessions` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `original` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `articleOriginal` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Mode` | 33 | Контракт типов. Подробности и ограничения — в исходнике. |
| `text` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `title` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `compare` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `accept` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `save` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `rows` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `prepare` | 104 | Функция. Подробности и ограничения — в исходнике. |
| `login` | 121 | Функция. Подробности и ограничения — в исходнике. |
| `logout` | 141 | Функция. Подробности и ограничения — в исходнике. |
| `otherPage` | 151 | Функция. Подробности и ограничения — в исходнике. |
| `openPost` | 161 | Функция. Подробности и ограничения — в исходнике. |
| `openArticle` | 197 | Функция. Подробности и ограничения — в исходнике. |
| `writes` | 211 | Функция. Подробности и ограничения — в исходнике. |
| `rejectMissingRevision` | 225 | Функция. Подробности и ограничения — в исходнике. |
| `loseNextAck` | 232 | Функция. Подробности и ограничения — в исходнике. |
| `storedOperation` | 254 | Функция. Подробности и ограничения — в исходнике. |
| `openTags` | 593 | Функция. Подробности и ограничения — в исходнике. |
| `test: article: real 409, reload and file recovery preserve bytes and reuse the uploaded asset` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article: a committed write with a lost ACK is confirmed without another mutation` | 544 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article: actual 412 and account switch preserve ownership of unsaved input` | 565 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: tags: real 409 requires review before replacing another admin's version` | 606 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: tags: actual 412 preserves selection; the next account receives only its own draft` | 642 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: tags: a lost ACK is confirmed by real detail without another mutation` | 682 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/real-recovery.spec.ts](../../../apps/frontend/e2e/real-recovery.spec.ts)

Модуль real-recovery.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Fixture` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `connection` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicOrigin` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `adminSlot` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `contexts` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sessions` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `query` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `prepare` | 76 | Функция. Подробности и ограничения — в исходнике. |
| `login` | 95 | Функция. Подробности и ограничения — в исходнике. |
| `other` | 111 | Функция. Подробности и ограничения — в исходнике. |
| `saved` | 121 | Функция. Подробности и ограничения — в исходнике. |
| `members` | 123 | Функция. Подробности и ограничения — в исходнике. |
| `memberAction` | 130 | Функция. Подробности и ограничения — в исходнике. |
| `start` | 138 | Функция. Подробности и ограничения — в исходнике. |
| `status` | 139 | Функция. Подробности и ограничения — в исходнике. |
| `replay` | 144 | Функция. Подробности и ограничения — в исходнике. |
| `effects` | 149 | Функция. Подробности и ограничения — в исходнике. |
| `title` | 290 | Функция. Подробности и ограничения — в исходнике. |
| `saveVideo` | 292 | Функция. Подробности и ограничения — в исходнике. |
| `checkVideo` | 294 | Функция. Подробности и ограничения — в исходнике. |
| `video` | 299 | Функция. Подробности и ограничения — в исходнике. |
| `test: VK: real concurrent revisions preserve the losing draft through reload and manual reconciliation` | 315 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: VK: a lost committed ACK retains the original revision; matching SQL detail is not claimed as success` | 353 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: VK: switching administrator does not apply a previous draft` | 384 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/report-block-permission.spec.ts](../../../apps/frontend/e2e/report-block-permission.spec.ts)

Модуль report-block-permission.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `report` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `block` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 61 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/request-layout-and-navigation.spec.ts](../../../apps/frontend/e2e/request-layout-and-navigation.spec.ts)

Модуль request-layout-and-navigation.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `menu` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `centeredError` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `test: request-state-bounds` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: request-state-bounds.png` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a delayed tab transition gives feedback without shifting the menu or waiting for API data` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/saved-post-previews.spec.ts](../../../apps/frontend/e2e/saved-post-previews.spec.ts)

Модуль saved-post-previews.spec.ts; объявления и смысловые границы перечислены ниже.

## [apps/frontend/e2e/scroll-top-position.spec.ts](../../../apps/frontend/e2e/scroll-top-position.spec.ts)

Модуль scroll-top-position.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `scrollArea` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `topButton` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `fixtures` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `ending` | 87 | Функция. Подробности и ограничения — в исходнике. |
| `clearance` | 109 | Функция. Подробности и ограничения — в исходнике. |
| `test: floating-controls.png` | 214 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/security-hardening.spec.ts](../../../apps/frontend/e2e/security-hardening.spec.ts)

Модуль security-hardening.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: document CSP permits hydration, changes per response and blocks injected inline scripts` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: guests cannot request club downloads and the free collection retains its link` | 131 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/session-safety.spec.ts](../../../apps/frontend/e2e/session-safety.spec.ts)

Модуль session-safety.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `Member` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `failure` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `mockApp` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `enter` | 114 | Функция. Подробности и ограничения — в исходнике. |
| `rememberScreen` | 580 | Функция. Подробности и ограничения — в исходнике. |
| `returnToWindow` | 612 | Функция. Подробности и ограничения — в исходнике. |
| `test: a delayed initial session check cannot undo a successful login` | 120 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: switching people cannot transfer local profile or quiz data` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: failed logout hides private UI and survives reload until confirmed` | 229 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: session network failure offers retry rather than claiming the person is a guest` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: native form submission never puts credentials in the URL` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: email rate limiting prevents immediate repeated submissions` | 301 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: malformed session data is shown as a recoverable response error` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: video API errors offer retry and preserve a real not-found state` | 342 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: malformed content IDs do not cause API calls` | 371 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: subscription failure does not become a confirmed absent subscription` | 388 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an expired session closes private data after a protected query returns 401` | 405 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an HTML 401 from a protected query closes private data through the session recheck` | 427 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: logout is reflected in another tab` | 454 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: late registration completion cannot redirect a screen the user left` | 484 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a temporary session check failure preserves an administrator's unsaved text` | 515 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a string subscription flag never grants club access` | 546 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a guest's club scroll survives a failed background check and retry` | 661 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: background-session-warning.png` | 715 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a confirmed subscription revocation still removes the private club screen` | 784 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a subscription permission denial never keeps the previously active club visible` | 825 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a 401 during an offline session recheck still closes the profile` | 850 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/shop-manager-order.spec.ts](../../../apps/frontend/e2e/shop-manager-order.spec.ts)

Модуль shop-manager-order.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `configuration` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `orderLink` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `orderError` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `fixtures` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `digitalProducts` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: loading a manager contact keeps ordering disabled until validation completes` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed refresh disables an old recipient and a retry uses the updated one` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a paused refresh hides a cached recipient until connectivity returns` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: returning from a cancelled letter keeps the card available and refreshes the contact` | 244 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/stage-one-frontend-readiness.spec.ts](../../../apps/frontend/e2e/stage-one-frontend-readiness.spec.ts)

Модуль stage-one-frontend-readiness.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `entry` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `pixel` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `test: private library delivery` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: private patterns use protected media and close the viewer on logout` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: guests request neither the list nor original pattern images` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed private list has retry and never opens Yandex as a fallback` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: library-files-mobile.png` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: Petersburg hides old links during access checks and closes on logout` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article: an unavailable upload keeps the editor retryable without a pending creation` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: comment: an unavailable photo upload keeps selection and allows another send` | 340 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/stage-one-regressions.spec.ts](../../../apps/frontend/e2e/stage-one-regressions.spec.ts)

Модуль stage-one-regressions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `photo` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `png` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `test: canonical uploaded photo stays visible in feed and detail` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unpaid member can log out while public bookmarks remain available` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: newly published old draft permits comments in detail and club` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article viewer opens the clicked cover and body photo` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: article teaser grid links to the full article` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club editor preserves both audience and saves an explicit club restriction` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: saved article teaser opens the full article` | 292 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/static-image-cache.spec.ts](../../../apps/frontend/e2e/static-image-cache.spec.ts)

Модуль static-image-cache.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `sha256` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `test: all imported originals and public derivatives have intact bytes and immutable caching` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: original-detail.png` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: dense displays` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: artwork-3x.png` | 177 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/status-notice-layout.spec.ts](../../../apps/frontend/e2e/status-notice-layout.spec.ts)

Модуль status-notice-layout.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `catalogEnabled` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `outsideNavigation` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `test: notice-layout.json` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an unknown route keeps its standalone 404 notice and home link inside the viewport` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: not-found.png` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed subscription on Club keeps retry between the header and tabs` | 172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a page render error keeps its recovery action below the header` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a malformed initial list is rejected before rendering and retry stays reachable` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a failed admin list keeps retry reachable after its toolbars` | 266 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a narrow file dialog keeps its message, retry and close action usable` | 333 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: file-error-dialog.png` | 380 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/subscription-cancellation.spec.ts](../../../apps/frontend/e2e/subscription-cancellation.spec.ts)

Модуль subscription-cancellation.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `expiration` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `cancelButton` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `checkButton` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `card` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `unknownNotice` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `deferred` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 114 | Функция. Подробности и ограничения — в исходнике. |
| `cancel` | 118 | Функция. Подробности и ограничения — в исходнике. |
| `test: transport failure can be checked without sending another cancellation` | 261 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a timed-out cancellation blocks another write until status is checked` | 281 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a pending status check cannot be duplicated or turn into another write` | 316 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unknown-320.png` | 325 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unauthorized cancellation rechecks the session and hides private UI` | 352 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an ok response still needs confirmation from subscription` | 393 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: rate limiting allows an explicit retry after a known refusal` | 468 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: leaving the profile aborts verification and retains the uncertain write` | 487 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late response cannot change another account's subscription` | 524 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: background confirmation clears uncertainty before a later subscription period` | 570 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: confirmed expiration closes private access without extending its period` | 603 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/subscription-expiry.spec.ts](../../../apps/frontend/e2e/subscription-expiry.spec.ts)

Модуль subscription-expiry.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: an open club screen rechecks an expired paid period without requiring navigation` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: the supported FLAC container decodes and plays` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/tab-music-toggle.spec.ts](../../../apps/frontend/e2e/tab-music-toggle.spec.ts)

Модуль tab-music-toggle.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `message` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MusicWindow` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `silentWav` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `setup` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `media` | 53 | Функция. Подробности и ограничения — в исходнике. |
| `test: music loading respects reduced motion and a stalled start becomes an error` | 201 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/tab-return.spec.ts](../../../apps/frontend/e2e/tab-return.spec.ts)

Модуль tab-return.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `tab` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `scroll` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `observeEntrances` | 86 | Функция. Подробности и ограничения — в исходнике. |
| `test: a newly opened tab has its layout styles in its first content frame` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: video heading and static library cards stay in place while API requests finish` | 191 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: returning to a stale tab refreshes the API without clearing its search or cached cards` | 232 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a hidden club never processes another page's paid flag and retained state clears on session change` | 290 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/thumbnail-sizes.spec.ts](../../../apps/frontend/e2e/thumbnail-sizes.spec.ts)

Модуль thumbnail-sizes.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `photo` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/video-catalog.spec.ts](../../../apps/frontend/e2e/video-catalog.spec.ts)

Модуль video-catalog.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `embed` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `thumbnailsEnabled` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `thumbnailOptIn` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `card` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `user` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `deferred` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `authorityReads` | 155 | Функция. Подробности и ограничения — в исходнике. |
| `dispatchResume` | 161 | Функция. Подробности и ограничения — в исходнике. |
| `prepareReturnClock` | 169 | Функция. Подробности и ограничения — в исходнике. |
| `catalogCards` | 524 | Функция. Подробности и ограничения — в исходнике. |
| `catalogReads` | 526 | Функция. Подробности и ограничения — в исходнике. |
| `catalogScroll` | 530 | Функция. Подробности и ограничения — в исходнике. |
| `catalogPages` | 533 | Функция. Подробности и ограничения — в исходнике. |
| `loadCatalog` | 544 | Функция. Подробности и ограничения — в исходнике. |
| `settleCatalogVisibility` | 554 | Функция. Подробности и ограничения — в исходнике. |
| `pullCatalog` | 572 | Функция. Подробности и ограничения — в исходнике. |
| `openAdmin` | 1226 | Функция. Подробности и ограничения — в исходнике. |
| `fillAdmin` | 1233 | Функция. Подробности и ограничения — в исходнике. |
| `test: playback return: quick hide and window blur require fresh authority within the same second` | 305 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: playback return: a late previous check cannot restore a source after a newer denial` | 363 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: catalog does not prefetch any source and paginates without duplicate cards` | 457 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: catalog-mobile.png` | 504 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: repeated cursor stops pagination and offers a fresh read` | 506 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: polling reads only the head and visible page; revisiting refreshes stale edits and deletions` | 590 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: a hidden screen and a hidden document do not poll; return refreshes the visible page` | 653 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: failed manual refresh retains all cards; success restarts and refetches the tail` | 705 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: a cached next-page error stays a pagination error and never restores stale cards` | 734 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: more than eight pages release old cards and return to an evicted page` | 766 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: a changed boundary discards disconnected pages and loads the new cursor` | 851 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: a visible-page refresh error preserves confirmed cards and can be recovered` | 889 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: bounded catalog: an old account's late page cannot enter the guest catalog` | 916 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: canWatch false still asks playback and accepts current authorization` | 983 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a source waits for a successful playback response` | 1018 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: wrong playback identity never loads a provider` | 1034 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: club YouTube does not use the anonymous public worker` | 1043 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: public YouTube retains its public video worker` | 1064 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: authorized file uses a native player and releases its source on pagehide` | 1082 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: retrying a failed club file requires fresh playback authority before another media request` | 1101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: reloading a VK player requires fresh authority before restoring its iframe` | 1134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: pageshow requires new authority and keeps an old iframe removed` | 1178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a late source cannot cross an account change` | 1197 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: admin creates an exact VK payload without an ID or provider preview` | 1250 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: vk-admin-mobile.png` | 1273 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: admin never converts a rejected YouTube detail into a VK update` | 1276 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: unknown admin result keeps original fields and retries the same payload` | 1296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: admin rejects unknown export parameters before POST` | 1323 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: old API mode does not expose cover writes` | 1333 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: documented thumbnail save contract` | 1341 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: thumbnail-admin-mobile.png` | 1373 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: thumbnail-admin-desktop.png` | 1378 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: an invalid or whitespace cover remains editable without sending a write` | 1415 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: loss of a create response preserves the exact cover payload for explicit replay` | 1460 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: catalog covers support old and new pages without changing card geometry or fetching playback` | 1506 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: catalog-covers-mobile.png` | 1604 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: catalog-covers-desktop.png` | 1609 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/videos-scroll.spec.ts](../../../apps/frontend/e2e/videos-scroll.spec.ts)

Модуль videos-scroll.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: videos scroll to the last card and retain their position on return` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/vk-catalog-revisions.spec.ts](../../../apps/frontend/e2e/vk-catalog-revisions.spec.ts)

Модуль vk-catalog-revisions.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `embed` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `initial` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `title` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `save` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `check` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `newState` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `fixtures` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 97 | Функция. Подробности и ограничения — в исходнике. |
| `load` | 104 | Функция. Подробности и ограничения — в исходнике. |
| `reconcile` | 116 | Функция. Подробности и ограничения — в исходнике. |
| `test: two administrators preserve the losing draft and explicitly reconcile before another update` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a committed lost ACK survives reload; matching detail is not proof of this write` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: 412 loads a fresh detail and cannot update the original revision implicitly` | 221 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: nullable embed is accepted but saving requires an explicit valid export link` | 273 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: quota failure keeps the typed draft visible and blocks the write` | 299 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: next editing rereads detail and uses the new revision` | 356 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/vk-editor.spec.ts](../../../apps/frontend/e2e/vk-editor.spec.ts)

Модуль vk-editor.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `link` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `savedLink` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/e2e/vk-video.spec.ts](../../../apps/frontend/e2e/vk-video.spec.ts)

Модуль vk-video.spec.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `embed` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `test: vk-mobile.png` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: a direct video file retains the native player` | 248 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: optional public VK playback advances in the embedded provider player` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: vk-public-playing.png` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/access-policy.test.ts](../../../tests/access-policy.test.ts)

Модуль access-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `state` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `describe: blocked identity is denied on every access path` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not give blocked %s club access` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies admin routes to a blocked administrator` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies moderation routes to a blocked moderator` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose club detail via public procedure to blocked subscriber` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose club notification text to blocked subscriber` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report a blocked subscriber as subscribed` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: locks article body for blocked subscriber` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hides unpublished post (published=%s, status=%s)` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps published club detail available to an active subscriber` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: public articles do not require a subscription` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose %s body or attachments through saved posts` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose %s discussion by guessing a post ID` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/access-urls.test.ts](../../../tests/access-urls.test.ts)

Модуль access-urls.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `application` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requestWithBrowserMetadata` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `it: redirects old email links from %s without issuing a session` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still rejects cross-site $name` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not grant foreign origins CORS access to the password document` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: redirects to the configured frontend without trusting query or legacy auth origins` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails safely for an unsafe configured frontend %s` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the frontend for setup and login without retaining configured paths or queries` | 200 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: supports local HTTP in development, but never another local scheme` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects credentials in the mail-link origin without exposing their value` | 219 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/account-deletion-actor.mysql.test.ts](../../../tests/account-deletion-actor.mysql.test.ts)

Модуль account-deletion-actor.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: account deletion actor and replay guards` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an in-flight deletion after $change changes` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the first deletion date on replay instead of postponing retention` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mark an already retired account for deletion again` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: records a current user's request while preserving the account and neighbor` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: queues only the owner's active billing profile and preserves the retry schedule` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a guest without changing either account` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/account-retention.mysql.test.ts](../../../tests/account-retention.mysql.test.ts)

Модуль account-retention.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: account retention on disposable MySQL` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanupBindings` | 81 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanupRecoveryContent` | 86 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `recoveryFixture` | 96 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: erases retired recovery ownership but preserves bound evidence and neighbor records` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps recovery links intact on %s retirement` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retires all private receipts across bounded batches without skipping moved keys` | 150 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps retired orphan evidence without recreating an owner marker during local compaction` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `contentSnapshot` | 178 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: refuses stale pre-retirement RPC context for %s before any content effect` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `queueBinding` | 212 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `bindingRows` | 223 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: cancels and scrubs pending email proofs in the account deletion transaction` | 226 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back proof scrubbing together with a failed account deletion` | 236 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves legacy deletion before both binding tables are installed` | 246 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses partial binding schemas without partially deleting an account` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the account and proof when cancellation audit fails` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `snapshot` | 278 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rolls back every scrub operation when the final account update fails` | 293 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: revokes the pre-deletion actor epoch so an already authenticated upload cannot resume` | 303 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: scrubs password proofs and fences queued access mail without erasing billing evidence` | 313 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: queues cancellation for an existing deletion request before the paid period ends` | 333 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: continues with a healthy deletion and expired Pen Pals after a separate account fails` | 346 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: clears the unverified checkout contact when an eligible account is anonymized` | 365 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: completes eligible scrubbing once and retains the discussion structure` | 374 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves %s accounts` | 385 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: two workers count an eligible account only once` | 395 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks a renewal committed while cleanup waits for the billing owner lock` | 399 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: native maintenance lifecycle and HTTP deletion requests` | 427 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves existing retention rules for %s` | 430 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers atomic account cleanup on the next maintenance tick after a SQL failure` | 486 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-action-recovery.mysql.test.ts](../../../tests/admin-action-recovery.mysql.test.ts)

Модуль admin-action-recovery.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: durable admin actions through HTTP and disposable SQL` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 29 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `trpc` | 100 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `resend` | 130 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: replays one grant across concurrent/lost responses and returns its committed expiry` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers %s after a relay drops the real committed HTTP response` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the expiry actually committed by MySQL for a previously expired account` | 251 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: conflicts on changed target or action and never leaks another actor's receipt` | 261 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays the original mail enqueue even after delivery without sending a second mail` | 275 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists a business rejection without replaying it after the target becomes available` | 314 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back a failed effect and permits retry with the same key` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back both effects when saving the receipt fails` | 350 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a rejected email intent rejected after access is restored` | 378 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: status polling never adds grants, mail or audit records` | 397 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the existing hourly mail limit for new and repeated keys` | 418 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks actor rights for both replay and status` | 429 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows a moderator's keyed mail but refuses a moderator's grant` | 438 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed keys before any effect` | 444 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-article-page.mysql.test.ts](../../../tests/admin-article-page.mysql.test.ts)

Модуль admin-article-page.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: admin article cards/detail over HTTP/JWT/MySQL` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pages 51 equal-date draft cards without reading sections into Node` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps sort-order traversal after anchor deletion and a new earlier card` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads only a selected full draft for admin and rejects other roles/cursors` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-membership-reads.mysql.test.ts](../../../tests/admin-membership-reads.mysql.test.ts)

Модуль admin-membership-reads.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: admin membership read projections on disposable MySQL` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the same safe member fields and newest-account order over native HTTP` | 84 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses only the latest future paid expiry rather than later pending or failed rows` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report an expiry exactly at now or a paid row without expiry as current access` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves payment history statuses, newest-first ordering and the default 50-row limit` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-payments-page.mysql.test.ts](../../../tests/admin-payments-page.mysql.test.ts)

Модуль admin-payments-page.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: payment history over real HTTP/JWT/disposable MySQL` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `payment` | 12 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: reads all %i equal-time payments once without the old 50-row ceiling` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: continues after deletion of the anchor and a newer payment arriving` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: enforces the 50 limit and admin-scoped cursor without changing payments` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-post-detail-types.test.ts](../../../tests/admin-post-detail-types.test.ts)

Модуль admin-post-detail-types.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: represents a missing admin post as null through the server and generated client contract` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-post-page-input.test.ts](../../../tests/admin-post-page-input.test.ts)

Модуль admin-post-page-input.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: admin post page transport input` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the forward direction sent by the infinite-query client` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps direct queries without a direction compatible` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported direction %s instead of reversing the cursor` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still rejects unknown pagination fields` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-publication.test.ts](../../../tests/admin-publication.test.ts)

Модуль admin-publication.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `state` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `describe: publication notification follows successful persistence` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not send a publication notification when the post write fails` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects $change edits of a missing post without announcing success` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not notify before associated video updates succeed` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for the pending write and notifies only after it resolves` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the changed text and audience after the last successful write` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reannounce an already published post` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not notify on draft edits or scheduling` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/admin-statistics.mysql.test.ts](../../../tests/admin-statistics.mysql.test.ts)

Модуль admin-statistics.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bounded admin statistics on disposable MySQL` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts a 742-post archive without transferring it into Node` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps zero counters and no leaders for an empty archive` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the process-local month boundary rather than UTC date truncation` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/aesthetic-content-fidelity.test.ts](../../../tests/aesthetic-content-fidelity.test.ts)

Модуль aesthetic-content-fidelity.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: paid aesthetic content move` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves every original paid field for %s` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/aesthetic-guides.mysql.test.ts](../../../tests/aesthetic-guides.mysql.test.ts)

Модуль aesthetic-guides.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: protected aesthetic guides: native HTTP/JWT/SQL` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `read` | 58 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: returns only five paid sections for %s` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies guest/invalid/unpaid %s without content` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects noncanonical key/query %s` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks live identity after %s` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks expiry, preserves paid-until-end cancellation and service access` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn infrastructure failure into guest or disclose internals` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HEAD checks access and sends no paid body` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/ajv-dependency.test.ts](../../../tests/ajv-dependency.test.ts)

Модуль ajv-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `lintRequire` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Ajv` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: reports invalid runtime pattern %s as validation failure` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary lint-style schemas and valid dynamic patterns` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-contract-output.test.ts](../../../tests/api-contract-output.test.ts)

Модуль api-contract-output.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `run` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `directory` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `output` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontend` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `original` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: exports and checks a handoff artifact without writing the frontend contract` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-coordination-config.test.ts](../../../tests/api-coordination-config.test.ts)

Модуль api-coordination-config.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: preserves one local process by default` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires shared coordination for more than one API` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid count %s` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not silently fall back for an unknown mode` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses multi-process legacy SMS because its code-verification quota is local` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unsafe app configuration before creating a listener` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-coordination.mysql.test.ts](../../../tests/api-coordination.mysql.test.ts)

Модуль api-coordination.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: shared API coordination on owned MySQL` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `replica` | 55 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: shares one fixed-window quota between independent OS processes` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: enforces the original HTTP login IP quota across two real API listeners` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: atomically admits only the shared quota during a concurrent burst` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shares account cooldown independently of IP/process` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not clear a newer reservation when an earlier login succeeds` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not let an old successful login clear a new window with the same attempt number` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: resets expired windows, retains live quotas and bounds counter growth` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not begin a worker on another replica until the holder finishes` | 206 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: releases the worker lock when its process dies or callback throws` | 214 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed when the common table is missing, then recovers` | 233 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-error-privacy.test.ts](../../../tests/api-error-privacy.test.ts)

Модуль api-error-privacy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `server` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not return internal SQL/credentials or stack traces to API callers` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves actionable validation errors without exposing a stack` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-graceful-shutdown.mysql.test.ts](../../../tests/api-graceful-shutdown.mysql.test.ts)

Модуль api-graceful-shutdown.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: real executable shutdown` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops accepting requests and preserves the in-flight upload on %s` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-load-cli.test.ts](../../../tests/api-load-cli.test.ts)

Модуль api-load-cli.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: local load CLI preflight` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses inherited working configuration before Docker/SQL without printing it` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-load-policy.test.ts](../../../tests/api-load-policy.test.ts)

Модуль api-load-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `id` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `owner` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uri` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: local load target and measurement safety` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts only the exact labelled loopback tmpfs fixture` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses tail latency and counts failures rather than filtering them out` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: records scheduled requests dropped at the concurrency cap` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-pool-pressure.mysql.test.ts](../../../tests/api-pool-pressure.mysql.test.ts)

Модуль api-pool-pressure.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: HTTP failures and recovery with a saturated application pool` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `saturate` | 75 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `expectUnavailable` | 110 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: keeps REST session failure distinct from guest and recovers the same token` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps tRPC session failure distinct from guest and recovers the same token` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports temporary login failure with %s coordination without issuing cookies` | 150 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn failed public list reads into a successful empty page` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails a write after authentication without success or partial rows, then safely replays the same intent` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-replica-edge.test.ts](../../../tests/api-replica-edge.test.ts)

Модуль api-replica-edge.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `nginx` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `python` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `wire` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: API replica edge routing` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `remove` | 65 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: balances, preserves writes and recovers API routing with %s` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/api-worker-shutdown.mysql.test.ts](../../../tests/api-worker-shutdown.mysql.test.ts)

Модуль api-worker-shutdown.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: worker handover while another API stays online` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `replica` | 23 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `answer` | 47 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `finish` | 57 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: preserves exclusivity and hands over after %s` | 84 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/article-catalog-projection.mysql.test.ts](../../../tests/article-catalog-projection.mysql.test.ts)

Модуль article-catalog-projection.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: article catalog uses a card-only SQL projection` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the same public cards without fetching the private sections into Node` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/article-creation-recovery.mysql.test.ts](../../../tests/article-creation-recovery.mysql.test.ts)

Модуль article-creation-recovery.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: durable article creation recovery` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 55 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 59 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `status` | 77 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: checks a committed result without creating another article` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired article recovery refuses create and status without recreating a deleted material` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired status of a live article is not reported as notRecorded or success` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled expiry retains old article creation and status replay` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a compacted article refuses replay and never returns notRecorded` | 191 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reveal a successful creation to a guest` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never reverts an edited article when its original create is replayed` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects reordering the accepted section sequence under the same key` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a nontransactional journal rather than pretending creation is atomic` | 253 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed before creating when the ledger lacks its unique request key` | 270 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers the original ID with a fresh client after a committed response is lost` | 289 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes twelve concurrent creation attempts into one article and teaser` | 317 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: scopes the same key to its authenticated creator` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hashes equivalent accepted defaults but detects changed ordered sections` | 352 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid creation keys before storing anything (%s)` | 381 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies replay and result lookup after current authority changes (%s)` | 409 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses to take over an incomplete committed result` | 432 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls the intent and article back when its teaser insert fails` | 448 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy unkeyed calls independent and numeric` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed with no ledger while legacy calls keep their semantics` | 483 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never interprets an uncommitted creation as a confirmed absence` | 508 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the original creation across two independent compiled server processes` | 561 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/article-draft-recovery.browser.test.ts](../../../tests/article-draft-recovery.browser.test.ts)

Модуль article-draft-recovery.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Journals` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `it: isolates damaged article slots and atomically preserves original File bytes, including on races and storage failures` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/article-file-journal.browser.test.ts](../../../tests/article-file-journal.browser.test.ts)

Модуль article-file-journal.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bundle` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `open` | 29 | Функция. Подробности и ограничения — в исходнике. |

## [tests/article-write-consistency.mysql.test.ts](../../../tests/article-write-consistency.mysql.test.ts)

Модуль article-write-consistency.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: atomic article/teaser writes` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 30 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `article` | 34 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `teasers` | 37 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `clearOwnedRows` | 40 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rejectWrite` | 117 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `relatedRows` | 133 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `seedDiscussion` | 148 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rolls back article creation when teaser insertion fails` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: updates every legacy teaser atomically without discarding their discussion` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes every duplicate teaser on article %s` | 200 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects reserved or overlong manual source %s before SQL` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back all article fields when its existing teaser edit fails` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves a draft unpublished if its first teaser insertion fails` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores published article and its entire cascade after unpublish fails` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores teaser, discussion and detached replies if the final article deletion fails` | 247 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: commits the deletion cascade and keeps unrelated replies detached` | 259 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `withGate` | 278 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `start` | 300 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `waitForGate` | 305 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `waitForArticleWriter` | 318 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: hides the newly inserted article until its teaser commits` | 330 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exposes only the previous article and teaser while an edit is uncommitted` | 348 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes two draft publications into one teaser matching the final article` | 374 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes delete behind in-flight publication without leaving an orphan teaser` | 416 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy orphan cleanup for deleting a missing article` | 431 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a stale edit waiting behind a committed article deletion` | 438 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/async-handler.test.ts](../../../tests/async-handler.test.ts)

Модуль async-handler.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: forwards rejected promises once and leaves successful requests intact` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/audio-rendition-policy.test.ts](../../../tests/audio-rendition-policy.test.ts)

Модуль audio-rendition-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: keeps a %s-second legacy podcast within the existing audio quota at %s kbps` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid or too long duration %s instead of raising the quota` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/audio-rendition.browser.test.ts](../../../tests/audio-rendition.browser.test.ts)

Модуль audio-rendition.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `source` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `rendition` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `report` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabled` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `observations` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `origin` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ranges` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: real HTTP audio with the unchanged production player` | 110 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/audio-rendition.test.ts](../../../tests/audio-rendition.test.ts)

Модуль audio-rendition.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `available` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `script` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sha` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `describe: offline browser-compatible audio preparation` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates decodable AAC-LC with startup metadata first and preserves the ALAC original` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses to overwrite an existing rendition and leaves both files unchanged` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a non-audio input before leaving output files` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects symlink sources and symlink output directories` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept remote URLs or create an unrequested output directory` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a private output directory` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/auth-public-boundary.test.ts](../../../tests/auth-public-boundary.test.ts)

Модуль auth-public-boundary.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sessions` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 62 | Функция. Подробности и ограничения — в исходнике. |
| `it: returns the same accepted registration response for new, pending and existing accounts` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps infrastructure registration failure distinct from accepted processing` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: issues the session only in an HttpOnly cookie and returns just the public profile` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: throttles one normalized account across different IPs before checking another password` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the IP quota when an attacker rotates accounts` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reserves quota before concurrent password checks complete` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not penalize completed successful sign-ins` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a %i-byte stored digest over HTTP without updating the account or issuing a cookie` | 242 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a valid stored password usable through the real verifier and HTTP session issuance` | 267 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns an ordinary login refusal for unsupported stored cost %s` | 288 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an infrastructure verifier failure distinct from invalid credentials` | 312 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/auth.email.test.ts](../../../tests/auth.email.test.ts)

Модуль auth.email.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: email auth helpers` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes and validates email` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hashes and verifies passwords` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a damaged stored digest of %i bytes instead of accepting a partial comparison` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid stored scrypt field %i=%s without throwing` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains supported encoded parameters rather than forcing the current hashing defaults` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/auth.logout.test.ts](../../../tests/auth.logout.test.ts)

Модуль auth.logout.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CookieCall` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AuthenticatedUser` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `createAuthContext` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `describe: auth.logout` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: idempotently clears a guest session cookie and reports success` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/authenticated-retirement.mysql.test.ts](../../../tests/authenticated-retirement.mysql.test.ts)

Модуль authenticated-retirement.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: authenticated activity across final retirement` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `request` | 44 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: records activity at most once per five minutes, including stale concurrent snapshots` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never recreates a retired identity between session lookup and activity recording` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: authentication reads without waiting behind a content owner lock` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/babel-source-map-dependency.test.ts](../../../tests/babel-source-map-dependency.test.ts)

Модуль babel-source-map-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `styledJsxRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `babel` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixtureRoot` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `compileWithMap` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `it: does not disclose another package's map through %s` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an adjacent map within the compiled package` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/backend-boundaries.mysql.test.ts](../../../tests/backend-boundaries.mysql.test.ts)

Модуль backend-boundaries.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: local HTTP → MySQL → mail/provider boundaries` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signed concurrent callbacks persist one charge and one access email` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: access email completes a one-time password without creating a session` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unknown and real password requests have identical public responses` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: queues a staff resend through the native password service and audits its author` | 182 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP 200 with an error body is not a successful cancellation` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signed cancellation requires the stored profile, not only its email` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/backend-entrypoint.test.ts](../../../tests/backend-entrypoint.test.ts)

Модуль backend-entrypoint.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: built backend executable` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `start` | 47 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `stop` | 64 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: compiles the Nest composition into the actual production entrypoint` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts the compiled Node artifact and keeps public HTTP contracts` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails rather than silently switching the production port when it is occupied` | 252 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/backend-image.docker.test.ts](../../../tests/backend-image.docker.test.ts)

Модуль backend-image.docker.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `image` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `docker` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `describe: backend release image (native Docker, offline)` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: is pinned to the expected source, amd64 and non-root backend command` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: loads native dependencies and serves the real composition with no egress` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/backend-image.mysql.test.ts](../../../tests/backend-image.mysql.test.ts)

Модуль backend-image.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: built backend image on disposable MySQL` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `request` | 60 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `pendingRequest` | 89 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `trpc` | 141 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `ready` | 163 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `start` | 279 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `readData` | 363 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `otherSession` | 373 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `fixturePosts` | 381 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `withCommentRecovery` | 430 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: pages real feed/club cards without duplicates, drafts or private text leakage` | 452 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists reactions, pages public saves and scopes saved cursors to the current account` | 536 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: in-flight moderation %s` | 620 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a %s change committed while the writer waits` | 623 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `withActorLock` | 729 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: ships the patched redirect and querystring production packages` | 766 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses production startup with an undersized JWT key` | 782 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fences legacy $operation after actor $change changes in flight` | 795 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy grant and resend usable through the built HTTP API` | 883 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects revoked session during in-flight %s without target or audit changes` | 915 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `state` | 931 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rechecks post access during in-flight comment %s after %s` | 982 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `state` | 1016 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: keeps threaded comment counts, ownership and SQL relations consistent` | 1099 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `comment` | 1104 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: bounds and sanitizes JSON at $path ($status)` | 1226 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe HTTP metadata before mutation: $headers` | 1253 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts only the configured credentialed CORS preflight` | 1285 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects amplification before entering tRPC: %s` | 1308 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps guest access/unknown procedure errors explicit: %s` | 1324 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid pagination instead of coercing it: %j` | 1339 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps retired/disabled upload %s unreachable even for admin` | 1349 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps public profile fields consistent between REST and tRPC` | 1362 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid profile values without changing the SQL row` | 1386 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns server errors, not a guest, during a real disposable SQL fault and recovers with the same cookie` | 1406 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: executes the actual image as non-root with working Linux native media dependencies` | 1441 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: connects through shared coordination to the migrated schema` | 1454 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shares sessions across two production API containers and denies non-admin writes` | 1471 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: registers once, queues access mail and completes password setup through the built API` | 1495 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: runs post creation replay, editing conflicts, publication and deletion through the image` | 1543 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: runs article creation replay, publication, conflict and removal through the image` | 1597 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: revokes a session on one API and rejects its reuse on the other` | 1654 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses one shared login IP quota across the two containers` | 1668 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: grants and revokes club access from synthetic subscription state without a provider` | 1679 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates a usable compressed backup with the client shipped in the image and restores it separately` | 1723 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shares the account cooldown even when attempted logins use different source IPs` | 1758 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: drains an in-flight SQL mutation on SIGTERM while the second image stays available` | 1765 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers committed comment intents across replicas without duplicates or access bypass` | 1841 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ranks Pen Pals candidates and shares shown cards across built replicas` | 2030 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/backend-lint.test.ts](../../../tests/backend-lint.test.ts)

Модуль backend-lint.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: rejects unsafe async code while accepting awaited and handled operations` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-checkout-built.test.ts](../../../tests/billing-checkout-built.test.ts)

Модуль billing-checkout-built.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: compiled ESM wires Nest billing providers and retains fail-closed configuration and authorization` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-checkout-composition.test.ts](../../../tests/billing-checkout-composition.test.ts)

Модуль billing-checkout-composition.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `caller` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `it: routes checkout through the supplied service instead of global billing state` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the service failure code at the checkout boundary` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed checkout input before entering the service` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-checkout-configuration.test.ts](../../../tests/billing-checkout-configuration.test.ts)

Модуль billing-checkout-configuration.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: club checkout configuration fails closed` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid %s instead of producing a payable or unsigned link` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid monthly subscription ID %s` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validates the configured %s with the same rules as settlement` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts an explicit HTTPS payform root and positive fractional price` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-checkout-url.test.ts](../../../tests/billing-checkout-url.test.ts)

Модуль billing-checkout-url.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `input` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: checkout links stay on the configured application` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a plus-addressed recipient through the signed checkout query` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses Prodamus's documented SBP identifier for the monthly subscription` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not force Russian SBP on the foreign-card one-off plan` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps every %s callback on staging rather than production or the auth host` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the same application origin for shop callbacks without enabling shop payments` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the browser to staging without using a request-supplied host` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unsafe application configuration without leaking it` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: responds safely when the browser return is misconfigured` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-checkout.test.ts](../../../tests/billing-checkout.test.ts)

Модуль billing-checkout.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `state` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 67 | Функция. Подробности и ограничения — в исходнике. |
| `checkoutClock` | 72 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: checkout cannot establish identity or payment` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a keyed test intent cannot fall back to Prodamus when YooKassa mode is %j` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not persist an order if building its payment link fails` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid %s before creating a recipient or order` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the semiannual one-off checkout independent of a monthly subscription ID` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates distinct %s orders for concurrent requests in the same millisecond` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates checkout without logging into a passwordless existing account` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: can pay for an existing account without changing its password or authenticating` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a blocked checkout email` | 201 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects checkout from a blocked session` | 208 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not bind another email to the logged-in account's payment` | 214 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: claimPending never grants an unpaid order` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: claimPending reports access already verified by the server` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-settlement.mysql.test.ts](../../../tests/billing-settlement.mysql.test.ts)

Модуль billing-settlement.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `mysqlRows` | 299 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describe: billing settlement on disposable MySQL` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `latestExpiry` | 60 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `contact` | 79 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: fills an empty existing contact only after settlement (%j)` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an established contact and all identity fields after payment` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: settles a legacy order without inventing a contact (%j)` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not copy contact from a rejected payment (%s)` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not restore contact while account deletion is requested` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: queues cancellation for a new billing profile from a late payment` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent payments fill once without replacing the first committed contact` | 163 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not repopulate a deliberately cleared contact on receipt replay` | 176 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: sequential replay extends access only once` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent distinct payments do not lose a paid period` | 191 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent replays grant one period` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: settlement atomically queues exactly one access email` | 199 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a valid signature cannot bypass the saved checkout amount` | 206 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: missing link encryption configuration rolls back the payment` | 217 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a provider payment ID cannot pay two different orders` | 230 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unknown recurring profiles never grant access by email or userId` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an in-flight renewal must not turn a pending cancellation into a confirmed one` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verified recurring profiles grant each real charge once, including concurrent callbacks` | 275 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-subscription-composition.test.ts](../../../tests/billing-subscription-composition.test.ts)

Модуль billing-subscription-composition.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paidUntil` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `subscriptions` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 61 | Функция. Подробности и ограничения — в исходнике. |
| `it: subscription status uses the supplied billing service` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: claimPending reports the supplied service's verified order` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancellation uses the supplied service and retains paid expiry` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: anonymous %s stays protected` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocked %s stays protected` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-subscription-service.test.ts](../../../tests/billing-subscription-service.test.ts)

Модуль billing-subscription-service.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paidUntil` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paid` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `service` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: guest/blocked status is unsubscribed without reading paid access` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s status retains the explicit owner policy` | 82 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: paid status preserves the expiry and confirmed cancellation flag` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: claim reports verified paid access without activating a pending checkout` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a checkout alone cannot be claimed as paid` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s does not turn a failed read into a false success` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancellation fails closed without a database` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a business cancellation refusal has a safe public client error` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unexpected cancellation failures remain server errors without private details` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an accepted cancellation reports pending instead of a server error` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: subscription reads expose a persisted pending cancellation without claiming auto-renewal has stopped` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: confirmed cancellation retains paid expiry %s` | 219 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/billing-webhook.test.ts](../../../tests/billing-webhook.test.ts)

Модуль billing-webhook.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `state` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payment` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `response` | 48 | Функция. Подробности и ограничения — в исходнике. |
| `notify` | 66 | Функция. Подробности и ограничения — в исходнике. |
| `describe: billing notification trust boundary` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not log database error objects that can contain mail tokens and personal data` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not allow unsigned form parsing to mutate Object.prototype` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: browser return never activates an order` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unauthenticated notification signed with %s` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsigned cancellation before any state change` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cannot fulfil recurrence with status %s` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a valid signed successful payment` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a demo marker even with the ordinary valid key: %j` | 163 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves live processing for a disabled demo flag %j` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a demo cancellation before profile binding or persistence` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects signed cancellation without a bound subscription profile` | 206 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a shop signature reused for a club payment` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects missing or foreign payment identifiers: %j` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/body-parser-dependency.test.ts](../../../tests/body-parser-dependency.test.ts)

Модуль body-parser-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Express body parsers fail closed on invalid size configuration` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/brace-expansion-dependency.test.ts](../../../tests/brace-expansion-dependency.test.ts)

Модуль brace-expansion-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `lintRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `globRequire` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `expansionPath` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `expand` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: caps default sequence output in a bounded disposable child` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds Cartesian products by output count` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds accumulated output characters` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary lint braces, ranges, escapes and legacy dollar syntax` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/browserslist-dependency.test.ts](../../../tests/browserslist-dependency.test.ts)

Модуль browserslist-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `babelRequire` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browserslist` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: preserves explicit build targets when custom stats contain inherited key %s` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary custom-usage build targets` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/cancellation-test-history.mysql.test.ts](../../../tests/cancellation-test-history.mysql.test.ts)

Модуль cancellation-test-history.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: cancellation after one-off TEST checkout` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 25 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `settleTest` | 53 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `settleLive` | 80 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `paidRows` | 101 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: cancels LIVE after a verified one-off TEST (foreign=%s)` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still refuses an unverified TEST-shaped paid row` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: confirms that a verified one-off TEST alone has no recurring charges` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a verified TEST never masks an unbound monthly payment` | 182 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/cancellation.mysql.test.ts](../../../tests/cancellation.mysql.test.ts)

Модуль cancellation.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: durable subscription cancellation` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `flags` | 71 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: provider failure is pending, not a confirmed cancellation` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: confirmed cancellation preserves the entire paid period` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: worker retries a failed cancellation after a restart` | 99 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: parallel workers claim a cancellation once` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: legacy monthly subscriptions without a verified provider profile cannot falsely report success` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/candidate-api-environment.test.ts](../../../tests/candidate-api-environment.test.ts)

Модуль candidate-api-environment.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: composes the candidate under production origin validation without relaxing security` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/candidate-data-transfer.mysql.test.ts](../../../tests/candidate-data-transfer.mysql.test.ts)

Модуль candidate-data-transfer.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `execute` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceUrl` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `targetUrl` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceId` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `targetId` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `legacy` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: candidate transfer with native fresh42 and a synthetic legacy29 source` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `guard` | 54 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 75 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `applicationCount` | 78 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: refuses a nonempty target without changing an existing account` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back all copied rows on a target identity conflict without leaking row values` | 182 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: copies legacy rows, preserves password/session/subscription fields and keeps migration history` | 200 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves the source connection read-only and refuses replay into the populated candidate` | 263 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/candidate-data-transfer.test.ts](../../../tests/candidate-data-transfer.test.ts)

Модуль candidate-data-transfer.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `oldColumns` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: keeps every source column explicit and permits a nullable new target field` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses missing, narrowed or unsatisfied target columns %#` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses identifiers which could redirect a generated SQL statement` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses copying migration history as application data` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/candidate-database-policy.test.ts](../../../tests/candidate-database-policy.test.ts)

Модуль candidate-database-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `plan` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `input` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: accepts only the explicitly reviewed fresh candidate and returns no credentials` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unintended or ambiguous candidate settings %#` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a different connected database/server/engine %#` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the connected candidate only after checking its live identity` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses changed source bytes even when the caller approves their new hash` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not substitute application credentials when the candidate URI is absent` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: the actual operator refuses %s without authorized configuration and keeps errors private` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/candidate-release-compose.test.ts](../../../tests/candidate-release-compose.test.ts)

Модуль candidate-release-compose.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: changes only API image/DB connection and restores the exact baseline offline` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/checkout-contact-phone.test.ts](../../../tests/checkout-contact-phone.test.ts)

Модуль checkout-contact-phone.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `data` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `service` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checkout` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `it: refuses invalid/missing contact before creating an account or order (%j)` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stores a normalized unverified contact locally (%s)` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: also requires and stores contact in LIVE checkout, without sending it to the provider` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not silently remove arbitrary characters (%s)` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts contact in both durable checkout contracts` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/checkout-contact-types.test.ts](../../../tests/checkout-contact-types.test.ts)

Модуль checkout-contact-types.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Output` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `it: keeps the unverified contact typed on administrator cards only` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/checkout-contact-user.mysql.test.ts](../../../tests/checkout-contact-user.mysql.test.ts)

Модуль checkout-contact-user.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: unverified checkout contact in the user card` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 58 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `liveCheckout` | 110 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: stores a new guest contact only on the unpaid order (%s)` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a guest cannot overwrite an existing user's contact (%s)` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: updates only the authenticated owner contact and keeps credentials and roles (%s)` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects changing the contact of a different email even with an authenticated session` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose the contact in public session responses, but returns it to admin members` | 204 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the authenticated contact when payment insertion fails` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows a guest order to use the same unverified contact as another account` | 233 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates one recipient for concurrent email resolution without a contact` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a stale authenticated actor before changing contact (%s)` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/ci-checkout-browser.test.ts](../../../tests/ci-checkout-browser.test.ts)

Модуль ci-checkout-browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `script` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `owned` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `run` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `it: rejects unknown profiles before spawning a command` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: builds %s and then tests with the same explicit flags and no SQL/proxy` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not start browser tests after a build failure` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates a browser failure` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a false green browser run: %s` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows only the known legacy guest skip in the guest/NORMAL profile` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/ci-sql-scheduling.test.ts](../../../tests/ci-sql-scheduling.test.ts)

Модуль ci-sql-scheduling.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `execute` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `root` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `directory` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: serializes all shared-MySQL files once, while independent unit files still run together` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/ci-sql-setup.test.ts](../../../tests/ci-sql-setup.test.ts)

Модуль ci-sql-setup.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: CI rejects an unsafe database before executing any SQL suite, without printing its credentials` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/client-access-api.test.ts](../../../tests/client-access-api.test.ts)

Модуль client-access-api.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `auth` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fetcher` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: accepts the backend's confirmed logout response` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unconfirmed logout response: %j` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requests instructions without issuing or saving a login session` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts registration without a password or a client session` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts login with only a public profile and uses the browser cookie transport` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads capabilities from the server and does not accept a string as permission` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads explicitly advertised private upload availability: %j` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unknown or malformed availability instead of choosing the legacy contract: $payload` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks %s instead of accepting an earlier enabled response` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires photo availability for automatically generated private video posters` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not dispatch a capability check from an already cancelled editor` | 216 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not allow upload after an infrastructure failure` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not log session cookies, response headers or failed request bodies` | 232 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/client-ip.test.ts](../../../tests/client-ip.test.ts)

Модуль client-ip.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: rate limits the proxy-validated client IP, not attacker-supplied forwarded headers` | 3 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/client-role-policy.test.ts](../../../tests/client-role-policy.test.ts)

Модуль client-role-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `isOwnerUser` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: uses an explicit administrator role for owner controls` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not infer owner controls from a matching email` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not infer owner controls from a legacy openId label` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not grant owner controls without a loaded user` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/client-session-storage.test.ts](../../../tests/client-session-storage.test.ts)

Модуль client-session-storage.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `profile` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `values` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `storage` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not reuse a legacy browser token as a Bearer credential` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not persist a newly issued browser token or invoke native storage` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses only the server profile and removes legacy personal data` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: continues cookie-only web auth if local storage is unavailable` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not log cached personal data or storage exception contents` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/club-cancellation-service.test.ts](../../../tests/club-cancellation-service.test.ts)

Модуль club-cancellation-service.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `profile` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: retains durable cancellation decision %s and the complete profile` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails on missing database before confirming a profile` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates acquisition failure without confirming or retrying` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates durable failure without retry or acknowledgement` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for durable completion before reporting a decision` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/club-category-page.mysql.test.ts](../../../tests/club-category-page.mysql.test.ts)

Модуль club-category-page.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: club filters before pagination over HTTP/JWT/MySQL` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `post` | 21 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rejects guests rather than treating an unknown method as an empty list` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: respects explicit section priority and fallback aliases for %s` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: filters rare matches and a combined board tag before LIMIT` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: applies membership on every request and rejects unknown input` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/club-chronological-order.mysql.test.ts](../../../tests/club-chronological-order.mysql.test.ts)

Модуль club-chronological-order.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `expectedClub` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paymentOrder` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: club chronological pages preserve independent admin ordering` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 33 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `client` | 36 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `clearPosts` | 47 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: orders %s by effective date before LIMIT, ignoring manual/timestamp ranks` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses ascending IDs for equal dates across page boundaries and stable reloads` | 264 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: filters rubric and board aliases before chronological pagination` | 282 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves manual admin ordering and the calendar's representative card` | 311 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the existing feed ordering` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps membership and revocation checks on every page` | 344 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves stored dates, ranks and attachments intact` | 369 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/club-grants.mysql.test.ts](../../../tests/club-grants.mysql.test.ts)

Модуль club-grants.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: manual club grants on disposable MySQL` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `payments` | 46 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: accumulates every simultaneous grant instead of overwriting the same expiry` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the default 31-day grant and stored recipient` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the admin member projection and refreshed expiry after a grant` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the admin payment limit and confirmed grant fields` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a successful known-empty payment read distinct from unavailable storage` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts an expired membership from now rather than its old expiry` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid duration %s without changing payments` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a %s recipient without recording a grant` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing recipient` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns an explicit native refusal for a %s recipient without changing rows` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: acknowledges a real admin grant only with its committed 31-day expiry` | 120 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not grant or change history for %s` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/club-settlement-service.test.ts](../../../tests/club-settlement-service.test.ts)

Модуль club-settlement-service.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `proof` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: %s preserves the complete durable settlement input` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn a rejected durable settlement into success` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves absent amount/proof for the existing durable validator instead of inventing defaults` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates SQL failure rather than acknowledging or retrying it` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: awaits settlement completion before reporting success` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: standalone fulfillment retains its durable decision: %s` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/comment-access-race.mysql.test.ts](../../../tests/comment-access-race.mysql.test.ts)

Модуль comment-access-race.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: comment access changes while writes wait` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 27 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `caller` | 76 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 83 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `checkRace` | 100 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `describe: %s` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks %s after the SQL wait` | 199 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks the comment deadline after the SQL wait` | 203 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/comment-access.test.ts](../../../tests/comment-access.test.ts)

Модуль comment-access.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `state` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `user` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `actions` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: refuses a club comment mutation without access before changing records` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses mutations on a draft even for subscribers` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps published public discussion mutations available to authenticated non-members` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/comment-mutations.mysql.test.ts](../../../tests/comment-mutations.mysql.test.ts)

Модуль comment-mutations.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: atomic comment mutations on disposable MySQL` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clearFixture` | 11 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `related` | 35 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rejects a foreign deletion before removing any associated likes or reports` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deletes the owner's comment and all associated records, retaining newer replies` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a reply to a missing parent` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a parent from a different post` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes simultaneous like toggles without duplicate rows` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not create a like for a deleted/missing comment` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes deletion with a reply, leaving no dangling parent` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses foreign edits and missing reports without claiming success` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes deletion with likes and reports, leaving no orphan associations` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not add a root comment to a missing or hidden post` | 82 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deletes a post with its comment associations in one transaction` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back a post deletion if related-record cleanup fails` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes post deletion with new root comments` | 99 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/comment-photo-admission.test.ts](../../../tests/comment-photo-admission.test.ts)

Модуль comment-photo-admission.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `actor` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `input` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: denies an inaccessible comment post before decoding its photo` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns a service error before photo decoding when the entitlement check cannot reach the database` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/comment-photo-previews.test.ts](../../../tests/comment-photo-previews.test.ts)

Модуль comment-photo-previews.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: keeps an unchanged selected file's URL when another photo is added or removed` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: releases the previous bytes on replacement and every URL on scope cleanup` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/comments-page.mysql.test.ts](../../../tests/comments-page.mysql.test.ts)

Модуль comments-page.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: comment groups over real HTTP/JWT/disposable MySQL` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pages %i root comments with chronological equal-date tie breaking` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds a parent with 51 replies, includes accurate counts and retains grandchildren` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: honors a 50-comment group with a reachable final item` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shows promoted replies as roots after the existing delete transaction` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps author/photo/like fields without loading another parent's replies` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains public-post comments for unpaid users but rechecks club subscription on every page` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not read missing, unpublished or other-post parents` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a cursor reused for another parent, post or owner` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: continues after a deleted cursor comment without restarting the group` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid input %j` | 203 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a session even on public posts` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/compressed-parser-dependency.test.ts](../../../tests/compressed-parser-dependency.test.ts)

Модуль compressed-parser-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `backend` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `parsers` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: $name survives a late error after a compressed frame` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/contact-routing.test.ts](../../../tests/contact-routing.test.ts)

Модуль contact-routing.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `recipient` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: routes public support and default shop orders to the approved owner` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: gives a blocked account the same support address without allowing the operation` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-count-indexes.mysql.test.ts](../../../tests/content-count-indexes.mysql.test.ts)

Модуль content-count-indexes.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `id` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: content count indexes on owned native SQL` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses a covering lookup for %s instead of scanning the table` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves exact public/club counts and historical duplicate-like semantics` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-edit-conflicts.mysql.test.ts](../../../tests/content-edit-conflicts.mysql.test.ts)

Модуль content-edit-conflicts.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `detail` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `postId` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `articleId` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `teaserId` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: editor concurrency on disposable MySQL and real HTTP` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clear` | 65 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: returns stable edit versions without changing public detail shape` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a stale post body and publication together without side effects` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes two independent admins: exactly one stale snapshot wins` | 167 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: detects attachment changes even with an unchanged parent timestamp` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reactions do not invalidate the content revision` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a stale article and preserves its synchronized teaser` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a version in strict mode, including flag-only edits` | 246 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy compatibility explicit while still validating supplied versions` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not let malformed versions or an invalid rollout flag bypass checks` | 270 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stores the exact TEXT boundary for %s through HTTP` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reconciles an unobserved write by read; a stale retry cannot overwrite it` | 305 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps current-state media deletion working in strict mode and invalidates old edits` | 323 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains authorization before the edit precondition` | 341 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns 400 for oversized UTF-8 text and preserves the old row` | 357 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-edit-journals.browser.test.ts](../../../tests/content-edit-journals.browser.test.ts)

Модуль content-edit-journals.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Journals` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `it: real IndexedDB preserves article versions, original snapshots and File bytes in drafts, covers and write intents` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-edit-revision.test.ts](../../../tests/content-edit-revision.test.ts)

Модуль content-edit-revision.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `post` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `media` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: opaque edit snapshot revisions` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores query order while detecting an actual attachment reorder` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: detects body, schedule and poster edits with the same timestamp` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: is scoped to the record and canonicalizes JSON key ordering` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: strict mode distinguishes internal current-state commands from client edits` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves versions in the generated API types` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-read-availability.test.ts](../../../tests/content-read-availability.test.ts)

Модуль content-read-availability.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: returns an explicit HTTP service failure from $name without database configuration` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not disguise a missing connection as empty content or a missing object` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-recovery-compaction.mysql.test.ts](../../../tests/content-recovery-compaction.mysql.test.ts)

Модуль content-recovery-compaction.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bounded content compaction on owned SQL` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `compact` | 21 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 27 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: removes old recovery details only after a same-owner minimal marker is committed` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does no writes when maintenance is disabled` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back detail deletion if marker ownership conflicts` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unbounded batch rather than sweeping journals` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-recovery-markers.mysql.test.ts](../../../tests/content-recovery-markers.mysql.test.ts)

Модуль content-recovery-markers.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: content recovery marker schema` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a complete unique operation identity without payload or result columns` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a competing owner for the same operation while separating namespaces` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-recovery-window.test.ts](../../../tests/content-recovery-window.test.ts)

Модуль content-recovery-window.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: content recovery window` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recorded at %s is refused exactly at its recovery boundary` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an invalid recording timestamp fails closed when enabled` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an invalid server clock never approves replay` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled mode retains legacy recovery for old records` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-write-boundary.test.ts](../../../tests/content-write-boundary.test.ts)

Модуль content-write-boundary.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: content persistence compiles without importing the aggregate database facade` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-write-validation.mysql.test.ts](../../../tests/content-write-validation.mysql.test.ts)

Модуль content-write-validation.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: content write validation on disposable SQL` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 48 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `snapshot` | 109 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rejects invalid post fields without SQL changes: %j` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid article order %s without SQL changes` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists exact signed INT boundary %s on post and article` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists representable timestamp %s` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves negative order and unchanged retry intent after text sanitization` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a new post empty after sanitizing %j and rolls back its receipt` | 214 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects clearing the only text without changing the existing post` | 228 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not count whitespace-only photo/video references as content` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves metadata-only maintenance of an already empty legacy post` | 247 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a %s-only post valid, including edits with omitted media` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back removal of the last file when the post has no other content` | 290 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back clearing the last photo or video with omitted text` | 311 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content-write-validation.test.ts](../../../tests/content-write-validation.test.ts)

Модуль content-write-validation.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: admin content write validation before persistence` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects sortOrder %s for both post/article writes` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves valid signed SQL INT order %s` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves existing nullable/valid date input %s` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/content.mysql.test.ts](../../../tests/content.mysql.test.ts)

Модуль content.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: content visibility and retention on disposable MySQL` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: public and club queries exclude scheduled/draft rows even when the legacy published flag is true` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps 100-day-old comments but purges comments older than one year with related records` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: defers a locked expired comment and removes it on a subsequent tick` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/database-coordination-lock.test.ts](../../../tests/database-coordination-lock.test.ts)

Модуль database-coordination-lock.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `it: skips an occupied job without calling it and releases its unlocked connection` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not begin domain work when lock acquisition returns an error` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: releases its named lock even when domain work throws` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: destroys rather than reuses a session when unlock is %s` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: times out pool admission and releases a connection that arrives too late` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/database-identifiers.test.ts](../../../tests/database-identifiers.test.ts)

Модуль database-identifiers.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: quotes backticks inside identifiers instead of treating them as SQL` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: escapes quoted aliases and keeps user values as parameters` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/database-log-privacy.mysql.test.ts](../../../tests/database-log-privacy.mysql.test.ts)

Модуль database-log-privacy.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: database failure logging on disposable MySQL` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: logs a failed registration without credentials, recipient or SQL params` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/database-pool-admission.mysql.test.ts](../../../tests/database-pool-admission.mysql.test.ts)

Модуль database-pool-admission.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bounded admission on the real application pool` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `occupy` | 23 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: lets an ordinary queued query resume after a short busy period` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds expired waiters across bursts, returns 503 and never runs their work later` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: admits exactly 40 waiters with the burst queue enabled` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/dependency-boundaries.test.ts](../../../tests/dependency-boundaries.test.ts)

Модуль dependency-boundaries.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `check` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `describe: enforced workspace dependency direction` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid dependency in %s` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts supported dependency in %s` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/devops-build-config.test.ts](../../../tests/devops-build-config.test.ts)

Модуль devops-build-config.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BuildService` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `render` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `revision` | 48 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: build-only Compose contract` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unversioned image build instead of silently using latest` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: renders versioned build-only images without runtime services or secrets` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps default payment flags off and explicitly forwards the chosen public build profile` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: changes only API/web image pins when appended to an accepted runtime` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/drizzle-offline-export-compatibility.test.ts](../../../tests/drizzle-offline-export-compatibility.test.ts)

Модуль drizzle-offline-export-compatibility.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `cli` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: exports synthetic MySQL schema through the native CLI (candidate: %s)` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/email-binding-navigation-security.test.ts](../../../tests/email-binding-navigation-security.test.ts)

Модуль email-binding-navigation-security.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `server` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `navigation` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `request` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `describe: email binding document navigation boundary` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows a top-level GET from webmail to %s without CORS permission` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects non-authorized navigation $method $path $headers` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/email-identity-preflight.mysql.test.ts](../../../tests/email-identity-preflight.mysql.test.ts)

Модуль email-identity-preflight.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: email preflight on disposable MySQL` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `inspect` | 25 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: accepts multiple absent emails and reports no personal data` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects normalized duplicates and noncanonical data without changing any row` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: inspects every page, including an incompatible address after row 500` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: also checks legacy rows with nonpositive IDs` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: opens a real read-only inspection connection for the canonical fixture` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed legacy email without rewriting the account` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: unique email migration on disposable legacy data` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails atomically on duplicates instead of repairing or deleting old accounts` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/email-identity-preflight.test.ts](../../../tests/email-identity-preflight.test.ts)

Модуль email-identity-preflight.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `connection` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `createConnection` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: read-only normalized email preflight` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 17 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: accepts normalized addresses and absent legacy emails without writes` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks incompatible legacy email %# without echoing it` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks duplicates without returning addresses or account identifiers` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks a malformed non-empty legacy address without repairing it` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: paginates with a bound and the last inspected id` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed on malformed rows and closes the inspection connection` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: closes after a failed query without trying a repair` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/email-identity.mysql.test.ts](../../../tests/email-identity.mysql.test.ts)

Модуль email-identity.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: normalized email identity on disposable MySQL` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 19 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rejects a whitespace/case variant without changing the existing address or credentials` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps separate legacy accounts with absent or empty email` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: gives simultaneous different identities competing for an email exactly one winner` | 82 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps simultaneous retries of the same identity on one account` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/email-smtp.test.ts](../../../tests/email-smtp.test.ts)

Модуль email-smtp.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `server` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sockets` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `commands` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `messages` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `rejectRecipient` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mail` | 62 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: keeps the legacy SMTP identity independent of the public contact recipient` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses an explicitly configured owner identity on the loopback transport` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: delivers one envelope recipient, stable Message-ID and escaped HTML through real SMTP` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report successful delivery or log recipient data on SMTP rejection` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose credentials to a production SMTP server that cannot negotiate TLS` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects recipient lists before making any SMTP connection` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: routes replies to the support mailbox without copying private mail or changing SMTP identity` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid support reply address before opening SMTP: %s` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves existing mail headers when the optional support address is not enabled` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/esbuild-core-utils-compatibility.test.ts](../../../tests/esbuild-core-utils-compatibility.test.ts)

Модуль esbuild-core-utils-compatibility.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: preserves core-utils sync/async TypeScript transforms (candidate: %s)` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/esbuild-esm-loader-compatibility.test.ts](../../../tests/esbuild-esm-loader-compatibility.test.ts)

Модуль esbuild-esm-loader-compatibility.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `require` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: loads aliased typed ESM config and dynamic imports (candidate: %s)` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/file-signature-lifecycle.test.ts](../../../tests/file-signature-lifecycle.test.ts)

Модуль file-signature-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ControlledWorker` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `state` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `detect` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: serves only the requested owned range without copying the entire file` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid worker ranges $offset/$length without exporting bytes` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: caps each exported fragment and permits an exact end-of-file read` | 82 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: terminates a hung detector at its deadline and permits the next request` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: tears down after %s without leaking private diagnostics` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not poison serialization after worker construction fails` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: awaits termination before allocating the next worker and copies only owned bytes` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds waiting detections and admits a new request after a slot is released` | 182 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects queued buffers that would exceed the aggregate detector budget` | 200 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/file-signature.test.ts](../../../tests/file-signature.test.ts)

Модуль file-signature.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: detects %s without changing storage bytes` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers after malformed parser input and keeps concurrent results independent` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves random-access signature checks instead of sampling only a prefix` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: runs the external detector from compiled ESM in a foreign working directory` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: runs the same detector under the existing CommonJS/tsx development runtime` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: applies document rejection and text/fallback policy from compiled ESM with real workers` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/fixtures/aesthetic-content-hashes.ts](../../../tests/fixtures/aesthetic-content-hashes.ts)

Captured from the original mixed modules before splitting. Ordered field hashes.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `aestheticContentHashes` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/fixtures/babel-source-map/outside.map](../../../tests/fixtures/babel-source-map/outside.map)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [tests/fixtures/babel-source-map/project/adjacent.map](../../../tests/fixtures/babel-source-map/project/adjacent.map)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [tests/fixtures/babel-source-map/project/package.json](../../../tests/fixtures/babel-source-map/project/package.json)

Зависимости и команды соответствующего workspace; источник допустимых способов запуска.

## [tests/fixtures/drizzle-export/drizzle.config.ts](../../../tests/fixtures/drizzle-export/drizzle.config.ts)

Модуль drizzle.config.ts; объявления и смысловые границы перечислены ниже.

## [tests/fixtures/drizzle-export/schema.ts](../../../tests/fixtures/drizzle-export/schema.ts)

Модуль schema.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/fixtures/legacy-loader/candidate-loader.mjs](../../../tests/fixtures/legacy-loader/candidate-loader.mjs)

Experimental adapter scoped to the isolated Node loader worker, never the

| Блок | Строка | Назначение |
| --- | --- | --- |
| `require` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `coreEntry` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `compiler` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `originalLoad` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `injected` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hooks` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `{ resolve, load, globalPreload }` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/fixtures/legacy-loader/config.mts](../../../tests/fixtures/legacy-loader/config.mts)

Модуль config.mts; объявления и смысловые границы перечислены ниже.

## [tests/fixtures/legacy-loader/dynamic.mts](../../../tests/fixtures/legacy-loader/dynamic.mts)

Модуль dynamic.mts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `double` | 1 | Функция. Подробности и ограничения — в исходнике. |

## [tests/fixtures/legacy-loader/entry.mts](../../../tests/fixtures/legacy-loader/entry.mts)

Модуль entry.mts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `{ double }` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/fixtures/legacy-loader/tsconfig.json](../../../tests/fixtures/legacy-loader/tsconfig.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tests/fixtures/native-mysql-dump.cjs](../../../tests/fixtures/native-mysql-dump.cjs)

Test-only transport adapter: execute the actual MySQL 8.4 tool inside the

| Блок | Строка | Назначение |
| --- | --- | --- |
| `{ spawn }` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fs` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `args` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `config` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `id` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `child` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/flatted-dependency.test.ts](../../../tests/flatted-dependency.test.ts)

Модуль flatted-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `cacheRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `flattedPath` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `flatted` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not resolve cache reference %s through the input array prototype` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores a bounded cache reference chain without recursive stack growth` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary cache values, shared references and cycles` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/fresh-backup-restore.mysql.test.ts](../../../tests/fresh-backup-restore.mysql.test.ts)

Модуль fresh-backup-restore.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `sourceUrl` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `targetUrl` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceId` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `targetId` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `root` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `execute` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: full fresh database backup and isolated native restore` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `guard` | 41 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 69 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `quote` | 72 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `contents` | 75 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `definitions` | 85 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `restore` | 93 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: creates a complete private gzip without partial artifacts` | 274 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the release image's MariaDB client against the real MySQL source` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not change the source while backing up or restoring` | 290 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves no completed or partial archive after a real client authentication failure` | 294 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores every table and exact synthetic contents including all migration hashes` | 304 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves engines, collations, generated expressions, indexes and auto increments` | 323 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves library binding integrity, pending recovery and uniqueness after restore` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps identity and recovery uniqueness enforced after restore` | 378 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses restoring into a nonempty target without changing its contents` | 391 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verifies fresh-profile history in the restored target without applying migrations` | 396 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/fresh-database.mysql.test.ts](../../../tests/fresh-database.mysql.test.ts)

Модуль fresh-database.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `container` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `root` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: isolated full fresh install without fixture DDL` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `run` | 26 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: refuses a nonempty database without adding migration history` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: initializes all 52 migrations from an actually empty owned database` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a repeat without changing the initialized schema/history` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verifies installed fresh-profile history read-only` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks a missing or invisible Feed index even with complete migration history` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: backfills distinct UUIDs and preserves publication dates on an existing posts table` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads every current ORM table/column without fixture DDL` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts the native backend against migrated schema and serves HTTP without seeds` | 202 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unowned/nonlocal/production targets before any mutation %#` | 237 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/fresh-install-plan.test.ts](../../../tests/fresh-install-plan.test.ts)

Модуль fresh-install-plan.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scratch` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `run` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `it: plans the complete fresh order without Docker, credentials or modifying the legacy journal` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not open an inherited application, preflight or fixture connection or expose their credentials` | 110 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: changes the plan fingerprint when SQL bytes change` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unknown SQL rather than including it in a fresh plan` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing SQL file without reporting a partial plan` | 163 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not widen local initialization permissions %#` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unsupported or combined operation modes %j` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/fresh-install-policy.test.ts](../../../tests/fresh-install-policy.test.ts)

Модуль fresh-install-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `source` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `describe: separate fresh-install migration manifest` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `fresh` | 23 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: keeps the canonical release/fresh identities and can still recognize the historical layout` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unknown orphan instead of silently applying it` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing fresh migration` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-admin-action-recovery.test.ts](../../../tests/frontend-admin-action-recovery.test.ts)

Модуль frontend-admin-action-recovery.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `values` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `receipts` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `api` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `effects` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signal` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `outcome` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `it: does not replace an intent that disappeared while this tab retained it` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not apply a late reply to another account; the original actor can recover later` | 226 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores a reply after cancellation without discarding the saved key` | 250 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists rate limit across reload, permits status and forbids early email replay` | 264 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a conflict is resolved by its durable refusal, never by an automatic new key` | 288 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects mismatched/malformed status %j` | 309 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: API adapter sends the saved UUID via both transports and validates the actual receipt` | 324 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-aesthetic-visuals.test.ts](../../../tests/frontend-aesthetic-visuals.test.ts)

Модуль frontend-aesthetic-visuals.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `source` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `file` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: uses only the confirmed private binding, preserving group order` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not return a public fallback for missing bindings` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a binding or source from another material` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not silently accept duplicate binding identities` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-api-origin-policy.test.ts](../../../tests/frontend-api-origin-policy.test.ts)

Модуль frontend-api-origin-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: rejects a split public API origin before JSON and private media use different hosts` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows the same public origin with a private proxy behind it` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-article-cover.test.ts](../../../tests/frontend-article-cover.test.ts)

Модуль frontend-article-cover.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: rejects a malformed or avatar-specific cover receipt: %j` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the explicit cover contract: %j` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a cover snapshot can preserve an unfinished title without weakening article write validation` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-article-creation.test.ts](../../../tests/frontend-article-creation.test.ts)

Модуль frontend-article-creation.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `record` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: restores the exact original payload including empty blocks and ordered repeated URLs` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never assigns another account's saved operation to the current editor` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a corrupt operation rather than replacing it (%#)` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts only server-confirmed status %j` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never treats malformed status as permission to create (%#)` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-audio-player.test.ts](../../../tests/frontend-audio-player.test.ts)

Модуль frontend-audio-player.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TestAudio` | 3 | Класс. Подробности и ограничения — в исходнике. |
| `audio` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `player` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: a rejected play promise leaves playback stopped and exposes a recoverable error` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: plays the final half-second and resets its real position only on ended` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an explicitly muted volume` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late play completion cannot revive a released player` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: Strict Mode cleanup allows a new connection and ignores events from the old audio` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a stalled play has a deadline and can be retried` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-avatar-upload-journal.test.ts](../../../tests/frontend-avatar-upload-journal.test.ts)

Модуль frontend-avatar-upload-journal.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `values` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `intent` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `corrupt` | 112 | Функция. Подробности и ограничения — в исходнике. |
| `it: retains exact bytes and key for the same owner across session changes` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the actual prepared image format for %s across recovery` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not silently replace a pending file or key in another tab` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates quota failures instead of allowing an unjournaled upload` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects corrupted or mismatched durable data: %s` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed avatar receipts: %j` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a completed upload that is no longer current without implying reapplication` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the original damaged bytes and a usable same-owner receipt key` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never uses a foreign owner's receipt key` | 131 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mistake unavailable storage for a corrupt record` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses to discard a replacement or another owner's data` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports failed durable removal rather than pretending recovery succeeded` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-batch-url.test.ts](../../../tests/frontend-batch-url.test.ts)

Модуль frontend-batch-url.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `groups` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `response` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `it: sends a full two-month calendar alone without rejecting it at the ordinary batch limit` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: splits real client GET batches at 2048 bytes without losing, duplicating or misrouting replies` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels all split packets from the old session even when fetch ignores abort` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancelling one operation does not misroute or cancel neighbouring replies` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-bounded-media-read.test.ts](../../../tests/frontend-bounded-media-read.test.ts)

Модуль frontend-bounded-media-read.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: stops an oversized %s stream before reading the tail or uploading` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized local avatar data before decoding or fetching` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves bytes and MIME up to the exact limit, headers=%j` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an advertised oversize before pulling its first chunk` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a stalled body when the editor operation is aborted` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn a broken or empty stream into a successful file` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: closes a real chunked loopback HTTP response after reaching the limit` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-cancellation-refusal.browser.test.ts](../../../tests/frontend-cancellation-refusal.browser.test.ts)

Модуль frontend-cancellation-refusal.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: distinguishes a confirmed cancellation refusal from an unknown write: %s` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-cancellation-status.browser.test.ts](../../../tests/frontend-cancellation-status.browser.test.ts)

Модуль frontend-cancellation-status.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: restores pending cancellation after reload without new writes (paid=%s)` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-capabilities.test.ts](../../../tests/frontend-capabilities.test.ts)

Модуль frontend-capabilities.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `disabled` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: rejects an unknown or malformed comment capability: $response` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid type for %s` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the explicitly disabled legacy contract` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts an explicit comment gate with optional older release fields omitted` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves enabled switches and ignores future server fields` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid response at the file write boundary too` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-access.test.ts](../../../tests/frontend-club-access.test.ts)

Модуль frontend-club-access.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `paid` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: server-confirmed club access` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves cancellation state %s independently from paid access` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed cancellation state %j` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a real expiry in the transport format %s` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows owner access without a paid period` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a server-confirmed inactive account inactive` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts service access without inventing a paid subscription` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the server's access decision independently of subscribed` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed paid access %j` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the compatibility read %j without interpreting it as access` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed compatibility read %j` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-intent.native.test.mjs](../../../tests/frontend-club-checkout-intent.native.test.mjs)

Модуль frontend-club-checkout-intent.native.test.mjs; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `selection` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `origin` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pages` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `intent` | 58 | Функция. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-intent.test.ts](../../../tests/frontend-club-checkout-intent.test.ts)

Модуль frontend-club-checkout-intent.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `selection` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uuid` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `values` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `storage` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: a return without saved evidence cannot reserve or write a purchase` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads only the saved key after reload without needing the buyer's email, locks or key generation` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: read-only return preserves malformed evidence (%#)` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: read-only return refuses extra fields without exposing browser details` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: read-only return refuses an unavailable browser (%s)` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists before returning a UUID and canonical input, never the email or payment URL` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reuses the persisted identity across independent calls, normalization and arbitrary elapsed time` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a written key when readback throws, allowing a safe later retry` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reserves the requested semiannual purchase rather than silently using monthly` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a changed selection without overwriting an unresolved purchase: %j` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid email before reserving an intent: %s` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not erase or replace malformed persisted evidence (%#)` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed on %s failure; never falls back to an in-memory UUID` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses missing browser support (%s) before saving or returning a key` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: limits waiting for another tab's lock and does not issue an unlocked intent` | 261 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-mode.native.test.mjs](../../../tests/frontend-club-checkout-mode.native.test.mjs)

Модуль frontend-club-checkout-mode.native.test.mjs; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `expectedMode` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `child` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `origin` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `output` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-mode.test.ts](../../../tests/frontend-club-checkout-mode.test.ts)

Модуль frontend-club-checkout-mode.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `render` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `it: public flag %s preserves the legacy screen` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: invalid public flag %s refuses both payment modes` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit TEST build flag selects result and session-gated purchase form without browser access or requests` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: Prodamus demo uses the existing club screen rather than YooKassa reconciliation` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: conflicting or invalid Prodamus flag %s blocks purchase` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-polling.native.test.mjs](../../../tests/frontend-club-checkout-polling.native.test.mjs)

Модуль frontend-club-checkout-polling.native.test.mjs; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `origin` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mode` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `calls` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `firstCall` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `releaseProof` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `proofGate` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-polling.test.ts](../../../tests/frontend-club-checkout-polling.test.ts)

Модуль frontend-club-checkout-polling.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reply` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `values` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `key` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `controller` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: stops after a verified %s without creating, erasing or rotating evidence` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks immediately, then never faster than five seconds, with six checks maximum` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops a slow final check at the total thirty-second budget, retaining last pending state` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops between checks on %s cancellation` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops on a quota refusal without automatic retry, new checkout or evidence changes` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never switches to another tab's intent between checks` | 176 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: absent saved evidence does not start a check or create a purchase` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops at the first success after pending and never starts an overlapping check` | 214 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a first-check timeout is an error, not a fabricated pending/terminal result` | 249 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an already aborted campaign cannot read storage, invoke callbacks or send HTTP` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-result-ssr.test.ts](../../../tests/frontend-club-checkout-result-ssr.test.ts)

Модуль frontend-club-checkout-result-ssr.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: server rendering is deterministic without document, storage, timers or HTTP` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: TEST purchase form starts disabled until a browser check, with no storage, timer or HTTP on SSR` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-result-ui.native.test.mjs](../../../tests/frontend-club-checkout-result-ui.native.test.mjs)

Модуль frontend-club-checkout-result-ui.native.test.mjs; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `origin` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mode` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `calls` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `releaseCreate` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paymentUrl` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `purchaseScreen` | 407 | Функция. Подробности и ограничения — в исходнике. |
| `screen` | 584 | Функция. Подробности и ограничения — в исходнике. |
| `unchanged` | 615 | Функция. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-result.test.ts](../../../tests/frontend-club-checkout-result.test.ts)

Модуль frontend-club-checkout-result.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `response` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `values` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `key` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `prior` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `changes` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `create` | 46 | Функция. Подробности и ограничения — в исходнике. |
| `it: missing evidence reports absence without HTTP or creating an intent` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: publishes only server-checked %s tied to saved evidence` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: duplicate explicit checks cannot overlap an outstanding campaign` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: 429 Retry-After blocks explicit checks until the exact deadline without automatic retries` | 120 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s stops outstanding checks without a late result/error` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: canceling the polling wait keeps evidence and does not resume automatically` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an unrecognized server result becomes a generic error, not terminal proof` | 200 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a finite pending campaign ends as still pending, with checking released and no further request` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-checkout-transport.test.ts](../../../tests/frontend-club-checkout-transport.test.ts)

Модуль frontend-club-checkout-transport.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `firstKey` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `secondKey` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `input` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `output` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `result` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `subscription` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requestUrl` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `response` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `values` | 47 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: sends an intent header on an individual tRPC mutation, never in URL or input` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not merge distinct keyed mutations into a shared batch/header` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed operation keys before HTTP (%#)` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not permit an intent header on a read operation` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves legacy batching without context and does not leak a keyed mutation's header into a concurrent query` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: the club orchestrator sends the saved canonical intent and reuses it after a transport failure` | 163 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: storage refusal prevents the orchestrator from making any request` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an already canceled purchase cannot reserve evidence or dispatch` | 199 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: caller cancellation while waiting for a writer lock prevents late reservation and dispatch` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: caller cancellation aborts purchase transport but retains the same key for explicit retry` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s purchase refuses a late URL after browser evidence was replaced` | 266 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a real request-lifecycle timeout retains the durable identity for an explicit retry` | 300 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: session cancellation aborts a dispatched request without replacing its intent` | 324 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a session change during intent preparation prevents late dispatch under the next identity` | 344 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a return with no saved intent cannot dispatch any check or create request` | 355 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks only saved evidence by POST/header and retains it after %s` | 363 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed return replies without accepting payment proof (%#)` | 396 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: corrupt return evidence prevents HTTP and is never replaced` | 419 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels an outstanding return on %s abort without rotating or retrying` | 430 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an already canceled return cannot read storage or dispatch` | 455 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not apply a late success to %s browser evidence` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a timed-out return leaves the same evidence for an explicit check, never a create/retry` | 506 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-next-checkout.test.ts](../../../tests/frontend-club-next-checkout.test.ts)

Модуль frontend-club-next-checkout.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `selection` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reply` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `values` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `storage` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `previousIdempotencyKey` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `prior` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `held` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reserve` | 64 | Функция. Подробности и ограничения — в исходнике. |
| `purchaseNext` | 71 | Функция. Подробности и ограничения — в исходнике. |
| `it: reserves a distinct durable selection only after fresh %s proof inside the exclusive lock` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cannot replace a %s intent or trust elapsed time` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cannot replace evidence using malformed server proof (%#)` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves evidence and HTTP status on %s refusal` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses stale/invalid expected keys before HTTP (%s)` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s evidence cannot create a next purchase` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not overwrite %s evidence changed while checking the old payment` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s abort during server proof preserves the old intent` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: session change during hashing cannot reserve or check under the next identity` | 237 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a random UUID collision cannot replay the terminal payment as a new purchase` | 247 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lock acquisition expires after five seconds without checking or replacing evidence` | 259 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a denied write cannot erase the prior intent` | 285 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: failed readback never rolls back or dispatches the new durable intent` | 297 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit next purchase dispatches only its newly durable key after fresh %s proof` | 315 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: next purchase never dispatches on %s proof` | 350 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a %s change after reservation prevents next checkout dispatch` | 363 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: next checkout timeout does not retry or roll back and ordinary explicit retry uses the saved new key` | 388 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-order-cache.test.ts](../../../tests/frontend-club-order-cache.test.ts)

Модуль frontend-club-order-cache.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: starts a fresh chronological chain for %j without clearing personal or unrelated data` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late response from the previous order cannot append its offset to the new cache` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-club-payment-mode.test.ts](../../../tests/frontend-club-payment-mode.test.ts)

Модуль frontend-club-payment-mode.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `demo` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: build flags YooKassa=%s Prodamus=%s select %s` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the isolated one-off 790 RUB demo checkout` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses mismatched demo checkout %s` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: NORMAL recovery=%s never selects TEST (YooKassa=%s Prodamus=%s)` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-content-edit-revisions.test.ts](../../../tests/frontend-content-edit-revisions.test.ts)

Модуль frontend-content-edit-revisions.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `draft` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `original` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `edited` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `task` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `describe: documented UTF-8 text limit` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts exactly 65535 bytes (%#)` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains an overlong draft but blocks submission (%#)` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects before capability probes, uploads, or writes, including a replayed create` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores the original revision instead of borrowing a newer detail revision` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a rejected revision and input until a deliberate comparison decision (%s)` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recognizes an already recorded result by reading, without another write (%#)` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a failed post-ACK read never unlocks another mutation` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a missing legacy revision missing on restore and never adopts it from comparison` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never accepts a same-version unresolved write just because a GET is still old` | 214 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not transfer a late read to another owner` | 229 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves article revisions and original snapshots without imposing the post text limit` | 248 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: compares actual fields and dates conservatively, including retained and removed media` | 277 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-cursor-pages.test.ts](../../../tests/frontend-cursor-pages.test.ts)

Модуль frontend-cursor-pages.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `head` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `chain` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: bounded cursor chains` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not cancel a shared head still observed by another screen` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept a repeated boundary, preventing automatic loops` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps eight payload pages while opaque cursors allow returning through a long visited list` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a changed previous boundary and a loop into a discarded opaque page` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-cursor-refresh.test.ts](../../../tests/frontend-cursor-refresh.test.ts)

Модуль frontend-cursor-refresh.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Page` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fixture` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `describe: post page refresh` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refreshes only the head and visible later pages when boundaries are stable` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rebuilds the retained chain after insertion and deletion without duplicates or gaps` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: detects deletion beyond the head and truncates an exhausted tail` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit refresh updates all retained pages; restart reads just the head` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the old confirmed chain intact when a later read fails` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds forward and backward windows and refreshes a deep window without reading the discarded archive` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects looping cursors during refresh as well as pagination` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-dev-proxy.test.ts](../../../tests/frontend-dev-proxy.test.ts)

Модуль frontend-dev-proxy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `upstream` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `request` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `it: forwards the local Origin for %s` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains cookies and request headers without exposing them as response headers` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a foreign or invalid Origin: %s` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects cross-site browser requests even without an Origin` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not enable the remote development proxy on a public Host` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows same-origin reads without adding an Origin` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the deployed behavior in %s` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps existing behavior for an unset/local target: %s` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-document-security.test.ts](../../../tests/frontend-document-security.test.ts)

Модуль frontend-document-security.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: overwrites an attacker-supplied nonce and gives each document a fresh policy` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves the upstream security policy in charge of %s` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows only the configured API origin while supporting existing media players` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: enables development tooling only in development` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: isolates the password document policy at %s` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe configured API origins: %s` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-editor-ranges.test.ts](../../../tests/frontend-editor-ranges.test.ts)

Модуль frontend-editor-ranges.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: native editor range changes` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deletes the selected linked occurrence instead of attaching it to an identical word` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the surviving linked occurrence when an identical unlinked prefix is deleted` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handles %s among repeated characters at the actual caret` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a link on the remaining text after partial deletion` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accounts for UTF-16 emoji deletion` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not move a removed link to another identical fragment without a native hint` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes formatting when its entire text is replaced` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unrelated links when text is inserted before them` | 84 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validates a stale edit hint against the actual text change` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-field-keyboard.browser.test.ts](../../../tests/frontend-field-keyboard.browser.test.ts)

Модуль frontend-field-keyboard.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Field keyboard submission in Chromium` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handles %s` | 99 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-guest-checkout.test.ts](../../../tests/frontend-guest-checkout.test.ts)

Модуль frontend-guest-checkout.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `values` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `response` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `status` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `selection` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signal` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `fetcher` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: persists a canonical email, UUID and 32 cryptographic bytes before dispatch; sends separate POSTs without proof in URLs or headers` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reload and an unknown network result reuse both keys and the same recipient` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s never rotates keys or silently changes recipient` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: only an explicit next purchase with fresh %s proof can rotate both keys` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: storage/coordination failure (%s) prevents every network request` | 191 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: damaged storage is never replaced (%#)` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP %s preserves the original evidence without fallback` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists Retry-After across reload and blocks both create and status until a manual retry` | 234 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists a cooldown when fresh terminal verification is rate limited` | 273 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a replaced recovery secret is not adopted by an existing purchase operation` | 289 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a server refusal preserves the secret without treating it as login or starting another order` | 303 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: after login, server-accepted proof binds only the existing purchase to its recipient; logout and other accounts cannot read it` | 314 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a different logged-in recipient cannot dispatch the unbound guest proof` | 352 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: authenticated terminal completion checks fresh proof then clears only the guest slot` | 368 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: missing/replaced secrets, order mismatch and notRecorded after an acknowledged order cannot erase evidence` | 383 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late result from a previous session cannot bind an order or migrate the secret` | 401 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: the guest build opt-in cannot enable either TEST payment mode` | 415 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: identifies a foreign recipient without exposing or deleting its saved proof` | 427 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a canonical contact in the guest intent and rejects a retry with another contact` | 441 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports invalid phone rather than blaming a valid email (%j)` | 450 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-http-response.test.ts](../../../tests/frontend-http-response.test.ts)

Модуль frontend-http-response.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `rejected` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `rpcError` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `it: preserves HTML HTTP $status through the real $transport tRPC link` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: classifies an invalid HTTP 200 as invalid-response (%s)` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a normal batched profile acknowledgement and SuperJSON dates` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves structured tRPC conflict data for HTTP %s` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps success and denial separate in the same HTTP 207 batch` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an HTML %s triggers the existing global session check once` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not retry a mutation after an HTML 503` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts HTTP-date Retry-After from a %s tRPC refusal` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains HTTP status when an error body itself fails to download` | 244 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a network interruption of an HTTP 200 body temporary` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still times out a hung tRPC response body and clears its timer` | 281 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a tRPC response body when its session changes` | 293 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps private upload size guidance for an HTML 413` | 303 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept a shorthand or overflowing REST Retry-After (%s)` | 316 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validates Retry-After %s against a fixed clock` | 330 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a valid REST HTTP-date delay for %s errors` | 350 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: parses an HTTP-date while retaining the TEST result's existing 60-second bound (%s)` | 375 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a valid delay for an access-email refusal without sending another request` | 404 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-image-optimizer.test.ts](../../../tests/frontend-image-optimizer.test.ts)

Модуль frontend-image-optimizer.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `optimize` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `describe: public photo preview decoding` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: resizes a progressive 37MP portrait instead of falling back to the original` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still rejects images above the bounded 40MP decoding budget` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-legacy-checkout-journal.test.ts](../../../tests/frontend-legacy-checkout-journal.test.ts)

Модуль frontend-legacy-checkout-journal.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `values` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `queue` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signal` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `journal` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `it: a simultaneous tab cannot silently create another order, even after a successful first ACK` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an explicitly authorised replacement rotates only the known unknown attempt` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replacement consent cannot replace an attempt that changed in another tab` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s blocks payment creation` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a failed acknowledgement write keeps uncertainty despite successful creation` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late response cannot acknowledge the original attempt under another account` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: TEST and legacy use separate namespaces and never store contacts, URLs or provider proof` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a decoded tRPC 400 confirms rejection, while a proxy 400 remains uncertain` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-legacy-club-images.test.ts](../../../tests/frontend-legacy-club-images.test.ts)

Модуль frontend-legacy-club-images.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `directory` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `manifest` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `configure` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `optimized` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `it: stays disabled without an explicit true flag (%s)` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies an exact old key before the cache for every role: %s` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves public and unrelated sources: %s` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed or ambiguous sources: %s` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects duplicate source parameters` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed for invalid configuration without leaking its contents` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires the operator's exact manifest digest` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-library-files.test.ts](../../../tests/frontend-library-files.test.ts)

Модуль frontend-library-files.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `page` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `it: rejects a noncanonical file URL: %s` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects duplicate files and untrusted response fields` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: loads every page before exposing files and preserves cancellation` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose a partial list after HTTP %s` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects repeated cursors and duplicates across pages` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported or malformed library MIME: %s` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a filename outside the server metadata contract: %s` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-manager-order-email.test.ts](../../../tests/frontend-manager-order-email.test.ts)

Модуль frontend-manager-order-email.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `settings` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `product` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: prepares the configured recipient and correct product $id without asserting payment or delivery` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: encodes punctuation and line breaks without creating additional recipients or headers` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unsuitable origin %s` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects injected recipients and an unsupported method instead of using a fallback` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-manager-settings.test.ts](../../../tests/frontend-manager-settings.test.ts)

Модуль frontend-manager-settings.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `read` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `appearance` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `configuration` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `describe: manager order settings` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads the configured recipient without a local fallback` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an absent or invalid recipient %#` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not guess an unsupported order method %#` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a valid configuration revision` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shares one pending read between Club and order settings and retains the full response` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps valid Club appearance available when manager settings are invalid` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads order settings independently of a malformed seasonal image` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports a failed refresh and recovers with an explicit retry without automatic repeats` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the last confirmed Club appearance when selection rejects a later response` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-media-safety.test.ts](../../../tests/frontend-media-safety.test.ts)

Модуль frontend-media-safety.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `video` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `it: rejects invalid image dimensions without poisoning remembered proportions` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds the photo metadata cache and retains recently used photos` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handles a 413 body once: %s` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose raw HTML or internal messages from an upload server` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explains the documented video validation refusal: %s` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose an unexpected raw upload error` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects GIF before decoding or reading it as base64` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid upload URL: %s` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: times out even when upload headers arrive but its body hangs` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a direct upload on session change` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a large attachment before FileReader or fetch is called` | 150 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks the complete selection before reading any selected file` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported active image content before decoding` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: closes a decoded bitmap even when creating the canvas fails` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: operation ownership` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: locks synchronously and prevents a late result affecting a reopened editor` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels preparation before a server mutation can start after a session change` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks an upload 401 immediately even when its response body stalls` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-navigation-intent.test.ts](../../../tests/frontend-navigation-intent.test.ts)

Модуль frontend-navigation-intent.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `navigation` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe, unknown or looping return destination %s` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a supported destination %s without carrying secrets` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps only the recognized club flags from an old encoded return link` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: captures an old login link, retains the return across reload, and consumes it once` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reuse a previous return when an invalid legacy destination is supplied` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expires a pending return even when it was also retained in history` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps return destinations separate between tabs` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the current transition and reload history when storage is unavailable` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cleans a payment return without losing its hint or persisting order/token values` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit false flags replace a prior renewal hint` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hands renewal to a clean club page and removes hints from unrelated entries` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes unused payment and secret parameters from product pages while preserving normal anchors` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not clear a login or club query before its owning screen captures it` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-navigation.test.ts](../../../tests/frontend-navigation.test.ts)

Модуль frontend-navigation.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: prefers a post UUID and still resolves older numeric links` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an internal return path: %s` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an external or malformed return path: %s` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handles repeated and absent query parameters` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects executable or malformed link destinations: %s` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves supported link destinations: %s` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects non-string destinations: %s` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows HTTPS payment destinations and rejects other link types` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-normal-checkout.test.ts](../../../tests/frontend-normal-checkout.test.ts)

Модуль frontend-normal-checkout.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `values` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `response` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `expiration` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `slot` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signal` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `fetcher` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: persists a lowercase UUID and the account's plan before POST, without the TEST header or email` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reload keeps the key and selected plan instead of reserving a new purchase` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks only the saved key with GET and accepts a Date through SuperJSON` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s cannot rotate the saved purchase` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a deliberate next purchase verifies fresh %s before creating its distinct key` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an order mismatch never turns another purchase into this intent's successful result` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a change of account prevents dispatch of the previous account's intent` | 177 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late response cannot bind an order to a replaced browser intent` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: corrupt evidence is never overwritten by a temporary key` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: malformed status cannot confirm payment (%#)` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: malformed create reply never opens a payment URL (%#)` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: freezes the unverified contact through a lost response and rejects a changed contact` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-normal-guest-profile.test.ts](../../../tests/frontend-normal-guest-profile.test.ts)

Модуль frontend-normal-guest-profile.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `directories` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `build` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `it: selects NORMAL/GUEST even when the invoking shell enables TEST and disables recovery` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a successful build with %s` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a failing build exit instead of declaring the profile accepted` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-personal-storage.test.ts](../../../tests/frontend-personal-storage.test.ts)

Модуль frontend-personal-storage.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `values` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: never migrates an unowned profile into the next account` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: isolates all personal state while keeping ordinary interface preferences` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: required drafts expose storage failures while optional preferences stay optional` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: profile drafts and unknown writes are scoped and cleared on account changes` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-photo-quality.test.ts](../../../tests/frontend-photo-quality.test.ts)

Модуль frontend-photo-quality.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: preserves already bounded %s bytes before the server's final encode` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps orientation and metadata removal authoritative on the server` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-playback-lifecycle.test.ts](../../../tests/frontend-playback-lifecycle.test.ts)

Модуль frontend-playback-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `it: a quick real hide and return bypasses the previous coalescing window` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a new window blur and focus requires a fresh check even within the window` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returning from a player to the page keeps authority even after the cooldown` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaving the window after focusing a player still requires fresh authority` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hidden documents do not regain authority through focus, online or pageshow` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unsubscribing removes all lifecycle listeners` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-create-intent.test.ts](../../../tests/frontend-post-create-intent.test.ts)

Модуль frontend-post-create-intent.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `payload` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scope` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `api` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uuid` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `keyAt` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `it: independent creations send distinct secure UUIDs even for identical content` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the key and complete payload after a definite rejection of unchanged content` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses a new intent if the user changes content after a definite rejection` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removing a confirmed attachment changes the intent without uploading retained files again` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an existing post is updated without an idempotency key or browser crypto` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: missing secure UUID support fails before dispatch and leaves closing or retry possible` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a pending final create cannot dispatch a second intent through the same editor` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an unknown create sends a key but still forbids blind replay with changed content` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a concurrent upload cannot write again after a %s final create` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-draft.test.ts](../../../tests/frontend-post-draft.test.ts)

Модуль frontend-post-draft.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `draft` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: keeps a draft unpublished and serializes its date` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a valid date before scheduling a publication` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes a schedule without publishing immediately` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves two independent links and combined bold/italic formatting through serialization` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-editor-api.test.ts](../../../tests/frontend-post-editor-api.test.ts)

Модуль frontend-post-editor-api.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uploads` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `task` | 53 | Функция. Подробности и ограничения — в исходнике. |
| `draft` | 55 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: keeps the creation key and payload after a lost reply until explicit recovery` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the revision and conflict without retrying the update` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not send a %s upload when capabilities reject it` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: probes content then attachments with the current operation signal` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops after an account switch while a probe is pending` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-interaction-cache.test.ts](../../../tests/frontend-post-interaction-cache.test.ts)

Модуль frontend-post-interaction-cache.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `it: propagates an authoritative count through existing cards while preserving pages, content and unrelated caches` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes an unsaved post from the retained tail without changing keyset cursors or public lists` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-interaction-data.test.ts](../../../tests/frontend-post-interaction-data.test.ts)

Модуль frontend-post-interaction-data.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bounded post interaction data` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps completed groups stable when older cards are appended` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes duplicate and invalid IDs before applying the wire limit` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts empty marks for accessible posts and marks belonging to the requested set` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-interaction-reader.test.ts](../../../tests/frontend-post-interaction-reader.test.ts)

Модуль frontend-post-interaction-reader.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `empty` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `deferred` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `it: batches per-post cache misses and reuses fresh marks across overlapping screens` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never exceeds 50 IDs and distributes only each post's marks` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: coalesces automatic retries after a transient batch failure` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: drops cancelled work before dispatch without sending an empty batch` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancelling one post neither cancels the other posts nor delivers a late mark to it` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: aborts the transport after the last consumer leaves and can restart after effect cleanup` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid batch responses for every member: %j` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates failures and issues a new receipt only for a successful explicit read` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-recovery.test.ts](../../../tests/frontend-post-recovery.test.ts)

Модуль frontend-post-recovery.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `payload` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `task` | 26 | Функция. Подробности и ограничения — в исходнике. |
| `api` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: waits for durable creation before dispatch, synchronously excluding another final write` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: storage failure before dispatch sends no request and permits a later safe retry` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: journals attachment upload before dispatch and cannot blindly replay it after reload (%s)` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit recovery replays the exact persisted creation with metadata and no second upload` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: definite rejection preserves the intent and cloned uploaded File associations after reload` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an interrupted update stays blocked after reload and is never treated as a recoverable create` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a confirmed commit remains terminal even if persisting confirmation fails` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: session cancellation during persistence prevents dispatch` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: failed explicit recovery retains the same key and payload for another explicit check` | 232 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-save-atomic.test.ts](../../../tests/frontend-post-save-atomic.test.ts)

Модуль frontend-post-save-atomic.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `payload` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `attachment` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `scope` | 26 | Функция. Подробности и ограничения — в исходнике. |
| `api` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: a text edit leaves videos, order, dates and publication status untouched` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a formatting-only edit supplies the plain text required by backend normalization` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an explicit video change sends its final list %j` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: the original snapshot survives changes to editor arrays` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a partial attachment-only edit preserves canonical metadata without replacing other media` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uploads before creating one complete published post` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejected uploads leave post %s untouched; retry reuses confirmed files` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes attachments in one final edit without unpublishing` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancelling after upload cannot commit a post` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a rejected edit reuses uploads and omits an unsaved file removed before retry` | 232 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a confirmed save is never repeated through the same editor` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancellation after a confirmed commit cannot replay attachment insertion` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-save.test.ts](../../../tests/frontend-post-save.test.ts)

Модуль frontend-post-save.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `payload` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `attachment` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `scope` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `api` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `confirmed` | 284 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `malformedUploads` | 289 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: keeps a post unpublished until all attachments are confirmed` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: saves the requested schedule only after preparing attachments` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an explicit upload rejection cannot create a partial post; retry reuses confirmed files` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not repeat a create after the server response was lost` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks abandonment only during the final write, then releases after confirmation` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a definite 404 rejection allows closing without pretending the post was saved` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not repeat an unconfirmed attachment upload` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a malformed update success is not treated as a published post` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancelling before saving cannot start an attachment upload` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: existing media removal is explicit and completes before publication` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: post %s uses canonical server metadata for audio and documents` | 196 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: post %s retains canonical metadata on an explicit save retry` | 247 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-post-videos.test.ts](../../../tests/frontend-post-videos.test.ts)

Модуль frontend-post-videos.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `first` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `second` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: preserves all persisted videos in their media order with their own posters` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a missing private poster empty and preserves every gallery photo` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: matches separate legacy thumbnails without consuming unrelated gallery photos` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not invent a shared cover for multiple legacy videos` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: finds all legacy photo-array videos without duplicating their media representation` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not silently drop distinct persisted media rows with the same URL` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains a photo-only post unchanged` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-article-files.test.ts](../../../tests/frontend-private-article-files.test.ts)

Модуль frontend-private-article-files.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `assetId` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `url` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `photo` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `receipt` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `task` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `it: resolves only referenced photos/documents and preserves old URLs, block order and repeated references` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses missing bytes, wrong usage and unresolved receipts before article submission` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checkpoints bytes/key before upload and recovers a lost reply status-first without another upload` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays notRecorded with identical key and bytes and accepts exact document length with normalized MIME` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an incompatible or leaking receipt %j` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a cancelled/account-switched upload cannot accept a late receipt or write a checkpoint` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: storage failure prevents any upload` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-comment-save.test.ts](../../../tests/frontend-private-comment-save.test.ts)

Модуль frontend-private-comment-save.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `url` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `file` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `ready` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `prepare` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `task` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `api` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `saved` | 50 | Функция. Подробности и ограничения — в исходнике. |
| `it: persists original post/reply/text and file intent before upload; freezes binding before addComment` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lost upload reply recovers status first with the original post/key and no duplicate upload` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: notRecorded replays identical bytes/key and lost addComment reply replays the exact frozen payload` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: storage refusal prevents upload and failed write checkpoint prevents addComment` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects untrusted or pending receipt %j before comment creation` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: account change while awaiting upload ignores late receipt and never writes a comment` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects post/text/photo changes after a lost write instead of silently creating another comment` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pending upload cannot publish; ready status preserves the receipt without another PUT` | 217 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: account change during status or addComment rejects late success` | 233 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a failed frozen-payload checkpoint cannot be bypassed on retry` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: two photos preserve order and a repeated asset cannot substitute for the second receipt` | 278 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid targets, oversized selections and duplicate file intents before network` | 315 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-pattern-assets.test.ts](../../../tests/frontend-private-pattern-assets.test.ts)

Модуль frontend-private-pattern-assets.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: ships private patterns only through authenticated API bindings, retaining public covers` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-post-attachments.test.ts](../../../tests/frontend-private-post-attachments.test.ts)

Модуль frontend-private-post-attachments.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `assetId` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payload` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `file` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `receipt` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `task` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `boundary` | 40 | Функция. Подробности и ограничения — в исходнике. |
| `it: keeps the original attachment and key after HTTP %s, without partial publication` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds only private receipts in the final post transaction (%s)` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reload after lost upload ACK checks status and binds without uploading twice` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit recovery of %s replays original bytes and key, not a new intent` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: status failure %s preserves intent and sends no upload/post` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: account cancellation ignores a late ready receipt and never binds it` | 197 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an invalid or pending receipt never permits publishing: %j` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a cancelled status read cannot apply its receipt to the restored journal` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: journaling failure before private upload sends no bytes` | 263 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a failed final recovery checkpoint can be retried without poisoning a ready receipt` | 276 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-post-photos.test.ts](../../../tests/frontend-private-post-photos.test.ts)

Модуль frontend-private-post-photos.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `assetId` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `url` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reference` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `oldUrl` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `photo` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `payload` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `receipt` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `task` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `boundary` | 46 | Функция. Подробности и ограничения — в исходнике. |
| `coordinatorFor` | 61 | Функция. Подробности и ограничения — в исходнике. |
| `recoverySnapshot` | 66 | Функция. Подробности и ограничения — в исходнике. |
| `it: uploads new photos before binding, preserving old URL order (%s)` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lost upload ACK restores the same intent, status first, without uploading twice` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit %s recovery replays identical bytes and key` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unknown create replays the frozen payload/key without uploading or creating a new intent` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not send any write when the durable checkpoint fails` | 172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects untrusted private receipt without binding: %j` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never dispatches a local marker without its original File` | 204 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: no public fallback when closed-photo transport is unavailable` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: account switch during %s cannot accept a late receipt or bind` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires an installed durable checkpoint before any private photo write` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovery cannot replay a photo before durable storage is installed` | 271 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: malformed notRecorded cannot authorize another upload attempt` | 285 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: status failure %s preserves the unresolved photo without another write` | 301 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a pending upload is not permission to publish` | 321 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: invalid source photo never reaches an upload or post write` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers only the second unresolved photo and preserves the user's reordered carousel` | 353 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an explicitly removed recovered photo is not resurrected or bound` | 396 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-post-videos.test.ts](../../../tests/frontend-private-post-videos.test.ts)

Модуль frontend-private-post-videos.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `assetId` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `selected` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `payload` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `receipt` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `boundary` | 50 | Функция. Подробности и ограничения — в исходнике. |
| `task` | 70 | Функция. Подробности и ограничения — в исходнике. |
| `coordinator` | 72 | Функция. Подробности и ограничения — в исходнике. |
| `it: preserves the busy-video message through the save coordinator for both editors` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts video receipts above the audio/document limit without accepting public URLs` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checkpoints original video bytes/key before raw upload and binds the asset instead of a local/public URL` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not dispatch video bytes or publish when durable storage fails` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers lost upload ACK from status before publishing, without uploading ready bytes again` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicitly replays the same File/key after %s status` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores late %s response after account switch` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a pending upload response uncertain and does not publish a partial post` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid video acknowledgement before binding` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires raw private transport and a durable checkpoint, never public fallback` | 234 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a video poster private and binds its explicit asset without adding it to the gallery` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays a frozen create after lost response without uploading video or poster again` | 264 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not replay an unknown update or upload its video again` | 271 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects missing or repeated local videos and never uploads a removed selection` | 278 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-upload-availability.test.ts](../../../tests/frontend-private-upload-availability.test.ts)

Модуль frontend-private-upload-availability.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `scope` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `payload` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `it: uses a fresh read-only key and forwards cancellation` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid probe result %j` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores a late successful probe after account cancellation` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a new post retryable without writes after probe HTTP %s` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not probe or block text-only publications` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-video-posters.test.ts](../../../tests/frontend-private-video-posters.test.ts)

Модуль frontend-private-video-posters.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `gallery` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `poster` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `privateVideo` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: uses an explicit private video poster without removing a gallery photo` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not guess a private video cover from the first gallery photo: %s` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the legacy public thumb and first-photo fallback` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses each video's own poster in the existing media player` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not share another video's poster with a private video lacking one` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the old media-section poster fallback for a legacy video` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: feed cards keep the whole private-video gallery and explicit poster: %s` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-video-recovery-notice.test.ts](../../../tests/frontend-private-video-recovery-notice.test.ts)

Модуль frontend-private-video-recovery-notice.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `notice` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `it: offers status-first recovery for a video-only uncertain upload` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not offer replay for an unknown post update, even with a private video` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the legacy upload warning without a recoverable private intent` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-video-selection.test.ts](../../../tests/frontend-private-video-selection.test.ts)

Модуль frontend-private-video-selection.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `extract` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `source` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `scope` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `it: selects the immutable original File under one stable key, without network or a receipt` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an optional poster as a separate private File/key, not a gallery URL` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the original video if optional cover extraction yields %s` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a cancelled selection before preparing a cover` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores late cover results/errors after account change (%s)` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid source before optional cover work` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-private-video-transport.test.ts](../../../tests/frontend-private-video-transport.test.ts)

Модуль frontend-private-video-transport.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `key` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `receipt` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requests` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: sends the exact File/key to the private binary route with session-bound credentials` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves HTTP %s without returning server details` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explains that private video uploads are currently unavailable` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid keys before dispatch` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a mismatched/public acknowledgement` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not retry a request whose outcome is unknown` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validates RAW Retry-After %s without retrying or treating 429 as logout` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a future HTTP-date Retry-After` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-prodamus-return-http.test.ts](../../../tests/frontend-prodamus-return-http.test.ts)

Модуль frontend-prodamus-return-http.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `actualFetch` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: the real frontend request reaches TEST result and keeps retries in one quota bucket` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-prodamus-return.test.ts](../../../tests/frontend-prodamus-return.test.ts)

Модуль frontend-prodamus-return.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `token` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pending` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `succeeded` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: extracts the order reference only from its dedicated return fragment` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not interpret an unrelated or malformed hint as a reference (%s)` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads the exact result endpoint without cookies, redirects or caching` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the server's explicit result without inventing sent mail (%j)` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed or identity-bearing results (%j)` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose a server error body or retry a refused request` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an invalid reference before any request` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds reading a hung response body` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels without accepting a late payment response` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops after a verified order rather than requesting another payment` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops pending polling within six serial reads` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not poll errors, including rate limiting` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-profile-draft.test.ts](../../../tests/frontend-profile-draft.test.ts)

Модуль frontend-profile-draft.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fresh` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `defaults` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `old` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: profile draft baselines` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores the original snapshot rather than the latest server revision` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy literal name %s while requiring review` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an unresolved comparison across reload` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: migrates legacy setup without assigning it a server version` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects another owner's draft` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves unsupported structured drafts out of writes` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-pwa-manifest.test.ts](../../../tests/frontend-pwa-manifest.test.ts)

Модуль frontend-pwa-manifest.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `publicRoot` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: ships a decodable %ipx install icon matching its manifest declaration` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-query-cache.test.ts](../../../tests/frontend-query-cache.test.ts)

Модуль frontend-query-cache.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `commentKey` | 153 | Функция. Подробности и ограничения — в исходнике. |
| `it: bounds abandoned %s scopes while retaining an observed screen` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reuses fresh data and refetches after an explicit invalidation` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps inactive data for five minutes, then releases it` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stale content stays cached when focus or the connection returns` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: protected query rejection still asks for a session check: %s` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a failed mutation is never retried automatically` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: evicts the oldest unused comments while keeping an observed reply's data` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds abandoned feed filters without removing pages of the current list` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows an unobserved comment request to settle before cache eviction` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds abandoned club filters independently of feed filters` | 251 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-read-responses.test.ts](../../../tests/frontend-read-responses.test.ts)

Модуль frontend-read-responses.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `date` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `article` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `video` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `card` | 48 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `counts` | 62 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stats` | 63 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `day` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 78 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payment` | 89 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `comment` | 103 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `report` | 117 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `input` | 131 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `valid` | 136 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bad` | 188 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `envelope` | 303 | Функция. Подробности и ограничения — в исходнике. |
| `it: checks that a UUID detail response matches the requested post` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts compatible decoded %s without replacing data` | 307 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed %s before the real tRPC query resolves (%#)` | 314 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves new fields and SuperJSON in %s` | 330 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts an empty %s` | 343 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves readable reports with a non-authorizing permission hint %s` | 355 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves allowed absence for $path ($value)` | 365 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a locked article and valid ISO dates` | 376 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not poison or erase the last confirmed $name cache or retry a malformed 200` | 389 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a malformed success isolated from another success in the same batch` | 432 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reinterpret write acknowledgements or unrelated read protocols` | 451 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an aborted read cancelled while another operation in its batch completes` | 465 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-request-lifecycle.test.ts](../../../tests/frontend-request-lifecycle.test.ts)

Модуль frontend-request-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `privateUploadCalls` | 173 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: omits credentials for a sessionless payment-result request` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still includes session cookies by default` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: times out even when the caller supplies a cancellation signal` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels requests from an old session even if fetch ignores abort` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the deadline active while reading a response body` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose internal messages on server errors` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed session data: %j` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not treat an unsuccessful registration body as success` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads Retry-After without retrying a mutation` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes real tRPC transport errors without discarding their status` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explains $status for $path without retrying or exposing internals` | 182 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a plain HTTP %s refusal before tRPC parsing` | 228 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps ordinary content 404 responses separate from upload availability` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: tRPC preserves only valid Retry-After delay, without provider response metadata (%s)` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves cancellation from an already-aborted caller` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not confirm logout when the response explicitly rejects it` | 337 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-scroll-header.test.ts](../../../tests/frontend-scroll-header.test.ts)

Модуль frontend-scroll-header.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: scroll header direction` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accumulates slow fractional movement and reveals sooner than it hides` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not flicker on small reversals or repeated events` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the top visible through iOS negative overscroll and rebound` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores iOS bottom overscroll and rebound until content actually moves up` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mistake shrinking content or viewport changes for upward scrolling` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts visible on a restored screen and measures from its current position` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-seasons.test.ts](../../../tests/frontend-seasons.test.ts)

Модуль frontend-seasons.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `appearance` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `snapshot` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `describe: season configuration boundary` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts annual date %s` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects annual date %s` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts configured image %s` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe or malformed image %s` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the server season rather than inferring it from the appearance start date` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed public snapshot %#` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves all four seasons and the unrelated manager email` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects duplicate start dates` | 82 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a missing season and a different time zone` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: schedules a Moscow day boundary for %s` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-session-controller.test.ts](../../../tests/frontend-session-controller.test.ts)

Модуль frontend-session-controller.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `deferred` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `it: a late guest response cannot overwrite a successful sign-in` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late loopback session response (%s) cannot replace the new account or its private cache` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an older HTTP refresh cannot clear the in-flight marker of a newer forced refresh` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: switching accounts removes private queries and resets the screen scope` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: login completion does not wait for unrelated query refetches` | 200 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: initial network failure is a recoverable error, not a confirmed guest` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: failed initial session checks preserve public queries: %s` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: repeated initial errors keep public data until a real identity is established` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: logout closes local access immediately and preserves an unconfirmed logout for retry` | 275 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: failed logout cannot silently resurrect the account or accept another login` | 294 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an old login response cannot reopen access after logout` | 310 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: initial refresh can restart after Strict Mode cleanup` | 320 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a pending logout restarts after Strict Mode cleanup without restoring access` | 332 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a 403 permission failure does not discard a valid identity or cause query refetch loops` | 354 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a 401 closes private data before the session recheck completes` | 366 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: another tab can confirm a previously failed logout` | 378 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a temporary session check failure preserves the screen scope for the same person` | 395 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a confirmed guest stays visible throughout a pending background check` | 421 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a temporary background failure preserves identity, queries and scope: %s` | 439 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a guest's failed background check does not become an initial loading screen` | 470 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a 401 followed by a failed recheck never restores the previous identity` | 486 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a session endpoint rejection clears previously confirmed access: %s` | 505 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a malformed background session response still closes private access` | 525 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a confirmed role change clears cached access and remounts the old screen` | 542 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a confirmed profile write supersedes an earlier auth/me %s without clearing private state` | 553 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a failed post-write refresh retains the acknowledged profile and merges fields into the current session` | 600 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a photo ACK changes only the avatar, and late profile writes cannot change another account or a guest` | 622 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: profile ACK and reconciliation cannot cancel an in-flight sign-in` | 652 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: compares profile revisions only inside the same account` | 668 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late lower-revision profile ACK cannot overwrite a newer confirmed profile` | 687 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-static-images.test.ts](../../../tests/frontend-static-images.test.ts)

/ <reference types="next/image-types/global" />

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: static image previews` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serves public feed photographs as resized previews, retaining original viewer URLs` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never proxies signed, private or foreign media: %s` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: can recompress a bundled preview without changing its full-size source` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: offers smaller variants while keeping the original available for a viewer` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lets a small card select an existing small variant without shrinking its viewer` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves signed media URLs, data, blobs and unknown local paths exactly` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mistake inherited object properties for assets` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not manufacture a source when an image is absent` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-styles.d.ts](../../../tests/frontend-styles.d.ts)

Root SSR tests need only CSS module types, not Next's global Node environment.

## [tests/frontend-subscription-expiry.test.ts](../../../tests/frontend-subscription-expiry.test.ts)

Модуль frontend-subscription-expiry.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `state` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `render` | 40 | Функция. Подробности и ограничения — в исходнике. |
| `Probe` | 41 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: does not keep an expired cached paid response active` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unexpired paid access active` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not revoke %s service access on paid expiry` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not preserve expired access when the expiry recheck fails` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-upload-slow.browser.test.ts](../../../tests/frontend-upload-slow.browser.test.ts)

Модуль frontend-upload-slow.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Fixture` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `FixtureWindow` | 34 | Контракт типов. Подробности и ограничения — в исходнике. |
| `WireUpload` | 35 | Контракт типов. Подробности и ограничения — в исходнике. |
| `browser` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `origin` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uploads` | 43 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `statusKeys` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `receipts` | 45 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dropReply` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `assetId` | 47 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `open` | 178 | Функция. Подробности и ограничения — в исходнике. |

## [tests/frontend-upload-transport.test.ts](../../../tests/frontend-upload-transport.test.ts)

Модуль frontend-upload-transport.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uploads` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reply` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `input` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `errorOf` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `it: %s can finish after the ordinary 15-second deadline` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: isolates every file from other files and ordinary writes, keeping the original payload` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: status/read %s keeps the short deadline` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an ordinary mutation still times out in 15 seconds while a file has its own budget` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a hung upload %s stops at 180 seconds without automatic retry` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s cancellation aborts a long upload without accepting a late receipt` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an explicitly supplied operation header on an isolated file` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a malformed operation header before dispatching a file` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a timed-out file status-first using its original key and bytes without re-uploading` | 223 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-video-catalog.test.ts](../../../tests/frontend-video-catalog.test.ts)

Модуль frontend-video-catalog.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `embed` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `card` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: catalog contracts` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps thumbnail opt-in out of old requests and includes it on every enabled page` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts documented public cover location %s` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects private or ambiguous cover input %s` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not load private media or a player as a thumbnail: %s` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses only the supplied public thumbnail URL` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the integration off unless explicitly enabled` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a card without exposing an embed or provider` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the optional public thumbnail field without relaxing other fields: %s` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects damaged or overexposed catalog responses` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops repeated and descending cursors without inventing a cursor` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: canonicalizes exported %s URLs` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects catalog-only invalid parameters %s` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the requested identity and validated provider` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects mismatched or unsafe playback` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept a bare or invalid admin ID` | 208 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes authority on pagehide and needs a new epoch on resume` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-video-retry-after.test.ts](../../../tests/frontend-video-retry-after.test.ts)

Модуль frontend-video-retry-after.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `video` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `ready` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `task` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `it: persists the deadline, refuses an early retry, then checks status before sending the same file/key` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not apply a late 429 to a previous account's draft` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-vk-editor-draft.test.ts](../../../tests/frontend-vk-editor-draft.test.ts)

Модуль frontend-vk-editor-draft.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `detail` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `values` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: accepts revision zero, nullable embed, and compatible additional fields` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed or mismatched detail %j` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists draft, original revision and uncertain state across reload without rebasing` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: another actor cannot read or overwrite the previous account's draft` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exposes %s persistence failures before mutation` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: new videos never receive an ID or expected revision` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a create replay retains its original cover payload even if build flags change after reload` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a matching loaded base for an update and a fresh base after 409/412` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps omitted cover, explicit removal and replacement distinct after reconciliation` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/frontend-vk-video.test.ts](../../../tests/frontend-vk-video.test.ts)

Модуль frontend-vk-video.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `query` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: exported VK player sources` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts an export without an access hash on %s` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the exported identity and hash on %s without autoplay or foreign parameters` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unsafe, ambiguous or incomplete source %s` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/guest-normal-checkout.mysql.test.ts](../../../tests/guest-normal-checkout.mysql.test.ts)

Модуль guest-normal-checkout.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: guest normal checkout recovery over HTTP and SQL` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 42 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 45 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `call` | 66 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: recovers an old guest order with NULL contact without rotating the order` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires contact before new guest creation and preserves it on replay` | 150 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays one order without a login cookie, identity changes or an access grant` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers after the HTTP connection loses the committed response` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes concurrent retries and creates only one canonical new recipient` | 228 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fills a new guest card only from the order that was paid` | 244 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an account created while guest checkout waits on the same email` | 281 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not recover someone else's operation with only UUID or email` | 311 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects changed parameters rather than creating another order` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps namespaces separate and resumes only an existing owned guest intent after login` | 344 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: conflicts safely when the same intent races with two recipients` | 383 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes email and preserves the existing non-recurring semiannual contract` | 395 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays the committed operation across independent compiled processes` | 409 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses missing/disabled configuration and TEST routing without DB writes` | 473 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers status without live keys and refuses merchant drift for replay` | 490 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the order if the durable ledger cannot commit` | 502 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires settlement evidence and never promotes a bare paid row to success` | 514 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a failed outcome without creating a replacement` | 531 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks reads and retries for a blocked or retiring recipient` | 547 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed secrets, GET and batch without exposing proof in a response` | 557 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires the durable path for legacy guest LIVE checkout only when enabled` | 580 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds status polling and returns Retry-After without creating orders` | 594 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/guide-navigation.test.ts](../../../tests/guide-navigation.test.ts)

Модуль guide-navigation.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: recomputes the section position after earlier images expand and after scrolling` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the first section within the scroll container` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/helpers/admin-article-browser-cases.ts](../../../tests/helpers/admin-article-browser-cases.ts)

Модуль admin-article-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Fixture` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerAdminArticleBrowserCases` | 16 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/admin-membership-browser-cases.ts](../../../tests/helpers/admin-membership-browser-cases.ts)

Модуль admin-membership-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AdminMembershipBrowserFixture` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerAdminMembershipBrowserCases` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `memberSessionStatus` | 700 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `members` | 709 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/admin-post-browser-cases.ts](../../../tests/helpers/admin-post-browser-cases.ts)

Модуль admin-post-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AdminPostBrowserFixture` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerAdminPostBrowserCases` | 19 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/api-main-process.ts](../../../tests/helpers/api-main-process.ts)

Launch the real executable with the parent's explicitly isolated environment.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ready` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/helpers/backend-image-probe.ts](../../../tests/helpers/backend-image-probe.ts)

Модуль backend-image-probe.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `pixel` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `{ createBackendApplication }` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/helpers/backend-mysql.ts](../../../tests/helpers/backend-mysql.ts)

Модуль backend-mysql.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `testDatabaseUrl` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `openTestDatabase` | 7 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/backup-image-probe.ts](../../../tests/helpers/backup-image-probe.ts)

Composition-only entry: never import the application executable or workers.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `url` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mode` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/helpers/backup-release-image.ts](../../../tests/helpers/backup-release-image.ts)

Модуль backup-release-image.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `execute` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `prepareBackupImage` | 9 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/club-comments-browser-cases.ts](../../../tests/helpers/club-comments-browser-cases.ts)

Модуль club-comments-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubCommentsBrowserFixture` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerClubCommentsBrowserCases` | 17 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/club-service-access-browser-cases.ts](../../../tests/helpers/club-service-access-browser-cases.ts)

Модуль club-service-access-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `registerClubServiceAccessBrowserCases` | 7 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/club-setup-browser-cases.ts](../../../tests/helpers/club-setup-browser-cases.ts)

Модуль club-setup-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubSetupFixture` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `expectRetiredClubDraft` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `openSetup` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `registerClubSetupBrowserCases` | 67 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/content-editor-acceptance-api.ts](../../../tests/helpers/content-editor-acceptance-api.ts)

Модуль content-editor-acceptance-api.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 12 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/content-mysql.ts](../../../tests/helpers/content-mysql.ts)

Модуль content-mysql.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `openContentTestDatabase` | 5 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/coordination-process.ts](../../../tests/helpers/coordination-process.ts)

Модуль coordination-process.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 10 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/document-fixtures.ts](../../../tests/helpers/document-fixtures.ts)

Built locally with Python's in-memory ZIP writer: content types, root relationship

| Блок | Строка | Назначение |
| --- | --- | --- |
| `docxMime` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `docxFixture` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `docmFixture` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `zipFixture` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pdf` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `offsets` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `xref` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pdfFixture` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/helpers/email-binding-recipient-browser-cases.ts](../../../tests/helpers/email-binding-recipient-browser-cases.ts)

Модуль email-binding-recipient-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `EmailBindingRecipientBrowserFixture` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerEmailBindingRecipientBrowserCases` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `deliveredLink` | 35 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/flac-fixture.ts](../../../tests/helpers/flac-fixture.ts)

Synthetic 100 ms, 8 kHz mono 440 Hz tone; FLAC, no personal metadata.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `flacFixtureBase64` | 2 | Synthetic 100 ms, 8 kHz mono 440 Hz tone; FLAC, no personal metadata. |

## [tests/helpers/http-response-fault-proxy.ts](../../../tests/helpers/http-response-fault-proxy.ts)

Модуль http-response-fault-proxy.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `httpResponseFaultProxy` | 6 | Transport faults only: every response originates in the real loopback API. No retries, fake successes, request body logging or cookie capture. |

## [tests/helpers/journal-object-store.ts](../../../tests/helpers/journal-object-store.ts)

Minimal transaction transport double. NOT native IndexedDB scheduling/browser acceptance.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `journalObjectStore` | 2 | Minimal transaction transport double. NOT native IndexedDB scheduling/browser acceptance. |

## [tests/helpers/library-browser-cases.ts](../../../tests/helpers/library-browser-cases.ts)

Модуль library-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LibraryBrowserFixture` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ensureArticles` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `articleData` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `registerLibraryBrowserCases` | 37 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/list-page-fixture.ts](../../../tests/helpers/list-page-fixture.ts)

Модуль list-page-fixture.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ListPage` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `openListPageFixture` | 17 | Owned SQL rows and real HTTP/JWT only; application workers are not started. |
| `cleanup` | 25 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/loopback-smtp.ts](../../../tests/helpers/loopback-smtp.ts)

Модуль loopback-smtp.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `openLoopbackSmtp` | 4 | A real SMTP wire confined to loopback; never connects to an external server. |

## [tests/helpers/media-fixtures.ts](../../../tests/helpers/media-fixtures.ts)

Generated locally from silence / a single black 16x16 frame with FFmpeg.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `mp3Fixture` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mp4Fixture` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `audioWebmFixture` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `movFixture` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `wavFixture` | 22 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/native-test-failure.ts](../../../tests/helpers/native-test-failure.ts)

Sources belong to our local fixtures, never to a child process or payload.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `nativeTestNames` | 2 | Sources belong to our local fixtures, never to a child process or payload. |
| `nativeTestFailure` | 15 | Child output may contain signed URLs or credentials. Never attach its cause. |

## [tests/helpers/picture-http-fixture.ts](../../../tests/helpers/picture-http-fixture.ts)

Модуль picture-http-fixture.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `startPictureHttpFixture` | 7 | Real pending HTTP bodies, with browser cache enabled and no page.route. |

## [tests/helpers/picture-recovery-fixture.ts](../../../tests/helpers/picture-recovery-fixture.ts)

Модуль picture-recovery-fixture.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `startPictureRecoveryFixture` | 4 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/post-interactions-browser-cases.ts](../../../tests/helpers/post-interactions-browser-cases.ts)

Модуль post-interactions-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostInteractionsBrowserFixture` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerPostInteractionsBrowserCases` | 22 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/private-attachment-process.ts](../../../tests/helpers/private-attachment-process.ts)

Модуль private-attachment-process.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `privateAttachmentProcesses` | 9 | Two fresh compiled Node processes, no dotenv/listeners/jobs from production boot. |
| `start` | 42 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/private-comment-s3-browser-cases.ts](../../../tests/helpers/private-comment-s3-browser-cases.ts)

Модуль private-comment-s3-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Fixture` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerPrivateCommentS3BrowserCases` | 26 | Share the existing owned SQL/S3 fixture; faults affect completed HTTP replies only. |

## [tests/helpers/private-files-browser.ts](../../../tests/helpers/private-files-browser.ts)

Модуль private-files-browser.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `privateFilesBrowser` | 11 | Unchanged Next app/rewrite in an owned copy: no .env reads or generated files written back into the frontend owner's checkout. Public assets are read-only. |
| `close` | 18 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/private-recovery-process.ts](../../../tests/helpers/private-recovery-process.ts)

Модуль private-recovery-process.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `runPrivateRecoveryProcess` | 10 | Fresh process with only the owned DB/wire credentials; never imports production boot. |

## [tests/helpers/private-upload-wire.ts](../../../tests/helpers/private-upload-wire.ts)

Модуль private-upload-wire.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `openPrivateUploadWire` | 6 | Owned SDK wire fixture, not Timeweb ACL acceptance. Stores actual request bytes. |

## [tests/helpers/profile-browser-cases.ts](../../../tests/helpers/profile-browser-cases.ts)

Модуль profile-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ProfileFixture` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerProfileBrowserCases` | 21 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/profile-order-browser-cases.ts](../../../tests/helpers/profile-order-browser-cases.ts)

Модуль profile-order-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `registerProfileOrderBrowserCases` | 7 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/quiz-browser-cases.ts](../../../tests/helpers/quiz-browser-cases.ts)

Модуль quiz-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `QuizBrowserFixture` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `completeCottagecoreQuiz` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `registerQuizBrowserCases` | 60 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/route-drain.ts](../../../tests/helpers/route-drain.ts)

Модуль route-drain.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `trackRouteHandler` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `removePageRoutes` | 25 | Page fallback handlers share route state with the context interceptor. |
| `drainBrowserRoutes` | 33 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/season-admin-browser-cases.ts](../../../tests/helpers/season-admin-browser-cases.ts)

Модуль season-admin-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SeasonFixture` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `initial` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `open` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `registerSeasonAdminBrowserCases` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `withSettings` | 43 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/shop-manager-browser-cases.ts](../../../tests/helpers/shop-manager-browser-cases.ts)

Модуль shop-manager-browser-cases.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ShopManagerBrowserFixture` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `registerShopManagerBrowserCases` | 14 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/text-fixtures.ts](../../../tests/helpers/text-fixtures.ts)

Locally constructed encodings; no private or downloaded documents.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `utf8Text` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `cp1251Text` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `utf16leText` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `utf16beText` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/helpers/video-mysql.ts](../../../tests/helpers/video-mysql.ts)

Модуль video-mysql.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `openVideoTestDatabase` | 5 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/worker-lock-loss-process.ts](../../../tests/helpers/worker-lock-loss-process.ts)

Модуль worker-lock-loss-process.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 12 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/worker-restart-docker.ts](../../../tests/helpers/worker-restart-docker.ts)

Модуль worker-restart-docker.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `docker` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `cleanupAfterFailure` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `dockerRestartFixture` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `removeContainer` | 82 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 89 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `attempt` | 91 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `refresh` | 194 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/worker-restart-process.ts](../../../tests/helpers/worker-restart-process.ts)

Модуль worker-restart-process.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 12 | Функция. Подробности и ограничения — в исходнике. |

## [tests/helpers/worker-shutdown-process.ts](../../../tests/helpers/worker-shutdown-process.ts)

Модуль worker-shutdown-process.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 12 | Функция. Подробности и ограничения — в исходнике. |

## [tests/http-security.test.ts](../../../tests/http-security.test.ts)

Модуль http-security.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `server` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: HTTP policy preserves supported browser/native access` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects compressed bodies before parsing or handling %s` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported Content-Encoding %s` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps explicit identity encoding supported` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows credentialed preflight from the configured frontend` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts native JSON requests without an Origin header` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects untrusted Origin %s before mutation` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects foreign preflight instead of reflecting credentials` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects cookie-bearing form submissions without an Origin` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects cross-site fetch metadata even if Origin is omitted` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lets provider callbacks reach signature verification without trusting their Origin` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: sends no-sniff, no-referrer and anti-framing headers on API responses` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/humanfs-dependency.test.ts](../../../tests/humanfs-dependency.test.ts)

Модуль humanfs-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `removeOwnedFixture` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `removeDirectory` | 16 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: %s preserves symlinks instead of materializing out-of-tree contents` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/identity.mysql.test.ts](../../../tests/identity.mysql.test.ts)

Модуль identity.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: durable access and password links` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `link` | 57 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: password requests do not lock a different account while searching by email` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: queues a private setup link, consumed once without logging in` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent use of a link has exactly one winner` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired and blocked links cannot change the password` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unknown emails create neither users nor mail` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a reset does not overwrite the password before proof, and supersedes older links` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a link sent to the old email cannot change the account after an email change` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a failed reset preparation preserves the previous link and credentials` | 196 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers an expired mail lease but never takes an active lease` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a late failure from an expired lease cannot erase replacement delivery` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired mail is explicitly discarded, never recorded as delivered` | 333 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: only explicit staff can resend access to the stored paid recipient, with an audit trail` | 355 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: SMTP failure remains queued; parallel workers send one message` | 375 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/image-dimensions-lifecycle.test.ts](../../../tests/image-dimensions-lifecycle.test.ts)

Модуль image-dimensions-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ProbeImage` | 8 | Класс. Подробности и ограничения — в исходнике. |
| `ProbeImage.constructor` | 17 | Настройка зависимостей. Подробности и ограничения — в исходнике. |
| `ProbeImage.removeAttribute` | 20 | Метод. Подробности и ограничения — в исходнике. |
| `it: probes a public poster through its preview and returns cancellable ownership` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: releases a stalled poster probe once after its deadline` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports decoded dimensions once and releases its source` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/js-yaml-dependency.test.ts](../../../tests/js-yaml-dependency.test.ts)

Модуль js-yaml-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `lintRequire` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `configRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `yaml` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: charges empty merge sources against the configured processing budget` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized merge sequences even if the key budget is disabled` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects excessive nesting with a YAML error rather than unbounded recursion` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary ESLint YAML, merges, ordered maps and document round trips` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/launch-asset-url.test.ts](../../../tests/launch-asset-url.test.ts)

Модуль launch-asset-url.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: season artwork URLs are image sources, not file-sharing pages` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed input without throwing: %s` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects the sharing page %s for both seasonal fields` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps existing direct-image and default URLs valid: %s` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/launch-capabilities.test.ts](../../../tests/launch-capabilities.test.ts)

Модуль launch-capabilities.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `effects` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `application` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 78 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 97 | Функция. Подробности и ограничения — в исходнике. |
| `describe: first-release disabled features cannot mutate through direct requests` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports server capabilities without caching stale feature switches` | 110 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: advertises content=%s/media=%s/video=%s with effective video=%s without touching storage` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects direct SMS %s without calling SMS or database` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks the public shop redirect before creating a pending order` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks authenticated shop checkout before creating a pending order` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not fulfill an old shop webhook while shop settlement is unsafe` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not deliver queued legacy shop emails while online shop is disabled` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose addresses or create matches when pen pals are off` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows privacy withdrawal to reach persistence even while discovery is disabled` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/launch-settings.mysql.test.ts](../../../tests/launch-settings.mysql.test.ts)

Модуль launch-settings.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: administrator launch settings on disposable MySQL` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists all four seasonal sets and manager email and audits the author` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows one concurrent edit and rejects the stale edit instead of overwriting it` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns an actionable HTTP error for a Yandex sharing page without saving or auditing` | 104 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects ordinary users and freshly blocked administrators` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid admin JSON without a settings row or audit event` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: supports real authenticated HTTP admin roundtrip and public current-season settings` | 201 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves settings and audit history after %s during a save` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves HTTP revision conflict and does not overwrite or audit a stale edit` | 314 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves safe validation errors without storing attacker JSON` | 340 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks the current database role for a valid JWT on %s` | 356 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a newly blocked administrator with an existing JWT on %s` | 382 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects non-JSON settings before attempting admin authentication` | 407 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: annual season selection uses Moscow time, not server locale` | 417 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: selects season at %s` | 422 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-audio-repair.mysql.test.ts](../../../tests/legacy-audio-repair.mysql.test.ts)

Модуль legacy-audio-repair.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: atomic legacy audio replacement on disposable MySQL` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps original media IDs, post bodies, order and dates while binding ready private copies` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reconciles a lost acknowledgement without duplicate assets or audit writes` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the entire batch when the last source row changed` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not apply the first row when the second receipt collides` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back earlier media, receipts and audits after a real SQL failure on the final update` | 163 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses blocked actors, non-club posts, and renditions beyond the existing 32 MiB quota` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores only unchanged own bindings and retains an audit trail` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses rollback after later edits instead of discarding the edit` | 238 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-checkout-limit.test.ts](../../../tests/legacy-checkout-limit.test.ts)

Модуль legacy-checkout-limit.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `actor` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `now` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `send` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `it: limits an authenticated account across different IPs before provider calls, then allows recovery after the window` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts every guest procedure in a batch rather than just the HTTP envelope` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-club-import.test.ts](../../../tests/legacy-club-import.test.ts)

Модуль legacy-club-import.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `photo` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `source` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `describe: legacy Club content boundary` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains photo-only posts, formatting, original dates and a public article` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves %s rather than publishing it during import` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a media row with no source post` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects duplicate source IDs and dangling article cards` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported media URL %s` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses public-feed rows, invalid dates and unrelated account data` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-club-rehearsal.mysql.test.ts](../../../tests/legacy-club-rehearsal.mysql.test.ts)

Модуль legacy-club-rehearsal.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `containerId` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `photo` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stamp` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `content` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: legacy Club rehearsal target guard` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s before any SQL` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: legacy Club transaction on an owned restored database` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back article and post writes when the final media insert fails` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an oversized table instead of fingerprinting a truncated snapshot` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: remaps article cards and media, preserves existing rows and tolerates a lost response` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses changed source content or target content instead of overwriting it` | 181 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses rollback of edited content, then removes only the unchanged imported rows` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-club-staging.test.ts](../../../tests/legacy-club-staging.test.ts)

Модуль legacy-club-staging.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `source` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `describe: approved staging import draft policy` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps only source928 as a non-scheduled draft, leaving original input and other post intact` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses another source snapshot or changed overdue identity rather than silently editing it` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: fixed staging identity guard` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts only the verified database identity and current schema profile` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the existing utf8mb4 option but refuses alternate hosts, databases and unsafe driver options` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pins schema/history while a final backup-bound plan preserves newer user rows` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-image-cache.acceptance.test.ts](../../../tests/legacy-image-cache.acceptance.test.ts)

Модуль legacy-image-cache.acceptance.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: blocks cold and real warm optimizer responses before serving bytes, preserving public controls` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-list-bounds.mysql.test.ts](../../../tests/legacy-list-bounds.mysql.test.ts)

Модуль legacy-list-bounds.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bounded legacy post collections` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `call` | 15 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: refuses oversized %s explicitly instead of hydrating or silently truncating` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: filters legacy feed tags before the cap and keeps page APIs usable` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds the old comments collection and preserves its page endpoint` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid identifiers before reading %s` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-media-copy.s3.mysql.test.ts](../../../tests/legacy-media-copy.s3.mysql.test.ts)

Модуль legacy-media-copy.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabled` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `owner` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `actor` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Bucket` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceKey` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bytes` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `describe: owned tiny streaming PUT canary on real Timeweb and disposable fresh44 SQL/API` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 53 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `unversioned` | 56 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: copies one tiny owned object, verifies real bytes/access and rolls back without touching old data` | 299 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `status` | 307 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/legacy-media-inventory.test.ts](../../../tests/legacy-media-inventory.test.ts)

Модуль legacy-media-inventory.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `execute` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `directories` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `url` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ref` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `run` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `describe: read-only legacy media inventory` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: prepares an explicit plan without source checksums or permission to retire originals` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: maps restricted, shared, unpublished and orphan references without granting deletion` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: redacts signed URLs and credentials and marks ambiguous sources for review` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recognizes protected API references without claiming their bindings are ready` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects mutation mode %s` | 172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses existing output instead of overwriting it` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never fetches a source URL, including a local service` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recognizes the same S3 object behind host case and default-port aliases` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects duplicate slots or an invalid metadata contract` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-media-manifest.test.ts](../../../tests/legacy-media-manifest.test.ts)

Модуль legacy-media-manifest.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `hash` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `input` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `describe: lossless legacy migration manifest` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an exact Unicode database URL while safely resolving its storage key` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the existing Telegram club prefix and @ filenames without broadening source hosts` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: prepares a large-video copy using only a bounded probe, without changing byte-upload limits` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps %s bytes instead of re-encoding` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: copies caller bytes before asynchronous verification` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recognizes a small video container and a document without transcoding` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unverified bytes, wrong source/identity or destructive metadata: %j` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects executable and truncated images` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-media-migration.mysql.test.ts](../../../tests/legacy-media-migration.mysql.test.ts)

Модуль legacy-media-migration.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `source` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `actor` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: legacy migration on current fresh SQL, real API and owned SDK wire` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `input` | 41 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `copyInput` | 64 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 95 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `read` | 98 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `clear` | 110 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `restartedApply` | 125 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: copies exact bytes and binds only the selected slot, preserving public references` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: authorizes admin/member and denies guest, outsider, expiry, blocking and direct storage` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a lost PUT acknowledgement with one object and one binding` | 288 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the source binding when commit fails, then resumes the staged copy` | 308 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an edited source and public parents before storage effects` | 329 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects foreign accounts, stale sessions, disabled flags and wrong-key payload` | 341 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back only its binding, disables its private reference and refuses replay` | 364 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not overwrite a later editor change during rollback` | 385 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves animated GIF bytes and covers while binding article media` | 397 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds article carousel and document slots without touching other blocks` | 433 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: migrates a DOCX with an exact Unicode source URL through the attachment namespace` | 453 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps video IDs, order, bytes and byte ranges through migration and rollback` | 490 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: copies within storage, verifies streaming SHA and preserves the source` | 516 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not hold the administrator row lock while storage is uploading` | 545 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers the committed result in a fresh process after the first response is discarded` | 564 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: runs the stream transfer in an independent process and recovers its discarded response` | 580 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks role after storage work and can resume only after permission returns` | 602 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not resurrect a cancelled pending copy when a late storage response arrives` | 619 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a lost streaming PUT ACK without another copy` | 635 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses changed source or corrupt destination evidence before binding` | 652 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-nginx-http-api.test.ts](../../../tests/legacy-nginx-http-api.test.ts)

Модуль legacy-nginx-http-api.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: does not proxy API credentials over HTTP in the legacy nginx config` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/legacy-upload-retirement.test.ts](../../../tests/legacy-upload-retirement.test.ts)

Модуль legacy-upload-retirement.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storage` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `photo` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `actor` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `admin` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `media` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `it: unpaid member cannot create a public comment photo through the legacy router` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: legacy admin media refuses even valid bytes without a public object` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retired routes cannot fall back when private flags=%s` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retired raw video returns 404 before allocating or inspecting the body` | 99 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: legacy service methods cannot bypass retired HTTP boundaries` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: admin photo refuses ambiguous or private purpose %s` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: explicit publicCover retains photo hardening and uses a public cover namespace` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: native HTTP validates purpose and still admits an explicit cover with private flags off` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ordinary member cannot claim administrator's public-cover purpose` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: public avatar uploads stay available and persist only the actor's URL` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/library-client-bundle.test.ts](../../../tests/library-client-bundle.test.ts)

Модуль library-client-bundle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `free` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: Library client privacy` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps paid guide text out of the newly built production JS/HTML/RSC` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `scan` | 29 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: keeps exactly the original five free fields for %s` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ships no paid guide text or external pattern fallback in either consumer's browser bundle` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/library-file-migration.test.ts](../../../tests/library-file-migration.test.ts)

Модуль library-file-migration.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `hash` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `document` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `it: keeps operator-only library usages out of the existing editor upload contract` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the seven club aesthetic namespaces without broadening free/public namespaces` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: maps exactly the audited 220 visual slots without key collisions or a hidden second page` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: dry-runs a verified manifest without database/storage configuration or exposing bytes and names` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects byte substitution, duplicate slots, unknown materials and path-like names` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validates real image bytes without lossy conversion and rejects disguised active content` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/library-files.mysql.test.ts](../../../tests/library-files.mysql.test.ts)

Модуль library-files.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: library files native HTTP/JWT/SQL` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `seed` | 30 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: streams exact bytes, HEAD and single Range through the stable URL without disclosing a storage address` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies guests, unpaid, expired, blocked and stale actors before storage and preserves paid access` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed for disabled flags, unbound files, unknown keys and arbitrary query URLs` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the agreed display order rather than insertion order` | 219 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports a broken enabled binding as unavailable instead of a successful empty list` | 229 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pages over equal display orders without gaps or duplicates and does not hide a broken next-page binding` | 253 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed cursors without storage requests` | 290 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows a service-access reader to list an empty approved material without claiming a paid subscription` | 305 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/library-files.s3.mysql.test.ts](../../../tests/library-files.s3.mysql.test.ts)

Модуль library-files.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabled` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Bucket` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `acceptedPolicyHash` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `Manifest` | 30 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ImportReport` | 43 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describe: library importer and delivery with real S3` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `policy` | 71 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `remember` | 89 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `ownedObject` | 104 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `imported` | 120 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: recovers lost S3 and committed-import replies across fresh processes without duplicate copies` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serves all six byte-exact files through live club API while anonymous S3 stays closed` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: revokes paid reads on expiry, session change and blocking without granting payment to moderators` | 443 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back only its material and never revives the cancelled operation or a public URL` | 491 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/library-migration.mysql.test.ts](../../../tests/library-migration.mysql.test.ts)

Модуль library-migration.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: library migration rehearsal on native SQL/API/loopback wire` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 61 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `clear` | 64 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `restartedImport` | 126 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: records intent before lost storage ACK and publishes the whole material once on retry` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back a failed binding transaction and retries without additional binary copies` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps stable URLs through replacement and revision-guarded rollback, never reviving the rolled-back import` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects stale revisions and disabled or revoked operators before binary writes` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rehearses six synthetic files across process restarts and lost copy/commit replies without touching public controls` | 251 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serves seven synthetic aesthetic photos only to admin/current members and revokes prior URLs` | 363 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes simultaneous retries into one committed operation and one asset per slot` | 394 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps copied pending files unreadable and refuses recovery after operator revocation` | 422 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a nontransactional binding table before recording intent or copying bytes` | 443 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/library-response-compatibility.test.ts](../../../tests/library-response-compatibility.test.ts)

Модуль library-response-compatibility.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `prepare` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `it: accepts server-prepared TXT metadata: %s` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads a mixed TXT/PDF list through a subsequent page without losing metadata` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves valid filename length %s alongside other files` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/list-page-availability.test.ts](../../../tests/list-page-availability.test.ts)

Модуль list-page-availability.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `actor` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not turn an unavailable database into an empty page` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/list-page-queries.mysql.test.ts](../../../tests/list-page-queries.mysql.test.ts)

Модуль list-page-queries.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: pagination SQL sent to disposable MySQL` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `observed` | 27 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: limits save candidates before hydrating posts and media for page IDs` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: aggregates payments only for returned member IDs, not the whole ledger` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds a root group query separately from aggregate counts` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/login-account-limit.test.ts](../../../tests/login-account-limit.test.ts)

Модуль login-account-limit.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `limiter` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `burst` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `it: shares quota across case and whitespace variants but isolates another account` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: increases cooldown to 30 seconds without a permanent lock or server-side sleep` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refused retries do not move the deadline` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: forgets old attempts after a fixed 15 minute observation window` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a completed successful sign-in clears its quota` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a slow earlier success cannot clear newer reservations` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a stale completion cannot clear a new observation window` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds distinct accounts, preserves active quotas and reclaims expired capacity` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/lost-response-proxy.test.ts](../../../tests/lost-response-proxy.test.ts)

Модуль lost-response-proxy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: drops only the response after the real upstream mutation has committed: %s` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: holds a completed upstream response until released, without replacing it: %s` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/manual-publication.mysql.test.ts](../../../tests/manual-publication.mysql.test.ts)

Модуль manual-publication.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `transport` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: manual publication ownership over HTTP and MySQL` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 59 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 131 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: does not reannounce an already-published post` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retries return success but announce a scheduled post only once` | 150 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent manual requests publish and announce a draft only once` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps explicit early manual confirmation and uses now, not the future schedule` | 182 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a missing ID cannot confirm publication to the admin UI` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a database failure neither publishes nor announces, and a retry can succeed` | 202 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: anonymous, member and blocked administrator requests cannot publish` | 221 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks live $change before any post write` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: manual and scheduled confirmation have only one announcement owner` | 272 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reannounce a transition already committed by the scheduler` | 307 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still repairs a legacy published status with a false visibility flag` | 316 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `editSnapshot` | 328 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rolls back post and old videos when the second replacement insert fails` | 339 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a malformed encoded video filename cannot leave a partial save` | 363 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: announces the saved sanitized text rather than the raw request` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a missing post edit cannot create orphan videos` | 391 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects $change edits after deletion without touching media` | 408 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report attachment save success when the post no longer exists` | 435 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `waitForPostWriters` | 456 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: replaces only videos and preserves documents, decoded names and explicit order` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: omitting videos preserves every attachment on a draft edit` | 508 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an explicit empty video list removes videos but not documents` | 518 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves explicit null and backdated publication dates` | 535 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an omitted publication date is filled only after locking an undated post` | 550 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent edits keep one complete matching post and video revision` | 558 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an empty saved text is not replaced by the previous text in its announcement` | 592 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a media-only edit succeeds without an empty SQL SET and keeps the post unchanged` | 603 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: eight waiting edit requests have only one publication owner` | 614 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an edit behind manual confirmation cannot announce the same transition` | 636 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `creationSnapshot` | 659 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: creates a post with audio and documents committed before announcing` | 678 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back new posts and earlier media when an attachment insert fails` | 714 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: edits a published post and removes its document without a second announcement` | 739 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back text, visibility, videos and removals when attachment persistence fails` | 759 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cannot remove another post's attachment or use attachment removal to delete a video` | 784 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe attachment URLs at the API boundary: %s` | 799 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not retain a new published post when its second video insert fails` | 815 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back a new draft and its first video after a filename decoding failure` | 835 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the created numeric ID and announces normalized text after saving videos` | 849 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves nonpublic creation semantics: $status/$publishedAt` | 891 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an unfinished %s creation is invisible to readers and the scheduler` | 922 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s cannot create a post` | 976 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a blocked administrator cannot create a post` | 994 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/media-base64.test.ts](../../../tests/media-base64.test.ts)

Модуль media-base64.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: canonical media Base64` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: decodes %s exactly` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses malformed or noncanonical encoding %j` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves every byte and refuses nonzero unused padding bits` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: enforces a decoded-byte ceiling including padding without changing valid bytes` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks both unused bits for every two-byte suffix` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not disguise invalid padding bits as a size rejection` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/media-content-policy.test.ts](../../../tests/media-content-policy.test.ts)

Модуль media-content-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `resolve` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `describe: media policy independent of legacy public uploads` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: resolves %s without modifying its bytes` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects document %s` | 120 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cannot disguise a binary document as plain text` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects foreign bytes labelled PDF or DOCX` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a PDF/DOCX format swap` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: resolves %s %s from actual bytes` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses audio bytes in the video category` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses foreign/truncated bytes as audio or video` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid or unsafe declared MIME %s` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/media-encoding-limit.test.ts](../../../tests/media-encoding-limit.test.ts)

Модуль media-encoding-limit.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storage` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: rejects encoded data above the existing 50 MiB JSON ceiling before storage` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/media-reference-map.test.ts](../../../tests/media-reference-map.test.ts)

Модуль media-reference-map.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `shared` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `article` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `it: groups a public cover and restricted section without using the upload prefix` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unpublished public article references restricted and identifies legacy and markdown links` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains unknown or malformed section diagnostics instead of approving an empty map` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports a non-string block kind without coercing user-provided objects` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: diagnoses null URL array elements instead of silently dropping them` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unknown visibility metadata without leaking input values` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not merge query variants or expose signed URL values in its report` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: runs the offline stdin collector without configuration and fails closed on invalid input` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a valid JSON snapshot exceeding the stdin byte budget without producing partial output` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: runs all selected sources through stdin and reports omitted source coverage` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains unresolved parent associations instead of labelling their objects unassociated` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains known URL fields in unknown article blocks without guessing their visibility` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports malformed unknown-block URL fields but retains valid candidates without a cover` | 274 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unknown parent evidence unresolved when a public reference uses %s` | 305 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: maps explicit object identities and external hashes without guessing from URL prefixes` | 358 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects ambiguous object aliases and retains unmatched URL hashes as unresolved, never orphan` | 399 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-browser.mysql.test.ts](../../../tests/member-email-binding-browser.mysql.test.ts)

Модуль member-email-binding-browser.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `frontend` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: member email form with native API and disposable SQL` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 62 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 65 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `open` | 194 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `send` | 207 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `proof` | 330 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: commits one queued intent without changing the member identity and recovers it after reload` | 362 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays a committed request after a lost HTTP reply without another outbox or audit row` | 415 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: prepares a fresh draft only after native expiry and sends a new intent only on explicit submit` | 468 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refreshes canonical member data after native proof confirmation while preserving existing access and credentials` | 534 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: confirms from the recipient page only after explicit action without changing credentials, access or browser identity` | 587 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not show confirmation or change SQL when the recipient submits an expired proof` | 654 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the committed result ambiguous after a lost confirmation reply and a consumed-proof reopen without duplicating audit` | 687 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses $operation from a stale admin form after the actor becomes $role without changing SQL` | 760 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-confirmation.mysql.test.ts](../../../tests/member-email-binding-confirmation.mysql.test.ts)

Модуль member-email-binding-confirmation.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: single-use member email confirmation on owned MySQL` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 35 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 38 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `waitForBlocker` | 86 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `queue` | 106 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `expectTerminal` | 133 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: binds only email, atomically consumes and scrubs the proof, and never changes credentials or paid access` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid or unknown proof without altering a pending intent (%#)` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: has exactly one winner for six concurrent uses of the same proof` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses non-string input before querying or mutating identity (%#)` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never accepts or consumes a password %s proof` | 248 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses terminal %s state even with residual proof material` | 271 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expires and scrubs a valid but expired proof without granting email` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks recipient after queuing and never overwrites it (%s)` | 310 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels and scrubs an intent if its recipient has been deleted` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses normalized email occupied after queueing without changing either identity` | 346 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: arbitrates two distinct pending members for the same email with exactly one owner` | 362 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handles a real unique-index race after its occupied-address snapshot without leaking or retaining PII` | 383 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not bind if the proof expires while its email update waits on the unique index` | 411 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: observes a recipient revocation committed while waiting on the recipient lock` | 442 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the identity, proof and outbox together when confirmation audit fails, hiding SQL details` | 466 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows confirmation after delivery discarded its cipher, preserving historical sent time` | 493 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-delivery.mysql.test.ts](../../../tests/member-email-binding-delivery.mysql.test.ts)

Модуль member-email-binding-delivery.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: binding proof delivery through MySQL and loopback SMTP` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 30 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 33 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `queue` | 88 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `status` | 101 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `emailedProof` | 109 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: delivers a single-use fragment proof, clears its cipher and leaves the account unchanged until confirmation` | 131 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an SMTP rejection retryable without changing its proof or sending on the backoff interval` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: discards a %s recipient proof without an SMTP request` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: two concurrent workers deliver one message` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not send a paused claim after it becomes %s` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a crashed lease only after expiry` | 309 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not let a stale acknowledgement overwrite a replacement lease` | 329 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not resurrect a proof confirmed before its SMTP acknowledgement is recorded` | 347 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never sends unverified proof material (%s)` | 366 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops after twelve failed attempts and releases the pending intent` | 401 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not create a thirteenth attempt after the last worker crashes` | 419 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retries an unrecorded SMTP acceptance with the same proof and message identity` | 435 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-http.mysql.test.ts](../../../tests/member-email-binding-http.mysql.test.ts)

Модуль member-email-binding-http.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: email binding native HTTP and MySQL` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 30 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 33 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `call` | 88 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `safe` | 105 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `proof` | 111 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: is closed by default for request/status/confirm without creating an intent` | 131 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: redirects the public read-only entry to the configured frontend without consuming a proof or changing identity` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses query-bearing entry without reflecting proof or redirect input` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed on invalid configured frontend navigation` | 197 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates once, recovers safe status and rejects key reuse with a different payload` | 208 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires current administrator authority on request and status` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a stale session on both protected routes` | 249 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unavailable actor on both routes: %s` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validates strict inputs and unavailable targets without leaking values` | 266 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires explicit public proof POST and never authenticates or grants a subscription` | 273 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed and unknown proof bodies identically` | 302 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns sanitized 503 and rolls back a request on SQL failure` | 313 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires same-origin even for another CORS-allowed origin` | 322 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires JSON and preserves bounded parser errors without echoing input` | 342 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not spend mail quota on status polling and bounds proof attempts` | 370 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back failed confirmation and permits the same proof to retry` | 383 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: registers request, recovery and confirmation in compiled production ESM` | 398 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-lifecycle.mysql.test.ts](../../../tests/member-email-binding-lifecycle.mysql.test.ts)

Модуль member-email-binding-lifecycle.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: email binding lifecycle on owned MySQL` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 29 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 32 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `queue` | 76 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `binding` | 85 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: expires unused proofs, scrubs delivery secrets, and permits a fresh intent without modifying accounts` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: purges %s history only after 30 days, including its outbox` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back expiry and scrubbing when the audit cannot be persisted` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds each pass and concurrent cleaners never expire an intent twice` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: includes the exact expiry and 30-day retention boundaries` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: re-reads lifecycle state after waiting for the recipient lock` | 231 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid batch size without modifying an intent (%s)` | 276 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-request.mysql.test.ts](../../../tests/member-email-binding-request.mysql.test.ts)

Модуль member-email-binding-request.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: first email binding request on owned MySQL` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 31 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 34 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `expectNoRequest` | 79 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: atomically queues a separate encrypted proof and audits without touching any user fields` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays the same normalized intent without regenerating proof, mail or audit` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects same-key payload changes without damaging the original request: %j` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: another administrator cannot reuse an intent key` | 208 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays a terminal intent after its PII is scrubbed without issuing another proof` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing actor before committing any intent` | 246 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing recipient without keeping its claim` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks current actor authority for %s` | 265 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s and leaves no request, mail or audit` | 285 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an occupied normalized address without modifying its owner` | 310 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validates the email before creating anything: %j` | 321 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed with missing encryption and rolls back the claim` | 333 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed encryption configuration without creating PII: %#` | 340 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid bounded request input: %j` | 354 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back proof and outbox when auditing fails, without leaking SQL details` | 365 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent identical intent retries create exactly one request, outbox and audit` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: competing intent keys for the same member produce one pending binding, not two proofs` | 401 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-status.mysql.test.ts](../../../tests/member-email-binding-status.mysql.test.ts)

Модуль member-email-binding-status.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: administrator email binding status on owned MySQL` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 29 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 32 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: projects only the recoverable receipt without exposing PII/proofs or mutating data` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: permits a second current administrator, not only the original request actor` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports sent after terminal cleanup without claiming inbox delivery` | 131 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mutate an expired pending request during inspection` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed for unusable/missing delivery: %s` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a leased retry queued without changing its attempt or schedule` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks authority before existing and absent request lookup: %s` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a removed actor` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns no receipt for an absent or purged request` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never presents a terminal %s intent as queued even if a cipher remains` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for concurrent actor revocation and refuses the previously valid session` | 241 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed lookup keys` | 272 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed actor versions before querying` | 282 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: sanitizes database errors without bound values or SQL causes` | 291 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/member-email-binding-worker.mysql.test.ts](../../../tests/member-email-binding-worker.mysql.test.ts)

Модуль member-email-binding-worker.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: binding jobs through the real worker and owned SQL/SMTP` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 33 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 36 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `queue` | 89 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cycle` | 98 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: enabled worker delivers a pending binding without changing identity or access` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binding jobs remain disabled for flag=%s` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retries SMTP refusal only after the persisted delay` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expires proofs and purges terminal history through the scheduled worker` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses partial schema (%s) before cleanup or delivery` | 232 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/members-page.mysql.test.ts](../../../tests/members-page.mysql.test.ts)

Модуль members-page.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: member pages over real HTTP/JWT/disposable MySQL` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pages %i new members without tie-date skips or duplicated accounts` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: projects the old safe fields and computes only future paid expiry` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: honors a 50-member page while retaining its next boundary` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: continues after the cursor account is deleted and new accounts arrive` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not let a new userId filter or different account reuse a page token` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects guest/non-admin actor %s` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks role revocation between pages` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid input %j` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/migration-command.test.ts](../../../tests/migration-command.test.ts)

Модуль migration-command.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scratch` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `execute` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `environment` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `describe: migration update command` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `run` | 59 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: never generates or applies SQL when preflight refuses` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: applies reviewed SQL only after the database-required gate` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates an application failure rather than reporting success` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: actual read-only preflight CLI` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `fixture` | 108 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: keeps ordinary file-only preflight independent of application credentials` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires an explicit inspection connection for the Feed index gate` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires an explicit application connection for the apply gate (%j)` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses different inspection and application databases without exposing their URLs` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $label` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported arguments %j` | 267 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/migration-email-gate.test.ts](../../../tests/migration-email-gate.test.ts)

Модуль migration-email-gate.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `mocks` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sql` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `migrations` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: CLI email migration gating` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `run` | 58 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: checks pending identity data and refuses its issues %j` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not inspect identities when the migration is already applied` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops before data inspection on a history mismatch` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops before any database connection on a manifest gap` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a rejected data inspection fail-closed and withholds its error details` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/migration-history.test.ts](../../../tests/migration-history.test.ts)

Модуль migration-history.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `mocks` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: read-only migration history connection` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: issues only fixed metadata reads inside a read-only transaction` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not create an absent migration journal` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: closes the connection after a metadata query fails` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still closes the connection if rollback fails` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an invalid connection before opening it: %s` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/migration-preflight.test.ts](../../../tests/migration-preflight.test.ts)

Модуль migration-preflight.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `journal` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `files` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: non-mutating migration preflight` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: records exact Drizzle-compatible hashes without exposing SQL` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks orphaned SQL rather than silently adding it to the journal` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks missing and empty migration files` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed or ambiguous journal %#` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts only a matching applied prefix and reports pending tags` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks absent history rather than assuming a live database is new` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks unknown, edited, duplicated and skipped historical migrations` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the reconciled repository and hashes the same bytes as Drizzle` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/migration-reconciled-layout.test.ts](../../../tests/migration-reconciled-layout.test.ts)

Модуль migration-reconciled-layout.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: uses the already accepted fresh identities as the canonical release journal without changing SQL` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/minimatch-dependency.test.ts](../../../tests/minimatch-dependency.test.ts)

Модуль minimatch-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `lintRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `matcherPath` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: bounds %s without blocking the test worker` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves lint glob, dot, brace and partial matching semantics` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/moderation-comment-audit.mysql.test.ts](../../../tests/moderation-comment-audit.mysql.test.ts)

Модуль moderation-comment-audit.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: reported comment audit on disposable MySQL` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clearFixture` | 36 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 87 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rejectAudit` | 102 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: restores comment, reply parent, likes and reports when its audit fails` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back deletion through real HTTP and JWT without exposing SQL` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: commits deletion and audit while retaining the detached reply and its reactions` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves NOT_FOUND without audit or cascade for an absent comment` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: continues to delete a comment without reports and records its audit` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/moderation-report-actions.test.ts](../../../tests/moderation-report-actions.test.ts)

Модуль moderation-report-actions.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `actor` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `databaseRow` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `stubRead` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `describe: report author actions are actor-scoped UI hints` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s reading an author with role %s` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not offer a forbidden or redundant block %#` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: defaults to no action when a non-HTTP consumer has no actor` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/moderation-report-audit.mysql.test.ts](../../../tests/moderation-report-audit.mysql.test.ts)

Модуль moderation-report-audit.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: report dismissal audit on disposable MySQL` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 36 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 76 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rejectAudit` | 88 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: retains the dismissed report when the audit write fails` | 92 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back report dismissal through real HTTP and JWT without exposing SQL` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: commits only the selected dismissal and the moderator audit` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the existing audited success for an absent report` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recomputes author actions and still rejects a stale hint after a role change` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not offer self, absent or already blocked report authors` | 167 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/moderation-user-audit.mysql.test.ts](../../../tests/moderation-user-audit.mysql.test.ts)

Модуль moderation-user-audit.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: moderation user mutations and audit on disposable MySQL` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `state` | 61 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rejectAudit` | 73 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rolls back blocking, session revocation and cancellation intent when audit insertion fails` | 266 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back unblocking when audit insertion fails` | 281 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: commits blocking with its audit and pending cancellation without provider confirmation` | 292 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: commits unblocking with its audit without resetting sessions or cancellation intent` | 321 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/multi-api-compose.test.ts](../../../tests/multi-api-compose.test.ts)

Модуль multi-api-compose.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: multi API resolved Compose preflight` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves private flags and budgets the actual merged stack (TEST=%s)` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/multi-api-policy.test.ts](../../../tests/multi-api-policy.test.ts)

Модуль multi-api-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `capacity` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: accounts for every API replica, the TEST ingress, and an operator connection reserve` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses the former 8GiB budget after scaling the API` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses the old 30-connection limit when TEST ingress also shares MySQL` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not let the optional TEST ingress silently keep local quotas` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses inconsistent %s without exposing either value` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses incomplete memory ceilings, public API ports and too-short stop grace` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires persistent API restart, got %s` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an overriding deploy restart policy` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses API network namespace overrides without published ports: %s` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects short JWT secrets after the same normalization as API startup` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid or noncanonical link key (%#) without printing it` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires the tested 40-waiter profile for the public API` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid capacity %s` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/multipart-teardown-dependency.test.ts](../../../tests/multipart-teardown-dependency.test.ts)

Модуль multipart-teardown-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: keeps a late multipart filter callback from crashing after teardown` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/mysql-backup.test.ts](../../../tests/mysql-backup.test.ts)

Модуль mysql-backup.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `harness` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: MySQL backup credentials and completion` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: passes credentials through an unlinked owner-only file` | 167 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes interrupted dump files and preserves completed and unrelated files` | 196 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose spawn arguments or credentials when mysqldump is missing` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects partial dumps without returning sensitive stderr or keeping a usable-looking file` | 231 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for process success even when stdout finishes before a failing exit` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows the next scheduled attempt after a failed dump instead of waiting a day` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shares one in-progress backup even when callers explicitly bypass the interval` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a complete local copy and a safe warning when S3 $failure fails` | 260 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cleans up credentials and stops the dump when writing fails` | 365 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cleans up an output stream even if launching the tool throws synchronously` | 383 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: quotes option-file metacharacters without injecting extra settings` | 390 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: roundtrips special password characters through the real MySQL option parser` | 401 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates a restorable dump with the real MySQL client on a disposable database` | 418 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid configuration without echoing credentials (%#)` | 463 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/native-test-failure.test.ts](../../../tests/native-test-failure.test.ts)

Модуль native-test-failure.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: recognizes multiline literal names but never dynamic diagnostic names` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: reports only trusted failed native test names, never child error details` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `test: classifies native runner failure without forwarding captured output` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-admin-articles.mysql.test.ts](../../../tests/nest-admin-articles.mysql.test.ts)

Модуль nest-admin-articles.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: native admin article CRUD over HTTP/JWT/MySQL` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clearOwnedRows` | 60 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `create` | 131 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `article` | 140 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `teaser` | 147 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: replays a committed article creation without duplicating its teaser` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a changed article payload for the same creation key` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not recreate an article deleted after its creation reply` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps hidden/private bodies, legacy block normalization and admin ordering` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps published public and club cards in repository order without article bodies` | 202 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unpublished internal lookup available without publishing it to guests or admins` | 219 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: locks club article bodies for guests while authorized admins receive the body` | 238 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: M1 identifies an object shared by a public cover, a restricted section and an auto-created club teaser` | 258 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: M1 collects selected raw SQL article rows without dropping unknown blocks or rewriting data` | 354 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: M1 retains raw SQL associations when a real parent is omitted from the selected snapshot` | 415 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes legacy published sections in both repository lists and public detail` | 487 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `ordinaryReader` | 510 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rechecks a paid ordinary reader's expiry on the next request with the same session` | 526 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not unlock an ordinary reader's article from a future %s payment` | 544 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: locks a paid reader's article immediately after blocking the account with an existing session` | 553 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates a trimmed club article with existing defaults and one teaser` | 565 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes all supported blocks without storing empty media or duplicate carousel URLs` | 591 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains partial edits, explicit null cover, teaser refresh and unpublication cleanup` | 631 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replaces sections with an empty list without retaining old content` | 685 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deletes the article and its teaser discussion/reaction/attachment rows` | 699 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses update of a missing article without creating a teaser` | 747 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps deletion of a missing article idempotent` | 757 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a stale editor save after the article was deleted` | 764 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves an orphan teaser unchanged on a refused edit until explicit deletion` | 782 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves refusal of an empty patch for an existing article` | 798 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed create input before any SQL write (%#)` | 808 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed update input while retaining the draft (%#)` | 832 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies every article operation after live identity change (%s)` | 851 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains native article CRUD and private catalog in compiled ESM` | 890 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-admin-content-maintenance.test.ts](../../../tests/nest-admin-content-maintenance.test.ts)

Модуль nest-admin-content-maintenance.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: native admin content maintenance service boundary` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $method returns the injected content provider's outcome, not a direct SQL outcome` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $method preserves a domain refusal from the injected provider` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: $access` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cannot execute $method` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s rejects a malformed ID before doing content work` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s with the real provider does not announce success without a database` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps cleanup's existing no-database no-op response` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: bounded payment history` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s before accessing payment history` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid pagination input %j` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns service unavailability rather than a false empty page` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: admin $name read availability` | 231 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing database rather than returning an empty list` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns a safe native HTTP error rather than known empty data` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the access refusal for %s before the database error` | 250 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: video metadata import` | 271 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the injected import service outcome with validated input` | 272 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a domain refusal from the injected import service` | 303 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps ordered metadata, null defaults and the persistence count` | 327 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the empty import response without inventing records` | 374 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed metadata before persistence (%#)` | 386 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies video import for %s` | 412 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose a failed persistence operation as a successful import` | 436 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-admin-content.mysql.test.ts](../../../tests/nest-admin-content.mysql.test.ts)

Модуль nest-admin-content.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: native admin content reads over HTTP/JWT/MySQL` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains private admin reads in compiled ESM with real HTTP/JWT/SQL` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unpublished bodies and sorted attachments in the full admin catalog` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pages lightweight admin cards without losing draft editing data` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts forward infinite-query requests across admin pages` | 246 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds card bodies and keeps complete data only in protected detail` | 263 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unbounded pagination and preserves admin authorization` | 293 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns day summaries instead of all bodies, including a dense day and local boundaries` | 319 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the existing header counts including a hidden published record` | 376 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps catalog order for scheduled posts sharing one upcoming time` | 384 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds calendar windows and checks access to calendar and counters` | 399 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: orders equal-position admin posts by publication date with creation fallback` | 446 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not attach a private draft's files to admin posts without media` | 463 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains combined filters and date order (%#)` | 473 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: orders calendar entries by scheduled time, not catalog or creation order` | 488 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns only the requested draft's ordered media with canonical SQL metadata` | 495 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains an empty result for a post without attachments` | 515 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains dashboard counts and the private draft's real SQL reaction count` | 520 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: limits dashboard leaders to five and truncates private draft previews to 80 characters` | 535 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies every admin read after live identity change: %s` | 556 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid filters at the HTTP boundary (%#)` | 580 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-application.test.ts](../../../tests/nest-application.test.ts)

Модуль nest-application.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `application` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `it: fails safely without a database for public launch configuration` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects foreign origin %s before a real mutation handler` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves credentialed preflight and security response headers` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects cookie-bearing cross-site simple requests` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves native logout and its cookie clearing contract` | 84 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the configured request limit at %s` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps malformed JSON out of handlers and out of error responses` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: authenticates anonymous uploads at %s before allocating the oversized body` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retires %s before parsing its body` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps tRPC public queries, types and protected-role checks reachable` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves PHP-shaped provider payload and HMAC verification for %s` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not grant a session on the provider browser return` | 177 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves disabled-feature policy at %s` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns 404 for an unknown route and releases its listener on close` | 196 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serves the existing health and capability contracts through the real application` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-auth-composition.test.ts](../../../tests/nest-auth-composition.test.ts)

Модуль nest-auth-composition.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `apps` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `application` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `it: tRPC logout uses the same app-owned session boundary as its verified actor` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a refusal from one app does not clear its cookie or prevent logout in the other` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-billing-checkout.test.ts](../../../tests/nest-billing-checkout.test.ts)

Модуль nest-billing-checkout.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `application` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checkout` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `it: the live HTTP adapter uses its Nest-managed checkout provider` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP checkout validation rejects malformed input before provider work` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves checkout failure semantics over the real HTTP transport` | 70 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-billing-subscription.test.ts](../../../tests/nest-billing-subscription.test.ts)

Модуль nest-billing-subscription.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paidUntil` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `application` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `subscriptions` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sessions` | 40 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 41 | Функция. Подробности и ограничения — в исходнике. |
| `it: HTTP status uses the Nest-managed subscription provider for guests` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP claim uses the verified session ID and Nest provider` | 82 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP cancellation retains paid expiry via the Nest provider` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: anonymous HTTP %s is rejected before billing` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocked HTTP %s is rejected before billing` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP cancellation failure remains a safe failure, not success` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: real service exposes a queued cancellation over HTTP without masking it as 500` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-billing-webhook.mysql.test.ts](../../../tests/nest-billing-webhook.mysql.test.ts)

Модуль nest-billing-webhook.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `secret` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `encryptionKey` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payment` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `canonical` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: signed native Prodamus ingress through disposable SQL` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clearFixture` | 59 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 95 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `guardedState` | 106 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `notify` | 125 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: grants one paid period and one durable access mail across sequential and concurrent HTTP replays` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects wrong $name without granting or queuing anything` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsigned ingress without durable effects` | 225 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an ordinary-key signed demo before granting actual SQL access` | 230 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back settlement on mail-link failure and accepts a clean HTTP retry` | 237 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a blocked initial recipient without durable changes and accepts retry after unblock` | 257 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a blocked renewal without changing paid history and accepts retry after unblock` | 283 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a blocked recipient before acknowledging an existing receipt replay` | 307 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an initial charge claiming a saved profile with another $name` | 322 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `renewalNotification` | 366 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: grants one renewal period across concurrent and later signed HTTP replays` | 393 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses renewal with $name without extending access` | 428 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back a renewal when its access-link write fails and accepts a clean HTTP retry` | 446 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cancellationState` | 468 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cancelNotification` | 477 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: acknowledges cancellation only after SQL confirmation, preserves expiry and safely acknowledges replays` | 499 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mark a new unbound order cancelled when an older profile closes` | 545 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses cancellation with $name without changing paid access` | 558 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back profile confirmation when paid-order cancellation fails, then accepts a clean HTTP retry` | 580 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-billing-webhook.test.ts](../../../tests/nest-billing-webhook.test.ts)

Модуль nest-billing-webhook.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `application` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `body` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sign` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payment` | 422 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `notify` | 431 | Функция. Подробности и ограничения — в исходнике. |
| `it: native cancellation honors the application-owned $decision decision` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: native cancellation keeps %s as a generic failure` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancellation native HTTP preserves $name` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a normally signed demo over native HTTP without entering settlement` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: POST $contentType keeps body precedence in the signed payload` | 276 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an added own JSON __proto__ field before settlement` | 308 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s webhook uses its application-bound handler, not the legacy runtime global` | 322 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: native webhook forwards original bytes beyond the ordinary JSON body limit` | 347 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: oversized webhook is rejected before its handler without leaking bytes` | 371 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handler bindings are isolated between application instances` | 385 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signed callback preserves the settlement outcome %s` | 442 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signed legacy field aliases preserve the exact club settlement proof` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signed monthly payment preserves the nested subscription binding in settlement` | 507 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a valid signature from another merchant cannot reach settlement` | 549 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: club acknowledgement follows the application-bound settlement decision` | 556 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recurring acknowledgement uses the same application-bound settlement service` | 582 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: settlement decisions remain isolated between native application instances` | 626 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signed club payment with %s cannot reach settlement` | 661 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: invalid signatures cannot reach settlement` | 717 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a globally valid shop key cannot authorize a club payment` | 726 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: database failure remains a safe 500 instead of acknowledging payment` | 743 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s webhook retains query-only parsing with a %s body` | 754 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-bulk-video-import.mysql.test.ts](../../../tests/nest-bulk-video-import.mysql.test.ts)

Модуль nest-bulk-video-import.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bulk video import over real HTTP/JWT/MySQL` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 38 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `client` | 69 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 85 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: persists validated metadata, empty strings and input order without changing existing videos` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: skips existing IDs and repeated imports without overwriting them` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the first duplicate occurrence within one batch` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an empty batch's zero count and no writes` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the losing competing batch and permits a non-overwriting explicit retry` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back earlier imported rows when a later insert fails, then permits a clean retry` | 279 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s without importing` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the video catalog when the administrator is $change during import` | 306 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-comments.mysql.test.ts](../../../tests/nest-comments.mysql.test.ts)

Модуль nest-comments.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `push` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: native discussion/reactions over HTTP/JWT/MySQL` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clearDiscussion` | 46 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `comments` | 120 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: subscription reports moderator service access separately from a paid period` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps paid access separate from moderator authority` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads the saved public %s comment without a paid subscription` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a live authenticated account even for public discussion` | 230 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps old public discussion readable but its posting window closed` | 249 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps %s service access to club discussion without a paid period` | 274 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hides draft, scheduled, hidden and absent discussions from unpaid readers` | 286 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lists club author fields and viewer likes only for a live member` | 310 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies all club mutations after expiry without changing records or notifying` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hides unpublished post %s for list/add/all mutations even from admin` | 361 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains closed/non-community comment window for %s` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists trimmed text/photos and author-only edit` | 392 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks parent belongs to the post, persists replies, and only notifies another author` | 426 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: upserts one report and atomically removes associations on live moderator deletion` | 462 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves public comment mutation access for authenticated non-members` | 499 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects all discussion writes/list after %s` | 526 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for an in-flight %s transaction and observes its committed state` | 547 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects %s for invalid, absent, unpublished and inaccessible posts without SQL writes` | 611 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves staff club access and does not remove inaccessible existing %s rows` | 653 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks publication after %s waits for a concurrent visibility edit` | 688 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes concurrent %s requests without duplicates or lost toggles` | 732 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps concurrent %s requests isolated between actors` | 760 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disables all legacy %s duplicates without changing another post` | 792 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back failed %s writes and releases locks for the next request` | 815 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains boolean/coerced input and actor identity for %s` | 845 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-content-deletion.mysql.test.ts](../../../tests/nest-content-deletion.mysql.test.ts)

Модуль nest-content-deletion.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: admin content deletion over HTTP/JWT/MySQL` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 36 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `client` | 90 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `snapshot` | 106 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: deletes the requested post's dependents and detaches a surviving legacy reply` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back every dependent and parent detachment when final post deletion fails` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deletes only one attachment while retaining posts, other media and reactions` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s retains the missing-ID no-op` | 170 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s/%s without content mutation` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-content.mysql.test.ts](../../../tests/nest-content.mysql.test.ts)

Модуль nest-content.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: native content reads over real HTTP/JWT/MySQL` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps public detail visible while hiding club body from anonymous readers` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the public post ID stable and applies the same access by UUID` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: gates club VK attachment URLs across detail/list/saved/admin reads ($name, hash=$hasHash)` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the existing standalone VK video catalog public and hides unpublished sources` | 330 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps private row lookup separate from public visibility` | 359 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not return a neighboring post for a missing ID` | 375 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns ordered audio, document and video metadata on public post detail` | 381 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not attach another post's files to an empty post in detail or batch reads` | 420 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid pagination before SQL (%#)` | 431 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lists only public feed/both posts, retaining order and media without paid or hidden bodies` | 443 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts each post's own likes in the legacy feed without adding comment counts` | 466 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: matches whole tags in the legacy feed and retains only the matching post's media` | 482 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid club pagination before SQL (%#)` | 510 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves club pagination defaults, null cursor, upper limit and visibility` | 522 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: intersects club visibility with tags and trimmed search before pagination` | 557 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns every tied-date %s row exactly once across unchanged pages` | 576 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: paginates filtered rows with default 12 and treats null cursor as the first page` | 619 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: combines tags and trimmed case-insensitive search using bound SQL values` | 646 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves feed like/comment counts and ordered attachments in paginated replies` | 672 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns reference tags in display order without changing the public fields` | 692 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an unused season in the full public tag catalog with its original label` | 713 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hides non-published detail %s even from a subscribed administrator` | 748 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks subscription expiry and live staff roles with the same JWT` | 755 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves bookmark order but removes unpaid club body and attachments` | 776 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves duplicate bookmark positions while omitting missing and unpublished rows` | 792 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies club and protected reads after %s` | 809 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: aggregates only the authenticated reader's saved and liked IDs` | 823 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps two authenticated readers' interactions and saved bodies separate` | 838 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves raw repeated reaction IDs and newest-first bookmark positions` | 879 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lists published public and club cards without bodies or drafts ($name)` | 897 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serves public article sections but only an allowlisted locked club preview to anonymous readers` | 962 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: relocks article sections immediately after subscription expiry with the same JWT` | 980 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not leak article sections after %s` | 1001 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hides unpublished and missing articles even from an administrator` | 1012 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-media-names.mysql.test.ts](../../../tests/nest-media-names.mysql.test.ts)

Модуль nest-media-names.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: raw-camera filename cleanup over HTTP/JWT/MySQL` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 62 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `client` | 107 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 123 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: clears only recognized camera names across posts without changing attachment metadata` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the same rows on repeated cleanup` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the SQL statement if a later matching row refuses an update` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s without changing filenames` | 159 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a blocked administrator without changing filenames` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps filenames when the administrator is $change during cleanup` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-moderation-input.test.ts](../../../tests/nest-moderation-input.test.ts)

Модуль nest-moderation-input.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: moderation ID inputs over native HTTP` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $method preserves the explicitly supplied service's refusal` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $method uses the actual Nest-managed provider` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the bounded inbox for %s` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses the inbox to a $name before reading reports` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not audit or return success when $helper fails` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not return success when $helper fails` | 357 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the session actor, not a client-supplied deletion actor` | 380 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the session actor, not a client-supplied dismissal actor` | 390 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: $name` | 400 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a $name ID before any mutation or audit` | 401 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a valid %s operation's target and actor` | 413 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses $name before side effects` | 422 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-notification-latest.mysql.test.ts](../../../tests/nest-notification-latest.mysql.test.ts)

Модуль nest-notification-latest.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: latest notification through real HTTP, JWT and SQL` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 46 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `client` | 76 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `subscription` | 107 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: exposes only the published public announcement to guests` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not treat an authenticated account as a club subscription` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: honors persisted entitlement: $name` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves %s club access without payment` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks expiry on the next request using the same JWT` | 182 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shows a both-target publication in each authorized channel` | 191 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: orders by publication date with creation fallback, not ID or sort order` | 209 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps null IDs and empty text when no visible publication exists` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-notifications.mysql.test.ts](../../../tests/nest-notifications.mysql.test.ts)

Модуль nest-notifications.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: notifications through real HTTP, JWT and disposable SQL` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `client` | 103 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `restLogout` | 119 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `tokens` | 128 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: disabled capability prevents inserts and re-enables for actor %s` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: validation refuses invalid input without SQL errors or writes (%j)` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: limits an account's concurrent HTTP requests before SQL writes` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: upserts one device using the authenticated actor and re-enables it` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: registers an anonymous device without inventing a user or consent` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: moves a device to the new account without carrying over marketing consent` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes the signed-out account's devices from audiences through %s logout` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the session and device binding when logout cannot detach the device` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: drops a personal push after the selected device switches accounts` | 313 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists legal consent for the session actor and honors the last same-second choice` | 358 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses anonymous consent without recording an event` | 407 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses $operation after $change during the request` | 418 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: purges only the requested user's tokens and retains consent history` | 502 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses token purge by non-admin %s without deleting a device` | 540 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report success or expose SQL when $name persistence fails` | 556 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-notifications.test.ts](../../../tests/nest-notifications.test.ts)

Модуль nest-notifications.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: notifications over native HTTP` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: latest publication visibility` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the actual injected content provider's latest outcome` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the actual injected content provider's latest refusal` | 185 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps public/club boundaries and read ordering for $name` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves nullish defaults: $name` | 297 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps empty content defaults without a database` | 340 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails safely on a %s read without partial content` | 349 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $name uses the supplied notification service, not hidden/global state` | 388 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $name preserves a native service refusal` | 466 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: registers a $name device using session ownership, not client ownership` | 483 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads the actor's marketing consent (%s)` | 515 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: appends the matching consent event with server-owned actor and legal copy (%#)` | 533 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: purges the requested user's tokens, not the administrator's tokens` | 577 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps marketing disabled by default when no database is available` | 591 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects $name instead of reporting success when no database is available` | 595 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn a $name persistence failure into success` | 621 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects $name before persistence` | 635 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses both consent operations for $access` | 672 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses administrator token purge for %s` | 702 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-prodamus-sandbox.test.ts](../../../tests/nest-prodamus-sandbox.test.ts)

Модуль nest-prodamus-sandbox.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `secret` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `liveKey` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `raw` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signature` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabled` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `disabled` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabledBase` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `disabledBase` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `settlement` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mail` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `path` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `notify` | 53 | Функция. Подробности и ограничения — в исходнике. |
| `it: keeps the diagnostic opt-in isolated per application instance` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts PHP form bytes without the generic form parser changing nested/signature data` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: acknowledges replay only as a stateless diagnostic` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a payload changed after signing` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not fall back to the live merchant's configured secret` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses browser session cookies at the diagnostic receiver` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects query additions instead of silently excluding them from the diagnostic proof` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not parse unsupported content type %s` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized bytes without echoing body or stack` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not relax browser origin security for the new diagnostic` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never accepts GET/browser navigation as a signed payment` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still rejects an ordinary-key demo at the production webhook` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: has not dispatched settlement or queued mail across diagnostic acceptance and rejection` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-prodamus-test-composition.test.ts](../../../tests/nest-prodamus-test-composition.test.ts)

Модуль nest-prodamus-test-composition.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: TEST checkout, webhook and return use their own app's billing provider through native HTTP` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-profile.mysql.test.ts](../../../tests/nest-profile.mysql.test.ts)

Модуль nest-profile.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: profile persistence through real HTTP, JWT and disposable SQL` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `authorization` | 58 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `client` | 61 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `users` | 88 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: stores only profile fields for the session user despite a forged target or role` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps omitted fields on a partial patch` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts repeated identical profile writes for an existing account` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists a valid $label name without SQL truncation` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects $label with HTTP 400 and unchanged SQL` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers the committed profile via REST after the client loses the write response` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses false success for a missing account's $name` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the existing no-op success for an empty patch` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns a safe HTTP error when the account disappears before persisting $name` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: records a repeatable deletion request only for the session account without erasing it` | 303 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unauthenticated $name without changing either account` | 320 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report success or expose SQL when $name fails to persist` | 339 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-profile.test.ts](../../../tests/nest-profile.test.ts)

Модуль nest-profile.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: profile use cases over native HTTP` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s preserves the explicitly supplied profile service's refusal` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled recovery export remains unavailable without acquiring a broken database` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: enabled recovery export reports sanitized unavailability on database acquisition failure` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $name uses the actual Nest-managed profile provider` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a $name update and session ownership` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a name at the $label` | 269 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves supported avatar URL %s` | 282 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns the same explicit public profile through REST and tRPC` | 295 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps guest profile responses unchanged in both APIs` | 325 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stores a sanitized avatar in the actor's folder before updating its URL` | 333 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: records the actor's deletion request without immediately deleting an account` | 375 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses every profile operation for $name before side effects` | 388 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects $name before persistence/storage` | 433 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not return success or leak internal details after a %s failure` | 501 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a $name update when no database is available` | 542 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not upload an avatar when no database client is available` | 558 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not upload an avatar when database client acquisition rejects` | 573 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps deletion-request failure when no database is available` | 588 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-raw-video-built.mysql.test.ts](../../../tests/nest-raw-video-built.mysql.test.ts)

Модуль nest-raw-video-built.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: keeps raw public uploads retired in compiled ESM regardless of live account state` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-raw-video.mysql.test.ts](../../../tests/nest-raw-video.mysql.test.ts)

Модуль nest-raw-video.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storage` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: raw public upload retirement with a real database` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s receives 404 without storage or session activity` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-sessions.mysql.test.ts](../../../tests/nest-sessions.mysql.test.ts)

Модуль nest-sessions.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: native Nest sessions with real JWT/MySQL/passwords` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves plain settings denial and rejects identity supplied in JSON on %s` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps resend's JSON authentication denial distinct from plain role denial` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows staff resend but does not grant launch settings to moderators` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies both administrative routes after %s without touching sign-in or issuing cookies` | 176 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves non-JSON rejection before auth on both administrative writes` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the stricter resend origin rule even for another CORS-allowed origin` | 221 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exports a shared session policy that rechecks real JWTs and database roles` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: logs in with a real password and emits a safe user and host-only cookie` | 274 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a long stored display name out of the login cookie` | 297 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts an earlier signed session containing the display name` | 319 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads a valid real JWT from the host-only cookie without exposing a hash` | 332 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bridges a valid Bearer JWT into the same cookie, not a newly issued identity` | 340 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not bridge a cookie-only session, even from the trusted origin` | 356 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an invalid Bearer JWT without setting a cookie` | 369 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $path via $transport revokes existing tokens on every device, but not another account or a later login` | 378 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a delayed revocation with an old actor snapshot cannot revoke a later session` | 454 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s is idempotent for absent and invalid credentials without revoking other accounts` | 475 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s does not report success or clear cookies when revocation cannot be stored` | 497 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks session version and blocking in MySQL for a previously valid JWT` | 527 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not issue a session for a blocked password login` | 540 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires staff TOTP and rejects a wrong code without creating a session` | 560 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows a real password + independently calculated valid staff TOTP` | 583 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the login quota in the real Nest runtime` | 597 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shares account cooldown across IPs, then accepts the real password and cookie after expiry` | 610 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-shared-admission.test.ts](../../../tests/nest-shared-admission.test.ts)

Модуль nest-shared-admission.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `it: fails closed on %s before identity mutations when quota storage fails` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for quota admission before looking up or authenticating an account` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never issues a cookie when successful-password quota completion fails` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-upload-session-composition.test.ts](../../../tests/nest-upload-session-composition.test.ts)

Модуль nest-upload-session-composition.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `apps` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: each app checks its own session before parsing an upload body` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an app-owned session failure at upload admission stays unavailable without parsing or leaking details` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-uploads.mysql.test.ts](../../../tests/nest-uploads.mysql.test.ts)

Модуль nest-uploads.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storage` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: public cover purpose and retired legacy uploads over HTTP/JWT/MySQL` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes an explicitly public cover without creating post attachments` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a cover when %s changes after tRPC authorization` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses missing purpose without a storage write` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a public cover after the administrator requests account deletion` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses to store an avatar when %s changes after the initial profile check` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retired %s media cannot create an object or association` | 219 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unpaid member cannot use legacy public comment upload` | 234 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s cannot create public covers` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cover storage failure remains a generic server error without an association` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-video-import.mysql.test.ts](../../../tests/nest-video-import.mysql.test.ts)

Модуль nest-video-import.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `transport` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `httpFetch` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: native video URL policy over HTTP/JWT/MySQL` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects client URL %s as BAD_REQUEST without outbound effects` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains %s without claiming to copy or inspect it` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks live identity after %s` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies anonymous URL imports` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nest-workers.test.ts](../../../tests/nest-workers.test.ts)

Модуль nest-workers.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `events` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `boundWorker` | 78 | Функция. Подробности и ограничения — в исходнике. |
| `health` | 86 | Функция. Подробности и ограничения — в исходнике. |
| `close` | 93 | Функция. Подробности и ограничения — в исходнике. |
| `it: factory/init/listen stay worker-free; explicit activation uses the Nest-bound helpers` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: two native apps own independent bindings and explicit activation state` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/nodemailer-recipient-dependency.test.ts](../../../tests/nodemailer-recipient-dependency.test.ts)

Модуль nodemailer-recipient-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Nodemailer keeps quoted/comment text out of recipient routing` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: routes $name only to its actual mailbox domain` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/normal-checkout-recovery.mysql.test.ts](../../../tests/normal-checkout-recovery.mysql.test.ts)

Модуль normal-checkout-recovery.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: normal checkout intent recovery` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 31 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `request` | 35 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 65 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: recovers an old nullable-contact order without requiring or changing a phone` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires contact only for a fresh order and freezes it across retries` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replaying an old intent cannot revert the contact saved by a newer intent` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays one committed checkout without another pending order or identity effect` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes concurrent identical intentions into one order and link` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a changed plan under the original key without a second order` | 204 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed when disabled or TEST mode is selected` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the order when signing configuration changes` | 223 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads pending and notRecorded without issuing a payment link` | 231 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports failed orders on create and status without recreating them` | 247 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires an order-specific receipt and returns that order's expiry` | 267 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed when the ledger lacks its unique request guard` | 289 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed on a deleted order instead of recreating it` | 305 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: isolates identical raw keys across accounts and denies unauthenticated access` | 316 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed durable evidence even when the pending order exists` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report success when the stored order email no longer matches its intent` | 344 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a committed checkout when the client discards the HTTP acknowledgement` | 359 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the order when committing the durable ledger fails` | 381 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the original intention across independent compiled server processes` | 399 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects TEST headers, blocked/revoked sessions, and client-controlled identity` | 468 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: conflicts on changed account email but still reads the original order` | 501 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the non-recurring semiannual checkout contract` | 514 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed for an absent ledger and restores only the owned fixture` | 530 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mistake another paid order for this purchase` | 548 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid keys and strict status inputs before writing` | 558 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks a revoked identity inside the transaction rather than trusting the actor snapshot` | 578 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept malformed canonical receipt evidence` | 602 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads status in TEST mode without converting a normal intent` | 615 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks receipt ownership and amount independently of a paid row` | 632 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/oauth-http-dependency.test.ts](../../../tests/oauth-http-dependency.test.ts)

Модуль oauth-http-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: legacy OAuth HTTP dependency compatibility` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the three JSON POST contracts and normalized login method` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an upstream HTTP failure instead of returning a user` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: enforces the explicit fetch response limit on a bounded data URI` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/owner-notification-failures.test.ts](../../../tests/owner-notification-failures.test.ts)

Модуль owner-notification-failures.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `realFetch` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `provider` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payload` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `transport` | 59 | Функция. Подробности и ограничения — в исходнике. |
| `it: native admin notify contains %s failure without logging provider data` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: native admin notify releases the unread HTTP %s body` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s cannot trigger an owner notification` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds a stalled provider request without retrying it` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/password-page.browser.test.ts](../../../tests/password-page.browser.test.ts)

Модуль password-page.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: legacy password email navigation` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the old fragment through the actual redirect (%s)` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/password-request-limits.test.ts](../../../tests/password-request-limits.test.ts)

Модуль password-request-limits.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `requestPassword` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `it: does not let rejected password requests exhaust login capacity` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not allocate a recipient bucket for an invalid email` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/password-verifier-failure.test.ts](../../../tests/password-verifier-failure.test.ts)

Модуль password-verifier-failure.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `control` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: propagates unexpected crypto failure %s rather than denying credentials` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/pen-pal-access-lifecycle.mysql.test.ts](../../../tests/pen-pal-access-lifecycle.mysql.test.ts)

Модуль pen-pal-access-lifecycle.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Pen Pals match and address access lifecycle` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 38 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `captured` | 110 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `prepare` | 117 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: %s rechecks an actor revoked during SQL lock wait` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shows the peer address only for mutual=%s` | 236 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not return the peer address after completed withdrawal` | 252 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the candidate order with legacy interests and shown cards` | 261 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fills discovery slots when blocked profiles have a higher score` | 323 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: honors $change committed after discovery reads $pauseOn` | 371 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not claim discovery succeeded when shown tracking fails` | 469 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/pen-pal-maintenance.mysql.test.ts](../../../tests/pen-pal-maintenance.mysql.test.ts)

Модуль pen-pal-maintenance.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Pen Pals maintenance on disposable MySQL` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 34 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `caller` | 75 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `profile` | 82 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `inactive` | 90 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `pauseInactiveCandidates` | 97 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: preserves a freshly renewed profile: %s` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts only actual removals when two maintenance runs share a candidate` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes an untouched inactive profile past the existing 30-day cutoff` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a recently withdrawn profile for the existing retention period` | 195 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `oldExpiry` | 201 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rechecks expiry after a real concurrent grant commits under the owner lock` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deactivates an actually expired profile and removes its matches atomically` | 260 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reaches expired profiles beyond the first page and preserves a renewed profile` | 273 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back deactivation when deleting its links fails` | 323 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains a profile with no paid history under the existing policy` | 343 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expires only unconfirmed matches and preserves mutual ones` | 348 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/pen-pal-match-access.test.ts](../../../tests/pen-pal-match-access.test.ts)

Модуль pen-pal-match-access.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `transport` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `application` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `actorId` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `writes` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `it: outsider cannot respond accept=%s or mutate A–B's match` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: request refuses inactive profile %s without writing` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accept refuses missing profile %s without writing` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s cannot revive an expired pending match` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: request retry retains the original deadline instead of extending consent` | 177 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accept uses locked current confirmations and serializes with account/profile changes` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: already mutual matches remain valid after their original confirmation deadline` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expiry remains a predicate of the final confirmation SQL` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expiry refusal at the write is not acknowledged as a successful confirmation` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: request rejects invalid target %s before SQL` | 226 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: account block detected after authentication prevents match creation` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fresh request creates only the initiator's consent after locking both active profiles` | 244 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: request cannot match the actor with themselves` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: request refuses missing profile %s` | 261 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accept refuses inactive profile %s` | 270 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unknown match is an object-level 404, not an infrastructure error` | 278 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: participant %s can reject, with ownership retained in DELETE` | 287 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed match ID %s before SQL` | 304 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/pen-pal-matches.mysql.test.ts](../../../tests/pen-pal-matches.mysql.test.ts)

Модуль pen-pal-matches.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Pen Pals HTTP/JWT/MySQL authorization and lifecycle` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: outsider accept=%s cannot change A–B's match` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: participant %s can decline their own match` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: inactive profile %s cannot create a match` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired match cannot be revived via %s` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: parallel reciprocal requests create one pair without losing mutual consent` | 176 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retries do not extend the confirmation deadline` | 191 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deactivation racing acceptance leaves no match for an inactive profile` | 197 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/pen-pal-profile-lifecycle.mysql.test.ts](../../../tests/pen-pal-profile-lifecycle.mysql.test.ts)

Модуль pen-pal-profile-lifecycle.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Pen Pals profile actor and consent lifecycle` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 41 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `capturedCaller` | 105 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: %s rechecks the actor after a real SQL owner-lock wait` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s refuses a context after session revocation` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $operation refuses an actor after $change` | 201 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the %s profile operation if recording consent fails` | 237 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: saves a current user's %s profile and matching consent through HTTP` | 258 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: withdraws %s consent and matches even while discovery is disabled` | 313 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not save a profile while the feature is disabled` | 338 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects guest %s without changes` | 344 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/photo-upload.test.ts](../../../tests/photo-upload.test.ts)

Модуль photo-upload.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storage` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `user` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `uploaders` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: photo upload validates bytes rather than the client MIME or filename` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disables SVG at the native decoder even if a future caller bypasses the signature gate` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still uploads genuine %s after decoder hardening` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects HTML masquerading as JPEG without storing it` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized photos before storage` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: re-encodes JPEG, removes location metadata and ignores path traversal filename` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed base64 rather than silently decoding a partial file` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects SVG even when its MIME says JPEG` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects small compressed images with excessive decoded pixel dimensions` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rotates by EXIF Orientation before stripping metadata` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/picomatch-dependency.test.ts](../../../tests/picomatch-dependency.test.ts)

Модуль picomatch-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `globRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `picomatchPath` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `picomatch` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not match a filename using inherited POSIX class %s` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects overlapping repeated alternatives within a bounded child` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary lint file selection and exclusions` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/picture-recovery.browser.test.ts](../../../tests/picture-recovery.browser.test.ts)

Модуль picture-recovery.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/picture-retry.browser.test.ts](../../../tests/picture-retry.browser.test.ts)

Модуль picture-retry.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/post-creation-idempotency.mysql.test.ts](../../../tests/post-creation-idempotency.mysql.test.ts)

Модуль post-creation-idempotency.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `transport` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stableVkCover` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: idempotent post creation over real HTTP/JWT/MySQL` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 61 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `created` | 88 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: returns the original numeric ID on a sequential retry without reannouncing` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `provider` | 143 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `vkPage` | 153 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: returns an automatic VK cover through real HTTP/SQL and preserves it on retry/edit` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fills a missing VK cover on explicit video edit without replacing the attachment` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves existing photo-as-cover without a VK request` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exposes the VK poster to both Club and feed readers after publication` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses expired keyed creation without duplicating the post` | 218 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled expiry preserves aged keyed post recovery` | 230 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a compacted intent never becomes new when expiry is switched off` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes concurrent identical requests into one committed post` | 258 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for an in-flight owner and exposes neither the post nor the key before commit` | 268 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a changed payload for a completed key without creating another post` | 331 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays a committed post after the client loses its successful HTTP response` | 339 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: one concurrent conflicting payload wins and the other receives 409` | 355 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: commits videos, audio and the durable request result once` | 375 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the key with failed media and permits a corrected retry` | 406 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: scopes the same client key separately for different authenticated administrators` | 428 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: treats distinct keys, including differently cased keys, as distinct intentions` | 442 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves old unkeyed calls as independent creates` | 453 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores object property order while preserving the same rich-text intent` | 462 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: applies existing schema defaults consistently on a retry` | 479 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves array order in the accepted intent` | 491 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects non-JSON rich text before claiming a key` | 505 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: guards all effect-bearing fields, not just text (%#)` | 516 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed keys before writing anything (%#)` | 536 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays a %s create without an announcement` | 555 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not resurrect a deleted post when its successful creation is replayed` | 568 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not revert an edited post when replaying its original creation` | 578 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks %s administrator access before replay` | 587 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not let a %s use another administrator's completed key` | 604 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a revoked session before replaying a committed creation` | 622 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-interactions-batch.mysql.test.ts](../../../tests/post-interactions-batch.mysql.test.ts)

Модуль post-interactions-batch.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bounded post interactions over HTTP/JWT/MySQL` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `mark` | 21 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: returns only requested, currently readable marks belonging to the actor` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks membership on each batch after a grant is revoked` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds raw input and refuses guests` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-list-indexes.mysql.test.ts](../../../tests/post-list-indexes.mysql.test.ts)

Модуль post-list-indexes.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: post listing indexes on a dedicated canonical database` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: provides a usable %s ordering index without changing page contents` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads a deep feed page in index order and preserves its IDs and offset` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains implicit current timestamps, nullable/backdated dates and updates in both session timezones` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-media-read-errors.test.ts](../../../tests/post-media-read-errors.test.ts)

Модуль post-media-read-errors.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `transport` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reads` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `media` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `emptyStatistics` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `postMedia` | 60 | Функция. Подробности и ограничения — в исходнике. |
| `describe: post media read integrity` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects failed SQL in $name instead of a complete empty model` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unavailable database in $name` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps genuinely empty media successful in $name` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns original IDs and metadata after $name recovers` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not query media for an empty post page` | 172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an empty saved-ID selection successful without a database` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: distinguishes an unavailable database from an empty tag catalog` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a genuinely empty reference tag table successful` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns a sanitized HTTP failure for $path, then recovers` | 196 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: admin content read availability` | 261 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $name propagates SQL failure and permits genuinely empty data after recovery` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-media-reference-map.test.ts](../../../tests/post-media-reference-map.test.ts)

Модуль post-media-reference-map.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `url` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `it: groups feed/both photos with club/draft attachments without using URL prefixes` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not approve unmatched attachments or malformed photos as a complete map` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps scheduled and unpublished references restricted` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects ambiguous target metadata without echoing input` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: groups an article cover with club rich-text links and comment photos across sources` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains raw text URL candidates with an explicit non-rendered-link diagnostic` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not infer public visibility for links in unsupported rich-text block shapes` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves malformed rich-text and unmatched comment diagnostics without disclosing input` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps comments on feed posts restricted and accepts nullable or SQL JSON photos` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects duplicate comment identities instead of silently merging locations` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: diagnoses empty photo array elements instead of approving missing references` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves public avatars, published videos and seasonal decoration when also referenced by club content` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unpublished video links restricted rather than privatizing the public catalog` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects duplicate decoration identities and unintended personal fields` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-photo-journal.browser.test.ts](../../../tests/post-photo-journal.browser.test.ts)

Модуль post-photo-journal.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bundle` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `open` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `native` | 58 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/post-reaction-reads.test.ts](../../../tests/post-reaction-reads.test.ts)

Модуль post-reaction-reads.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `transport` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reads` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: personal reaction read compatibility` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the absent-DB empty result for $name` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns an empty $name list for an actor with no marks` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects failed $name SQL instead of reporting no marks` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns raw $name IDs after SQL recovers` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-read-contract.test.ts](../../../tests/post-read-contract.test.ts)

Модуль post-read-contract.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Output` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `readClientPostFields` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `it: exposes delivered media and comment counts in post API types` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the generated client post types aligned with tRPC outputs` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-read-snapshot.mysql.test.ts](../../../tests/post-read-snapshot.mysql.test.ts)

Модуль post-read-snapshot.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: post and media share one HTTP read snapshot` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not attach the next private revision to the previous card in $path` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-text-limit-service.test.ts](../../../tests/post-text-limit-service.test.ts)

Модуль post-text-limit-service.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: normalized post text is bounded before persistence` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized create even for a direct service caller` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized update without writing any fields` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-text-limit.test.ts](../../../tests/post-text-limit.test.ts)

Модуль post-text-limit.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `bytes` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: post TEXT boundary measures UTF-8 bytes` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts exactly 65535 bytes of %s` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized input before persistence` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves omitted and empty update text for the existing body policy` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-video-journal.test.ts](../../../tests/post-video-journal.test.ts)

Модуль post-video-journal.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storage` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `video` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `editor` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `snapshot` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `it: stores video and poster as ArrayBuffer, restores exact Files and editor/coordinator aliases` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the record owner-scoped and rejects a stale tab revision` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a corrupted video receipt after storage restore` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses to persist original bytes after an account switch during file preparation` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks a checkpoint when the editor no longer owns the attempted video` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a recovered video's File alias while its local reference is removed before the next save` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy journal records without a video field readable` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects bytes returned after the owner changed during storage read` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-video-reconciliation.mysql.test.ts](../../../tests/post-video-reconciliation.mysql.test.ts)

Модуль post-video-reconciliation.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `first` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `second` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `added` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: post video identity on disposable MySQL` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 20 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `media` | 66 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `snapshot` | 72 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: preserves all video columns on an unchanged list` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: adds only the new video, preserving old IDs and all metadata` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes only the excluded video, preserving audio/documents/other posts` | 104 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reorders without changing IDs or other video columns` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves all media untouched when videos is omitted` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: clears only this post's videos on an explicit empty list` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves duplicate URL occurrences and removes only the surplus row` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back text, deletion, reorder and new rows when the final attachment save fails` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the post when a new video's filename cannot be decoded` | 155 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stores unknown MIME for new videos during post creation too` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/post-video-reconciliation.test.ts](../../../tests/post-video-reconciliation.test.ts)

Модуль post-video-reconciliation.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `first` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `second` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `added` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `query` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `rows` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `writes` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `selection` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `describe: post video reconciliation` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: persists a resolved VK poster with a new video` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fills a missing poster on edit without replacing an existing manual poster` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not rewrite unchanged rows, preserving IDs and every metadata column` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: adds only the new URL without deleting or rewriting existing videos` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes only excluded IDs, scoped to this post and the video type` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reorders by updating only sortOrder, never IDs or metadata` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: clears only the selected post's existing video IDs` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps repeated URL occurrences separate and their matching IDs stable` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes only the surplus occurrence of a repeated URL` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: adds a repeated URL only when no unmatched existing occurrence remains` | 125 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps signed query strings distinct, not just the basename` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: trims input and keeps the original array indexes across blank entries` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves an empty set without write queries` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not infer MIME from a new .%s URL` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an existing URL whose filename cannot be decoded` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails on incomplete SQL reads before any video mutation` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-article-editor.browser.test.ts](../../../tests/private-article-editor.browser.test.ts)

Модуль private-article-editor.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `png` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ownPage` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `title` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `choose` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `asset` | 60 | Функция. Подробности и ограничения — в исходнике. |

## [tests/private-attachment-uploads.mysql.test.ts](../../../tests/private-attachment-uploads.mysql.test.ts)

Модуль private-attachment-uploads.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: private upload native HTTP/SQL and SDK wire` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `request` | 37 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 64 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanupPosts` | 67 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `maintain` | 92 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: expired never-bound upload is deleted once and cannot be resurrected` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: compacts a live bound receipt without deleting its object or read evidence` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts a detached receipt clock at observation, not its old upload date` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps durable evidence after lost DELETE ACK and confirms absence on retry` | 260 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reconciles an expired pending upload without performing another PUT` | 289 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a foreign object and retains its receipt for investigation` | 301 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never reports compaction when the SQL transaction was rolled back` | 321 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps compacted orphan evidence without contacting S3 while cleanup is disabled` | 350 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a non-loopback S3 endpoint without any storage request` | 362 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes cleanup against a late binding without deleting a newly bound object` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uploads a private document and replays the same server receipt` | 414 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a lost storage ACK using the same object, never a second PUT` | 443 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a changed payload under the same intent without another object` | 464 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses storage without the prefix policy before PUT` | 478 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled upload rejects before receiving a large body or contacting S3` | 483 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: guest is refused before storage` | 488 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: parallel retries commit one intent and one object` | 494 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: releases SQL locks while storage waits and refuses finalization after revocation` | 510 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: changed storage namespace cannot replay or report a ready receipt` | 524 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a missing uniqueness guard refuses upload before any storage request` | 545 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: revoked admin cannot recover a committed receipt` | 558 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds a ready receipt in post creation without exposing the object URL` | 565 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a foreign receipt and rolls back post creation` | 610 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removal revokes read and late attachment retry cannot resurrect it` | 622 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: legacy deleteMedia rolls back removal of the final post body` | 667 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: legacy URL attachment cannot bypass ownership for a private-v1 object` | 681 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: failed media insertion rolls back the post edit and receipt binding` | 702 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pending receipt cannot be attached or treated as a completed post` | 742 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a receipt cannot be rebound to another post` | 760 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: changed object ETag is not served under a previously committed receipt` | 777 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ready receipt without committed storage evidence never reports success` | 795 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts detected FLAC and preserves its bytes for closed delivery` | 814 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired upload intent refuses replay and status without another storage effect` | 829 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired unknown storage outcome cannot retry the external write` | 862 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expired unbound receipt cannot create a post or media binding` | 881 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled retention preserves aged upload and status recovery` | 901 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: aged bound receipt remains readable and editable without reattachment` | 919 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a compacted private intent cannot upload again or report notRecorded` | 949 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a retained orphan receipt cannot bind after its marker closes recovery` | 978 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-attachment-uploads.s3.mysql.test.ts](../../../tests/private-attachment-uploads.s3.mysql.test.ts)

Модуль private-attachment-uploads.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: actual private upload with SQL, lost HTTP ACK and process restart` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `request` | 52 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `droppedResponse` | 80 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rememberOwnObjects` | 109 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: lost upload/post responses survive a fresh backend process without duplicates` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uploads real WAV bytes to the audio prefix and serves an exact range` | 358 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-comment-editor.browser.test.ts](../../../tests/private-comment-editor.browser.test.ts)

Модуль private-comment-editor.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `png` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `text` | 109 | Функция. Подробности и ограничения — в исходнике. |
| `url` | 110 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `receipt` | 111 | Функция. Подробности и ограничения — в исходнике. |
| `ownPage` | 120 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 164 | Функция. Подробности и ограничения — в исходнике. |
| `choose` | 169 | Функция. Подробности и ограничения — в исходнике. |

## [tests/private-comment-journal.browser.test.ts](../../../tests/private-comment-journal.browser.test.ts)

Модуль private-comment-journal.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bundle` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `open` | 72 | Функция. Подробности и ограничения — в исходнике. |

## [tests/private-content-files.mysql.test.ts](../../../tests/private-content-files.mysql.test.ts)

Модуль private-content-files.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: new private content files on native HTTP/SQL and loopback SDK wire` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 28 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `call` | 29 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `upload` | 38 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `photo` | 43 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `makePost` | 49 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `makeArticle` | 53 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `clearArticles` | 57 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `commentPhoto` | 61 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `readFile` | 66 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: records a ready receipt and returns only an application URL` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels storage on HTTP disconnect and recovers the same object on retry` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not hold the comment actor or post lock across storage and rechecks post visibility` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a full 32 MiB document over Base64 HTTP and replays one stored asset` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a real %s photo above the ordinary JSON limit` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reconciles lost storage ACK without creating another object` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes concurrent same-intent uploads and rejects a changed payload` | 196 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not write storage for disabled, unauthenticated or non-admin uploads` | 205 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains pending evidence on policy refusal and can resume the same intent` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses stale sessions, pending account deletion and expired recovery` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes genuine photo bytes and refuses active content without creating a ledger entry` | 222 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds a post photo atomically, inherits live visibility and never exposes a draft or detached photo` | 230 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects foreign, wrong-usage and raw private storage references before post commit` | 252 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: atomically binds article image, ordered carousel and document, then follows publication and access changes` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses private covers, foreign article files and creation without an intent before article/teaser commit` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps comment photos private, retries one comment without duplicates, and follows current discussion access` | 294 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: authorizes comment uploads before storage and refuses attaching them to another post` | 329 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers comment photo storage loss without leaking an intent to another account` | 340 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retries the same committed comment after a real downstream HTTP response drop without another row` | 351 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps ingress denial private and never contacts storage` | 374 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exports only own content recovery metadata without file URLs, names or storage capabilities` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retires new comment/file recovery links atomically and fences the old actor without touching storage` | 390 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses finishing a pending comment-photo upload after the session or account is revoked` | 412 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls retirement back when the comment ledger migration is missing` | 426 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expires comment recovery without expiring the committed comment photo or creating a replacement` | 439 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-content-files.s3.mysql.test.ts](../../../tests/private-content-files.s3.mysql.test.ts)

Модуль private-content-files.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabled` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Bucket` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `acceptedPolicyHash` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `describe: private content API with real S3 and a migrated disposable database` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `call` | 33 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `dropped` | 42 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `restart` | 56 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `denied` | 62 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rememberObjects` | 70 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `checkObject` | 80 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `directDenial` | 86 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `photoInput` | 93 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `photoBytes` | 97 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `maximumPhoto` | 110 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `maximumFileRead` | 121 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: accepts maximum 4 MiB %s through native API/S3 and rejects one extra byte` | 190 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts maximum binary %s through native API/S3 and rejects one extra byte` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `upload` | 240 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: recovers lost upload and article responses in fresh API processes without another file or article` | 280 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds post photos once and rechecks paid, blocked, staff and session access before S3` | 309 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps article images behind their current publication/access and never treats them as public covers` | 327 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers comment upload/save losses across restarts and isolates account changes and revocation` | 341 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-content-files.test.ts](../../../tests/private-content-files.test.ts)

Модуль private-content-files.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `wire` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `it: prepares private photo bytes without a public upload, stripping metadata and retaining alpha` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses active image content before a private storage write` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: writes only the new private content scope and reuses the object after a lost PUT acknowledgement` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses the content write when its dedicated policy statement is absent` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-content-request-bodies.test.ts](../../../tests/private-content-request-bodies.test.ts)

Модуль private-content-request-bodies.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `actor` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `admin` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `comment` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MiB` | 43 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tokens` | 45 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `admissionBodies` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `input` | 84 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 94 | Функция. Подробности и ограничения — в исходнике. |
| `it: forwards unexpected upload middleware rejection to Nest without leaking details` | 106 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: parses the authenticated UTF-8 media envelope only once before schema validation` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps malformed/non-object media JSON %s a private 400 response` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the existing UTF-16 JSON fallback for authenticated media` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects compressed media before authentication, parsing, SQL or S3` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds a chunked media envelope even without Content-Length` | 172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: admits the full Base64 envelope for $usage to real schema validation` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves small/300 KiB validation behavior for %s` | 203 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses disabled %s before authentication or JSON parsing` | 216 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses anonymous %s before JSON parsing` | 226 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s on the administrator upload before parsing` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps infrastructure failure at %s distinct from a guest` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: classifies encoded and batched %s without bypassing admission` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires administrator authority for a mixed private-upload batch` | 270 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds the complete JSON envelope at %s` | 280 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the decoded file quota for $usage` | 289 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not widen ordinary JSON for %s` | 303 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-editors.s3.mysql.test.ts](../../../tests/private-editors.s3.mysql.test.ts)

Модуль private-editors.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Bucket` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `policyHash` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `Mode` | 32 | Контракт типов. Подробности и ограничения — в исходнике. |
| `field` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `submit` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `describe: private attachments through both real editors, API and Timeweb S3` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `identity` | 67 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `open` | 78 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `choose` | 124 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `recover` | 143 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `reload` | 148 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `read` | 156 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/private-file-download-names.test.ts](../../../tests/private-file-download-names.test.ts)

Модуль private-file-download-names.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `bytes` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `etag` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `wire` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `api` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mime` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `label` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `inline` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `denied` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stale` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requests` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `storageCalls` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `listen` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `it: downloads %s with a canonical extension` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the attachment identity and extension for a range response` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the library key for HEAD without fetching object bytes` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps normalized photos inline with the actual WebP format` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not disclose a filename or call storage when authorization denies` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not send a download header for changed object metadata` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes the download header for an unsatisfiable range` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-files.mysql.test.ts](../../../tests/private-files.mysql.test.ts)

Модуль private-files.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: private attachment delivery` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `read` | 163 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: streams published public attachment bytes with private no-store` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks club access for cookie download and refuses guest without S3` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled flag %s does not touch SQL or S3` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HEAD returns length without a storage GET or response body` | 203 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serves only the requested range $range` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid/unsatisfiable range %s without object GET` | 227 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects ambiguous or external attachment URL %s without storage` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks paid/session state on the next range request: %s` | 279 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: staff access requires current role and grants no paid period` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unpublished/missing parent or unsafe MIME: %s` | 309 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid/missing ID or supplied query: %s` | 320 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: provider %s stays generic without retry or leaked headers` | 331 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: client abort closes the held upstream body` | 347 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: body with no further progress closes before the outer safety cutoff` | 357 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: progressing download outlives the idle limit without truncation` | 366 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ingress rejection is also private no-store, without SQL or object reads` | 372 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: SQL read failure stays generic and never reaches storage` | 380 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses missing object version before GET` | 395 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses inconsistent provider response %s before sending bytes` | 403 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-files.s3.mysql.test.ts](../../../tests/private-files.s3.mysql.test.ts)

Модуль private-files.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: actual S3 with native attachment API and SQL` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `denied` | 128 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: streams exact bytes from private prefix attachment %i` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HEAD exposes length but no body, even with Range` | 150 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads exact native S3 range %s` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses range %s before storage GET` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks paid club access through %s` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses club member %s without S3 calls` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: permits unpaid %s and rechecks role revocation` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s post/association before S3` | 228 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled delivery never reaches storage` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deleted post and removed attachment are refused before storage` | 244 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bad storage signature returns generic 503 without URL/key leakage` | 267 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: browser cookie uses the unchanged Next rewrite and rechecks access` | 283 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-files.test.ts](../../../tests/private-files.test.ts)

Модуль private-files.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `wire` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requests` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `closed` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: times out withheld provider headers before the outer safety cutoff, with no retries` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-library-assets.test.ts](../../../tests/private-library-assets.test.ts)

Модуль private-library-assets.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: refuses an old paid copy or optimizer bypass without redirect: %s` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves public/free assets and authenticated delivery to their existing handlers: %s` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-library-client.test.ts](../../../tests/private-library-client.test.ts)

Модуль private-library-client.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `response` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `fetcher` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `file` | 52 | Функция. Подробности и ограничения — в исходнике. |
| `it: parses only the requested guide and never persists the paid payload` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed/wrong-key payload %j` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not normalize failed guide read %i into a successful empty guide` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: follows bounded metadata pages and returns only canonical known pattern slots` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: finishes after the four winter files without requesting a free PDF binding` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe binding metadata without a public fallback` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a repeated pagination cursor` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: honors cancellation without starting a read` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops an endless stream of new binding cursors at the page budget` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds the whole binding chain even when each individual page fits its own timeout` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels the full binding chain between pages without returning partial bindings` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-library.browser.test.ts](../../../tests/private-library.browser.test.ts)

Модуль private-library.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `png` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `backend` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `wire` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ownPage` | 124 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 136 | Функция. Подробности и ограничения — в исходнике. |
| `marker` | 184 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `refresh` | 185 | Функция. Подробности и ограничения — в исходнике. |
| `sqlBrowser` | 542 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tests/private-photo-editors.browser.test.ts](../../../tests/private-photo-editors.browser.test.ts)

Модуль private-photo-editors.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `native` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `png` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `assetId` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ownPage` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `choose` | 58 | Функция. Подробности и ограничения — в исходнике. |
| `submit` | 76 | Функция. Подробности и ограничения — в исходнике. |
| `receipt` | 83 | Функция. Подробности и ограничения — в исходнике. |

## [tests/private-photo-editors.s3.mysql.test.ts](../../../tests/private-photo-editors.s3.mysql.test.ts)

Модуль private-photo-editors.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Bucket` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `policyHash` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `Mode` | 33 | Контракт типов. Подробности и ограничения — в исходнике. |
| `field` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `submit` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `describe: private photos through both real editors, API and Timeweb S3` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `identity` | 67 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `open` | 78 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `choose` | 107 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `reload` | 132 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `denied` | 157 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `inspectObject` | 170 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `openArticle` | 410 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `chooseArticle` | 426 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: article: mixed private photo/PNG/carousel/document recover upload/create response loss with actual SQL and S3` | 442 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: article: editing retains previous file bindings and never replays a lost update response` | 601 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-recovery-guard.test.ts](../../../tests/private-recovery-guard.test.ts)

Модуль private-recovery-guard.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `sql` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: refuses a noncanonical local fixture before SQL: %s` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not permit maintenance in production even with a localhost test URI` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does nothing when %s is disabled, without SQL or storage` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-transfer-object.test.ts](../../../tests/private-transfer-object.test.ts)

Модуль private-transfer-object.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `wire` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bytes` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `key` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `etag` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `receipt` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `source` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `describe: private conditional streaming transport without a database` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verifies full source/destination SHA and reuses the same owned copy` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a lost streaming PUT acknowledgement from persisted object metadata` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: streams multiple network chunks without changing the video bytes` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a mismatching source SHA before creating any destination` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unsafe policy before copying` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unrelated pre-existing destination data without overwriting it` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verifies actual bytes instead of trusting video metadata` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe source key %j without network access` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized or foreign-namespace intents without allocating the file` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-upload-capabilities.browser.test.ts](../../../tests/private-upload-capabilities.browser.test.ts)

Модуль private-upload-capabilities.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `native` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `png` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ownPage` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `open` | 41 | Функция. Подробности и ограничения — в исходнике. |

## [tests/private-uploads-compose.test.ts](../../../tests/private-uploads-compose.test.ts)

Модуль private-uploads-compose.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: adds S3 only to API without giving API general egress or changing existing services` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-video-editors.s3.mysql.test.ts](../../../tests/private-video-editors.s3.mysql.test.ts)

Модуль private-video-editors.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Bucket` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `policyHash` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `admin` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `other` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Mode` | 34 | Контракт типов. Подробности и ограничения — в исходнике. |
| `field` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `submit` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `recover` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `describe: private videos through both actual editors` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `identity` | 75 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `open` | 86 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `choose` | 117 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `storedVideo` | 129 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `denied` | 174 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/private-video-posters.mysql.test.ts](../../../tests/private-video-posters.mysql.test.ts)

Модуль private-video-posters.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: private video poster association HTTP/SQL` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `call` | 32 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `video` | 58 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `photo` | 74 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `clear` | 110 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: binds an explicit private poster atomically, retains it on unrelated edits and revokes it with the video` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replaces a poster atomically without losing a gallery photo or reviving the old poster` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects %s poster association without partial post/media/file binding` | 282 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-video-uploads.mysql.test.ts](../../../tests/private-video-uploads.mysql.test.ts)

Модуль private-video-uploads.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: private video upload HTTP/SQL recovery` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `upload` | 41 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `status` | 61 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `write` | 75 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanupPosts` | 100 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: keeps canonical video bytes private and replays one asset` | 164 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a lost PUT acknowledgement from durable pending evidence without a second PUT` | 197 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a slow S3 request on HTTP disconnect and recovers an accepted object without another PUT` | 217 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects changed bytes and filenames under the original key` | 247 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: isolates status from another account and converges simultaneous same-key uploads` | 264 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects non-video before ledger/storage effects` | 289 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a stable valid key before recording intent` | 297 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: defaults off, and never falls back when storage policy is unavailable` | 307 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies stale access before bytes/storage: %s` | 317 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the 80MiB bound without a durable intent` | 330 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects ambiguous metadata query: %s` | 337 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks account revocation while an authenticated raw body is still streaming` | 349 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds once, gates draft/club/expiry reads and revokes an explicitly removed video` | 400 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not detach a private video when legacy videos[] is saved without it` | 471 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy video removal validation independent of private storage configuration` | 509 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unowned reserved video URL without creating a post: %s` | 516 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/private-video-uploads.s3.mysql.test.ts](../../../tests/private-video-uploads.s3.mysql.test.ts)

Модуль private-video-uploads.s3.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `current` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uri` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabled` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 53 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Bucket` | 53 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `acceptedPolicy` | 55 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 57 | Функция. Подробности и ограничения — в исходнике. |
| `realFetch` | 58 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `admin` | 59 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `member` | 59 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `other` | 59 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: private raw video actual API/SQL/S3 acceptance` | 65 | Actual frontend transport/coordinator → native API → fresh SQL → Timeweb S3. Journal transactions are a structuredClone double, NOT browser/reload acceptance. |
| `rpc` | 82 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `restart` | 156 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `dropResponse` | 164 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `denied` | 201 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rememberObjects` | 215 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `objectMeta` | 236 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: recovers raw upload and post ACK loss across native API restarts with one video/poster/link/post` | 404 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores an actual late %s reply after switching accounts, without publishing or reassigning the asset` | 564 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-binding.test.ts](../../../tests/prodamus-binding.test.ts)

Модуль prodamus-binding.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `monthly` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `configured` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: Prodamus club field binding (not signature or settlement authorization)` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads frozen inputs without changing the payment proof or configuration` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-cancellation-binding.test.ts](../../../tests/prodamus-cancellation-binding.test.ts)

Модуль prodamus-cancellation-binding.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `configured` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `expected` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: %s` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mutate frozen decoded payload or normalize trusted configuration` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-cancellation-client.test.ts](../../../tests/prodamus-cancellation-client.test.ts)

Модуль prodamus-cancellation-client.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `profile` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `config` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: sends exactly the signed manager=%s cancellation to the configured endpoint` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unmatched profile without a request: %j` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing secret before transport` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves trusted endpoint restriction: $url / production=$production` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not send a profile when configured subscription is missing` | 117 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves rejection of a malformed configured URL before transport` | 129 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not confirm or expose private transport errors` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-cancellation-notification.test.ts](../../../tests/prodamus-cancellation-notification.test.ts)

Модуль prodamus-cancellation-notification.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `raw` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `it: confirms the bound profile once before acknowledging cancellation` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects selected key %j before evaluating merchant binding` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unbound cancellation without durable effects: %s` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not acknowledge a refused durable confirmation` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates durable failure without retrying or acknowledging` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates configuration failure only after signature verification` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for pending durable confirmation before returning success` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-cancellation-transport.test.ts](../../../tests/prodamus-cancellation-transport.test.ts)

Модуль prodamus-cancellation-transport.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `secret` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `profile` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RequestRecord` | 33 | Контракт типов. Подробности и ограничения — в исходнике. |
| `merchant` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `destination` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `merchantOrigin` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `destinationOrigin` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `status` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `responseBody` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `location` | 40 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `merchantRequests` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `forwardedRequests` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `listen` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `close` | 57 | Функция. Подробности и ограничения — в исходнике. |
| `describe: native Prodamus cancellation transport` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not follow a %i response or confirm another origin's success` | 116 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept success from an unconfigured same-origin path` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the independently signed cancellation request (manager=%s)` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not confirm status %i / body %j` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains profile binding before any request: %j` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the production prohibition on plain HTTP` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-fields.test.ts](../../../tests/prodamus-fields.test.ts)

Модуль prodamus-fields.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Prodamus field selection compatibility` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: selects exact keys before case-insensitive aliases: $body` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains nullish user-ID precedence: $body` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: classifies only the selected success status as paid: $body` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains selected order alias and known prefix semantics: $body` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains whole-field nested subscription action precedence: $body` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mutate a frozen signed payload during selection` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-payload.test.ts](../../../tests/prodamus-payload.test.ts)

Модуль prodamus-payload.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Prodamus payload parsing compatibility` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: takes the first repeated scalar query value and ignores structured query values` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s body overrides whole query fields, not individual nested keys` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: decodes %s form data with indexed objects and last duplicate values` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains form insertion-order collision behavior: $raw` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reinterpret valid non-object JSON as form data: %s` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains query fields with an absent or empty $name body` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks %s path segments in query and form before authentication` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves own JSON __proto__ fields for signature verification` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-payment-notification.test.ts](../../../tests/prodamus-payment-notification.test.ts)

Модуль prodamus-payment-notification.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `initial` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `recurring` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `it: ignores unpaid notifications without reading merchant configuration or dispatching` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: forwards initial order proof once and normalizes only the existing email hint` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses recurring configuration and the renewal intent, never a recipient user hint` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s before any fulfilment` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not acknowledge a durable refusal as success` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: propagates a settlement failure without acknowledging or retrying` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores a paid notification with no order without reading club configuration` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves non-club capability/settlement decisions to the existing fulfilment port` | 132 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves an empty initial email as null rather than inventing a recipient` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not dispatch when the selected merchant key is empty` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not read another configuration or dispatch after configuration fails` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not resolve the acknowledgement while durable fulfilment is pending` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-payment.test.ts](../../../tests/prodamus-payment.test.ts)

Модуль prodamus-payment.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Prodamus payment field decoding (not payment authorization)` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the complete order, amount, recipient and nested profile binding` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $name` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves absent values empty rather than inventing a price or profile` | 120 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mutate a frozen subscription or request record` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-query.test.ts](../../../tests/prodamus-query.test.ts)

Модуль prodamus-query.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Prodamus outbound query format` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $name` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: includes only own enumerable fields, including a literal __proto__ key` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mutate frozen nested input` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-sandbox-built.test.ts](../../../tests/prodamus-sandbox-built.test.ts)

Модуль prodamus-sandbox-built.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: compiled ESM keeps diagnostic signature verification separate from live settlement` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: compiled standalone composition verifies callbacks without loading application effect ports` | 82 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-sandbox-cli.test.ts](../../../tests/prodamus-sandbox-cli.test.ts)

Модуль prodamus-sandbox-cli.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fixture` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `run` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `it: prints only a synthetic demo link and an explicit no-access result` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses disabled mode without leaking configuration or a stack` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses user input overrides rather than taking an email or a live merchant` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-sandbox-standalone.test.ts](../../../tests/prodamus-sandbox-standalone.test.ts)

Модуль prodamus-sandbox-standalone.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `path` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `raw` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sign` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `enabled` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `disabled` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `offBase` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `notify` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `it: verifies a raw notification without a session or access claim` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps disabled composition independent of the enabled instance` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves signed form bytes through standalone composition` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not acknowledge a modified notification` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized input with a generic response` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not expose %s from the isolated listener` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects GET as proof even with a signature` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves browser-origin rejection` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects browser cookies and query additions` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-sandbox-startup.test.ts](../../../tests/prodamus-sandbox-startup.test.ts)

Модуль prodamus-sandbox-startup.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: refuses to start an unconfigured standalone listener without exposing its environment` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-sandbox.test.ts](../../../tests/prodamus-sandbox.test.ts)

Модуль prodamus-sandbox.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `secret` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `linkCanonical` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `config` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payment` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signed` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `describe: synthetic-only Prodamus diagnostics` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not opt in with %j` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed on an invalid dedicated configuration %j` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: generates an explicitly demo one-off link with synthetic contact and no access-return flag` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the demo-suffixed key only when explicitly configured for this sandbox` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: snapshots dedicated configuration per instance` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: acknowledges a signed diagnostic without claiming access` | 151 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a verified diagnostic status %s` | 168 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: decodes a PHP-style form callback` | 180 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts documented numeric provider ID and integer demo flag in JSON` | 188 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects excessive nesting without an uncaught serialization error` | 199 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a signed wrong binding %j` | 206 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid signature %j` | 238 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verifies all own JSON fields, including __proto__, before acknowledgement` | 248 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed raw input %j` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-signature-verification.test.ts](../../../tests/prodamus-signature-verification.test.ts)

Модуль prodamus-signature-verification.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `body` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `canonical` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `key` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signature` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: preserves $name verification` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects changed signed fields` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not retain keys across verification calls` | 104 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: legacy facade reads and trims the current merchant keys on each call` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-signature.test.ts](../../../tests/prodamus-signature.test.ts)

Модуль prodamus-signature.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `secret` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `independentSign` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `describe: Prodamus signature canonicalization` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signs $name without dropping any own JSON fields` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signs a nullish root as an empty string: %s` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: signs only own enumerable fields without mutating frozen nested input` | 79 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unsigned own field added to a $name` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-test-built.test.ts](../../../tests/prodamus-test-built.test.ts)

Модуль prodamus-test-built.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: compiled test process fails closed without configuration and exposes only the selected POST boundaries` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-test-club.mysql.test.ts](../../../tests/prodamus-test-club.mysql.test.ts)

Модуль prodamus-test-club.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `order` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `email` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: dev-only Prodamus club through native HTTP and SQL` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 52 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 92 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `notification` | 102 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `ordered` | 119 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `returnProof` | 139 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `checkReturn` | 143 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: only a verified success can fill an empty user contact, preserving an existing one (%j)` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an unpaid guest order pending without creating a session or mail` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: confirms the exact durable guest receipt and queued setup mail without replaying settlement` | 202 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: offers login, not another account or password reset, for a confirmed existing account` | 217 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports a discarded mail without pretending it reached the inbox or resending it` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s proof without any account, mail or payment effects` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not confirm a paid row with broken receipt/recipient binding (%s)` | 287 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates only a saved monthly demo order and a signed one-off redirect, never a session or access` | 312 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: settles the signed RUB order using %s payment without inventing an exchange rate` | 379 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a full signed RUB order regardless of method %s` | 420 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses malformed or mismatched foreign payment %j without effects` | 429 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects reuse of a foreign receipt with another currency or foreign amount` | 459 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts signed JSON numeric monetary fields without accepting structured or imprecise amounts` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: grants exactly 30 days through the saved order, with durable access mail and idempotent HTTP replay` | 486 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses mismatched/non-demo/recurring proof %j without granting` | 506 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a wrong key and retains the production demo boundary` | 522 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid dev configuration %s without a new saved order` | 531 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses six-month checkout rather than enabling subscription or charging a different price` | 552 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a durable YooKassa intent without a provider switch or new test order` | 559 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a demo-suffixed signed PHP form and still grants just one period` | 572 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back access and receipt on outbox failure, then accepts a clean provider retry` | 603 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/prodamus-test-runtime.test.ts](../../../tests/prodamus-test-runtime.test.ts)

Модуль prodamus-test-runtime.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: restricted runtime refuses %s %s before unrelated application handlers` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exposes only a read-only unknown result for invalid proof, never session or identity data` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns a sanitized unavailable response, not paid or pending, when receipt storage is absent` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses malformed result transport without echoing data (%s)` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops at the existing twelve-check intent budget rather than adding a new quota` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains browser-origin protection on the selected test receiver` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses untrusted receiver transport without echoing request data (%s)` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/profile-revision.mysql.test.ts](../../../tests/profile-revision.mysql.test.ts)

Модуль profile-revision.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: atomic profile revisions` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a missing revision instead of keeping a blind-write path` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a stale revision even after values return to their original state (ABA)` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a delayed aborted request cannot overwrite the newer successful save` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks %s immediately before a delayed write` | 110 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/proxy-address-dependency.test.ts](../../../tests/proxy-address-dependency.test.ts)

Модуль proxy-address-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `expressRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `proxyAddress` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not trust public IPv4 through ambiguous IPv6 subnet %s` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains loopback policy for %s` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains correctly spelled mapped IPv4 subnets without trusting outsiders` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/public-content-import.test.ts](../../../tests/public-content-import.test.ts)

Модуль public-content-import.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `snapshot` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `describe: public-only staging content bootstrap` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves public content and dates but excludes users and engagement` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unsupported or non-public post %j` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses duplicate source IDs rather than silently losing records` | 84 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a hidden or non-YouTube catalog record` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unknown tag references` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: permits only the isolated staging database and application origin` | 110 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the staging URL's explicit UTF-8 charset without allowing other driver options` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses unsafe destinations without leaking their credentials` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: transactional content bootstrap` | 172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `connection` | 177 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: defaults to read-only validation, even with a valid destination` | 202 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: inserts only the three content tables in one transaction with parameterized values` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a non-empty destination without any inserts` | 236 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back earlier inserts if the last table fails and hides SQL values` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe targets and snapshots before touching the database` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses tables without transactional storage before acquiring a lock` | 272 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not start a transaction when another importer holds the lock` | 284 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/public-photo-receipts.mysql.test.ts](../../../tests/public-photo-receipts.mysql.test.ts)

Модуль public-photo-receipts.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: public photo recovery over native HTTP/SQL/loopback S3` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clearReceipts` | 29 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `call` | 39 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: recovers %s after lost PUT ACK without duplicate object or a new operation` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not rebind an old recovered/replayed avatar over a newer selection` | 171 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: increments the profile revision once and rejects a stale avatar edit` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps authorisation and input checks before storage; current role is rechecked after PUT` | 226 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes simultaneous retries and scopes the same operation key to its owner/purpose` | 255 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays a stored result after a lost application reply without rebinding or deleting anything` | 281 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a failed SQL bind after PUT using the same object` | 318 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: anonymizes receipt ownership on account retirement without touching stored objects` | 350 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/public-response-compression-application.test.ts](../../../tests/public-response-compression-application.test.ts)

Модуль public-response-compression-application.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `port` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `read` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `it: compresses a real mounted tRPC response without changing serialized bytes` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: negotiates Brotli for a real public batch with a query string` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps cookie-bearing public reads uncompressed` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a real batch containing auth.me uncompressed` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/public-response-compression.test.ts](../../../tests/public-response-compression.test.ts)

Модуль public-response-compression.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `payload` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bytes` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `port` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `read` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `describe: public JSON response compression` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reduces %s while retaining the exact JSON bytes` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: negotiates Brotli without changing the JSON` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not compress an authenticated or ranged read %j` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: leaves unrelated or mixed reads unchanged: %s` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: skips errors, partial/mixed responses and non-transformable data: %s` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains identity for unsupported content negotiation` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not compress mutation responses` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/public-storage-lifecycle.test.ts](../../../tests/public-storage-lifecycle.test.ts)

Модуль public-storage-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: public storage lifecycle on owned loopback transports` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds a stalled public PUT below the client deadline without an automatic second write` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels an in-flight %s upload when its request owner aborts` | 60 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/public-upload-disconnect.mysql.test.ts](../../../tests/public-upload-disconnect.mysql.test.ts)

Модуль public-upload-disconnect.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: public upload HTTP disconnect on disposable SQL and loopback S3` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops %s storage work after the actual client disconnects` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/push-audience.mysql.test.ts](../../../tests/push-audience.mysql.test.ts)

Модуль push-audience.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: push recipient access on disposable MySQL` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: %s excludes blocked accounts without losing permitted recipients` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies direct service recipients for blocked user %s` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves direct service recipients without requiring marketing consent` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops selecting recipients immediately after a new block` | 99 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports same-second consent revocation as the latest choice` | 105 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes a same-second revoked token from marketing, not service messages` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: honors a new grant recorded after a same-second revocation` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/push-registration-security.test.ts](../../../tests/push-registration-security.test.ts)

Модуль push-registration-security.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: push registration admission` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `enabled` | 54 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `request` | 57 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: refuses a valid token while disabled, including staff (%j)` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: also refuses direct service registration while disabled` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not spend the future enabled quota on disabled attempts` | 81 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed/oversized input before persistence (%j)` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts bounded %s without accepting client ownership` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts exactly 256 characters for %s and refuses 257` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains optional platform and anonymous registration only behind the capability` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves supported legacy/opaque Expo token %s` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: caps requests per resolved IP, including malformed attempts and spoofed leftmost forwarding` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: caps an account across IP changes without charging another account` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts every batch member before any asynchronous write` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses blocked actors before registering a device` | 221 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/push-service-failures.test.ts](../../../tests/push-service-failures.test.ts)

Модуль push-service-failures.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `token` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `privateFailure` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `it: service notification contains a recipient-store failure without logging tokens or SQL` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: service notification contains an asynchronous audience recheck failure instead of rejecting after commit` | 46 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: marketing notification contains a storage failure without logging recipient data` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/push-transport-lifecycle.test.ts](../../../tests/push-transport-lifecycle.test.ts)

Модуль push-transport-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `audience` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `messages` | 22 | Функция. Подробности и ограничения — в исходнике. |
| `accepted` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `it: abandons stalled %s after the deadline, without retrying or losing the next batch` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a rejected response body before continuing and releases the deadline` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/push-transport.test.ts](../../../tests/push-transport.test.ts)

Модуль push-transport.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `audience` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `outbound` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `responses` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `messages` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `describe: push provider acceptance, not device delivery` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts valid provider tickets` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not count HTTP %s as accepted` | 48 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not count a transport failure as accepted` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts only successful tickets in a partially rejected batch` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not trust malformed or contradictory ticket responses %#` | 63 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not count an unreadable JSON response` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps later 100-message batches working after an earlier rejection` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never submits a token outside the %s audience` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: makes no transport request for an empty or entirely excluded audience` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/query-parser-dependency.test.ts](../../../tests/query-parser-dependency.test.ts)

Модуль query-parser-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `expressRequire` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `qs` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: enforces an explicitly configured comma-array limit for %s` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes parsed untrusted isBuffer data without calling it` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary repeated query values and UTF-8` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/quiz-owner-component.browser.test.ts](../../../tests/quiz-owner-component.browser.test.ts)

Модуль quiz-owner-component.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `QuizHarness` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `saved` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `it: cancels an old quiz restore across owner changes (native localStorage: %s)` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/quiz-progress.test.ts](../../../tests/quiz-progress.test.ts)

Модуль quiz-progress.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `answered` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `next` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: restores selected answers with the current question` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects incompatible or corrupted progress: %j` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores versioned progress while retaining a unique run and monotonic revision on the wire` | 36 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe versioned quiz metadata: %j` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/quiz-reducer.test.ts](../../../tests/quiz-reducer.test.ts)

Модуль quiz-reducer.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: keeps the previous answer snapshot immutable when an answer changes` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains selections when going back and calculates from the edited journey` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not navigate before the first question` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: clears restored completion on restart and begins a fresh answer journey` | 68 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/quiz-saved-result.test.ts](../../../tests/quiz-saved-result.test.ts)

Модуль quiz-saved-result.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `valid` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: restores canonical result content, not browser-supplied titles` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: restores both canonical aesthetics for a stored blend` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects absent, malformed or oversized storage %s` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid keys, blend shape and scores %j` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/quiz-scoring.test.ts](../../../tests/quiz-scoring.test.ts)

Модуль quiz-scoring.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: scores a complete $key journey without inventing a secondary aesthetic` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ranks both aesthetics at $label` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/rate-limit.test.ts](../../../tests/rate-limit.test.ts)

Модуль rate-limit.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `checkRateLimit` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: allows exactly the configured number of attempts and resets only at expiry` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds distinct keys and refuses new keys without evicting active limits` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reclaims expired keys so capacity exhaustion does not disable the service permanently` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized keys and invalid quotas instead of storing unbounded or unusable entries` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/raw-video-errors.test.ts](../../../tests/raw-video-errors.test.ts)

Модуль raw-video-errors.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `boundary` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: maps %s without leaking internals` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/read-lookup-indexes.mysql.test.ts](../../../tests/read-lookup-indexes.mysql.test.ts)

Модуль read-lookup-indexes.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uri` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: read indexes on an explicitly empty disposable schema` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reduces examined candidates without changing rows or introducing UNIQUE` | 74 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/recovery-export.mysql.test.ts](../../../tests/recovery-export.mysql.test.ts)

Модуль recovery-export.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Page` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describe: own recovery export through native HTTP/JWT/SQL` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 35 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `request` | 90 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `fixture` | 107 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: exports only own %s records with bounded stable pagination` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not leak private filename, storage evidence or draft download identity` | 154 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports a live %s without exporting its draft content or ID` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports pending uploads and refuses invalid ready storage evidence` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves cursor continuity across compaction and never revives an expired result` | 206 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects target override and malformed/broad input %j` | 224 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies guests and disabled exports` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies revoked and blocked users without revealing records` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks the epoch and block for an already authenticated RPC context` | 250 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns a point-in-time export without waiting for an in-flight owner lock` | 268 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows personal export to a member and does not return other owners` | 288 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: gives terminal markers precedence over duplicate detailed rows` | 299 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed on incomplete schema with sanitized error` | 315 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/registration-retry.mysql.test.ts](../../../tests/registration-retry.mysql.test.ts)

Модуль registration-retry.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: pending public registration retry` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 74 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `post` | 78 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `user` | 92 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `mails` | 95 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `tokens` | 101 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `accepted` | 106 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 114 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `deliver` | 172 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `receivedToken` | 185 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `complete` | 203 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: accepts a pending retry without overwriting identity, consent or issuing a session` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: resends after SMTP acceptance without invalidating the first emailed link` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps SMTP rejection pending and reuses the queued link on a public retry` | 260 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replaces an expired queued setup without claiming the account` | 285 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls a retry's new token back when durable mail insertion fails` | 298 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds concurrent retries to three setup mails per recipient per rolling hour` | 319 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: permits another setup once earlier deliveries leave the rolling hour` | 336 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not bypass the setup quota or revoke a valid link through password recovery` | 352 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not resume an unavailable or active identity (%s)` | 368 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn an unrelated passwordless checkout account into public registration` | 387 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `pendingCheckoutUser` | 398 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: queues one registration link and records consent for a pending checkout account` | 410 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a usable setup link already queued by password recovery` | 428 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still requires current consent on a pending retry` | 438 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains the existing IP quota instead of bypassing it on pending retries` | 444 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps pending registration retry passwordless in compiled production ESM` | 451 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/registration-subscription-flow.mysql.test.ts](../../../tests/registration-subscription-flow.mysql.test.ts)

Модуль registration-subscription-flow.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `FlowResult` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describe: registration to subscription on isolated SQL/SMTP` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 45 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `trpc` | 54 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `drainMail` | 83 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `setupToken` | 100 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `notify` | 136 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: revokes blocked paid sessions without losing entitlement across unblock, recovery and cancellation` | 259 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/registration.mysql.test.ts](../../../tests/registration.mysql.test.ts)

Модуль registration.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `registrationFailureCodes` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `describe: insert-only email registration on disposable MySQL` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `captureRegistrationFailures` | 54 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 88 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: auto-generated account IDs do not overlap reserved parallel fixture ranges` | 136 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent registration accepts the pending loser while creating one account and setup` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: arbitrates twenty simultaneous registrations without claiming an existing account` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a checkout-created account appearing after the precheck cannot be claimed` | 246 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a consent version other than the current displayed text` | 266 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not leave an account or issue a session if consent recording fails` | 275 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: can log in only after consuming the emailed setup link, without an automatic session on completion` | 294 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fixture cleanup does not lock an unrelated owner's password token` | 341 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls registration back if durable mail cannot be encrypted` | 384 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/request-bodies.test.ts](../../../tests/request-bodies.test.ts)

Модуль request-bodies.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `boundary` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `json` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `it: refuses retired raw video before allocating its body or consulting identity` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds public authentication JSON to 16 KiB` | 41 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds ordinary JSON to 256 KiB` | 42 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses anonymous upload JSON before its handler` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retires large legacy media JSON even for authenticated members` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves authenticated avatars but refuses retired admin media` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: guards upload procedures even inside a batch` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns a generic JSON parse error without echoing request content` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses raw uploads from non-administrators` | 55 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps storage exception details out of raw upload responses and logs` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/resource-profile-compose.test.ts](../../../tests/resource-profile-compose.test.ts)

Модуль resource-profile-compose.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `profile` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `files` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `limits` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ComposeConfig` | 27 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describe: opt-in resource limits for a dedicated 8GiB host` | 32 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: changes only resource ceilings and preserves the %s stack on rollback` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/retirement-write-probe.mysql.test.ts](../../../tests/retirement-write-probe.mysql.test.ts)

Модуль retirement-write-probe.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: late mutation after real account retirement` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 27 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `caller` | 73 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: allows an ordinary current request before final retirement` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the current role when moderating a different user's comment` | 90 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: reported comment action %s` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `seedStaff` | 99 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 104 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `execute` | 108 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rejects revoked %s and preserves records and audit` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows a current %s and writes the audit atomically` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a captured pre-retirement context: %s` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/route-drain.browser.test.ts](../../../tests/route-drain.browser.test.ts)

Модуль route-drain.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `barrier` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `describe: native proxy route drainage` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: finishes both forwarded responses before removing interception (%s)` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/route-pattern-dependency.test.ts](../../../tests/route-pattern-dependency.test.ts)

Модуль route-pattern-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: rejects a bounded adversarial multi-parameter path without runaway backtracking` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/saved-posts-page.mysql.test.ts](../../../tests/saved-posts-page.mysql.test.ts)

Модуль saved-posts-page.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: saved page over real HTTP/JWT/disposable MySQL` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: pages all %i equal-date saves once with a bounded response` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: filters private/draft/missing rows before LIMIT and never leaks another owner's saves` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: honors the explicit 50-item maximum without truncating the last item` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deduplicates historical saves using the newest actual row, preserving media/reactions` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks current subscription on each page` | 112 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps keyset traversal valid after deleting the anchor and inserting a newer save` | 131 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects cross-owner/filter and malformed cursors instead of resetting to the first page` | 146 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid input %j` | 157 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires authentication` | 167 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/scheduled-publication.mysql.test.ts](../../../tests/scheduled-publication.mysql.test.ts)

Модуль scheduled-publication.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Publications` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describe: scheduled publication ownership on disposable MySQL` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 29 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `snapshot` | 52 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `waitingWorkers` | 60 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: returns only due transitions and preserves publication dates and target` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: two workers and the next tick return each publication only once` | 94 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not announce a draft withdrawn while its row is locked` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back the entire claimed batch when publication fails, then retries` | 172 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/security-regressions.mysql.test.ts](../../../tests/security-regressions.mysql.test.ts)

Модуль security-regressions.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: security regression guards` | 24 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 30 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `caller` | 87 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rejects a late avatar after final retirement` | 95 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects legacy resend after staff %s changes` | 130 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: legacy and keyed grants both reject a revoked admin %s` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps legacy grant and resend available for a current administrator` | 204 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: saves a current avatar and advances the profile revision` | 228 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not overwrite a newer profile while an avatar upload is pending` | 250 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: production startup refuses a one-byte JWT signing key` | 286 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/session-availability.test.ts](../../../tests/session-availability.test.ts)

Модуль session-availability.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `application` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `cookie` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `me` | 62 | Функция. Подробности и ограничения — в исходнике. |
| `exchange` | 76 | Функция. Подробности и ограничения — в исходнике. |
| `legacyContext` | 85 | Функция. Подробности и ограничения — в исходнике. |
| `upload` | 91 | Функция. Подробности и ограничения — в исходнике. |
| `it: returns 503 without issuing a session when login exhausts the SQL queue` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an ingress $boundary failure at $path distinct from invalid authentication` | 102 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a second $boundary check failure at $path distinct from invalid authentication` | 121 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still rejects an account changed by $change after body admission at $path` | 144 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reject a valid Bearer token as invalid on a temporary %s failure` | 163 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps an invalid Bearer token unauthorized without setting a cookie` | 187 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn a legacy tRPC %s failure into a guest and recovers with the same cookie` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves a confirmed legacy guest for %s` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns retryable 503, not a confirmed guest, on a temporary %s failure and recovers with the same cookie` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not mistake an untyped upstream 403 for a confirmed invalid session` | 239 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not report a missing database as a missing user for a valid JWT` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not return a successful null tRPC session on a %s failure` | 254 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves confirmed guest 200/null for a %s session without consulting SQL` | 277 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves confirmed guest 200/null for a %s account session` | 297 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/session-config.test.ts](../../../tests/session-config.test.ts)

Модуль session-config.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: refuses a missing or short production JWT key` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows local tests without a production signing key` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts the production API with a sufficiently long synthetic signing key` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/session-cookie.test.ts](../../../tests/session-cookie.test.ts)

Модуль session-cookie.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `server` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixtureBase` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `application` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `user` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `request` | 54 | Функция. Подробности и ограничения — в исходнике. |
| `postFromSubdomain` | 65 | Функция. Подробности и ограничения — в исходнике. |
| `it: keeps newly issued cookies host-only on %s` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not trust a raw forwarded-proto header outside Express proxy policy` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never emits an insecure session cookie in production` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: expires legacy parent-domain cookies before issuing a host-only cookie` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: both REST and tRPC logout clear current and legacy cookie scopes` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not cache auth responses or credential-bearing API responses` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/session-provider.browser.test.ts](../../../tests/session-provider.browser.test.ts)

Модуль session-provider.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `member` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `barrier` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `Harness` | 31 | Контракт типов. Подробности и ограничения — в исходнике. |
| `it: real AuthProvider remounts private state and aborts its old session read when a new identity is applied` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/session-revocation.test.ts](../../../tests/session-revocation.test.ts)

Модуль session-revocation.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `state` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: session revocation` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a previously issued token after password version changes` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects blocked users at the shared authentication boundary` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/settlement-request.test.ts](../../../tests/settlement-request.test.ts)

Модуль settlement-request.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `proof` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `input` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paymentKey` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payloadHash` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `foreignProof` | 103 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `foreignInput` | 110 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: retains the live receipt fingerprint for amount %s` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves RUB case normalization without changing the supplied proof` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: derives renewal order and receipt from the charge, not the caller's order hint` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds the initial receipt to the profile independently of the provider charge key` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses invalid pre-SQL settlement fields %j` | 78 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds TEST receipt to foreign evidence $currency/$amountMinor` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps ordinary TEST RUB receipts on their historical hash without an FX suffix` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses TEST foreign evidence outside its existing boundary %j` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/shop-checkout-actor.mysql.test.ts](../../../tests/shop-checkout-actor.mysql.test.ts)

Модуль shop-checkout-actor.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: shop checkout with a current session` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 36 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `checkout` | 77 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `orders` | 89 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: creates a pending order matching the signed URL for the active buyer` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses checkout after %s` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/shop-checkout-configuration.test.ts](../../../tests/shop-checkout-configuration.test.ts)

Модуль shop-checkout-configuration.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `input` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not resolve inherited object properties as shop products: %s` | 19 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not build a payment URL for inherited catalog properties: %s` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unsafe or missing shop form: %s` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unsigned shop link when neither merchant has a signing key` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires an explicit safe club form for the existing club-key fallback: %s` | 73 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports unsafe public callback configuration without exposing it: %s` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid money in %s using the billing amount rules` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the shop merchant signature in demo mode %s` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the explicit club merchant fallback for a one-off shop purchase` | 145 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes an explicit shop root without changing fractional product price` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/shop-checkout-orders.test.ts](../../../tests/shop-checkout-orders.test.ts)

Модуль shop-checkout-orders.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `persistence` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 78 | Функция. Подробности и ограничения — в исходнике. |
| `legacyCheckout` | 101 | Функция. Подробности и ограничения — в исходнике. |
| `expectSeparatePendingOrders` | 109 | Функция. Подробности и ограничения — в исходнике. |
| `it: keeps simultaneous authenticated checkouts for different buyers separate` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps simultaneous legacy redirect checkouts separate` | 156 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not collide between authenticated checkout and the legacy redirect` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unknown product without persisting a pending order` | 177 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects inherited product keys in authenticated checkout before persistence: %s` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects inherited product keys in legacy checkout without redirect or write: %s` | 199 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a missing buyer email without persisting a pending order` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not persist authenticated checkout when its payment link cannot be built` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not persist legacy checkout when its payment link cannot be built` | 228 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects authenticated unsigned checkout before persistence` | 240 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects legacy unsigned checkout before persistence or redirect` | 249 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not log private database error details when a legacy order write fails` | 262 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/shop-composition.test.ts](../../../tests/shop-composition.test.ts)

Модуль shop-composition.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `buyer` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `caller` | 62 | Функция. Подробности и ограничения — в исходнике. |
| `it: root composition honors the supplied shop %s service` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled shop checkout refuses before entering the supplied service` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: $name cannot reach shop checkout` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: shop service over native HTTP` | 123 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ownership HTTP uses the application-scoped shop service` | 143 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: dormant checkout HTTP uses the same shop service and session actor` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: native checkout stays disabled before provider work` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: native $name checkout remains protected` | 177 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: guest ownership is false without accessing SQL` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ownership lookup preserves session user ID and product` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ownership SQL failure is not exposed as false success or a private error` | 219 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: native %s rejects malformed product input first` | 230 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/source-file-guide.test.ts](../../../tests/source-file-guide.test.ts)

Модуль source-file-guide.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: documents declared blocks and their comments without publishing function bodies` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: gives every file one entry, keeps history explicit and escapes Markdown paths` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: indexes nested test scenarios and immutable migration operations as blocks` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads style purpose and Python block names without executing scripts` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/source-map-dependency.test.ts](../../../tests/source-map-dependency.test.ts)

Модуль source-map-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `postcssRequire` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `{ SourceMapConsumer }` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `indexedMap` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe indexed-map line offset %s before serialization` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps valid indexed-map source positions intact` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/sql-test-setup.test.ts](../../../tests/sql-test-setup.test.ts)

Модуль sql-test-setup.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `project` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `it: leaves local connection settings untouched and creates no listener` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unsafe URI before creating any connection: %s` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires both CI permissions (%s, %s)` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: forwards the allowed CI service over loopback and closes listeners and active sockets` | 58 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/staff-role.test.ts](../../../tests/staff-role.test.ts)

Модуль staff-role.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: public email and derived openId do not confer staff privileges` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/staging-baseline.test.ts](../../../tests/staging-baseline.test.ts)

Модуль staging-baseline.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `baseline` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: the one approved staging baseline upgrade` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows only the pending additive 0026 on the attested baseline` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a different database even with the same schema: %s` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks any drift in an existing table or unexpected extra table` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks changed SQL instead of executing arbitrary release input` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses executable database objects absent from the approved baseline` | 53 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never accepts an existing differently shaped checkout table` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recognizes the exact rehearsed table after a lost DDL acknowledgement` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: operator entry point refuses unsafe input before connecting` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported arguments before a connection` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not connect with an absent or wrong target URI` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: baseline identity and backup attestation` | 124 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores only a table's advancing auto-increment counter` | 127 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps column auto-increment behavior and other schema differences` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds application to the restored backup's exact source server` | 162 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows rehearsal only on the independently restored server` | 173 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s` | 193 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: hashes the actual backup instead of trusting a supplied file name` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses malformed proof without a permissive default` | 246 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: permits application only after a matching upgrade rehearsal` | 277 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not endorse a receipt attached to an invalid restore proof` | 280 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blocks absent, unrelated or unsuccessful upgrade rehearsal` | 296 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/staging-smoke.test.ts](../../../tests/staging-smoke.test.ts)

Модуль staging-smoke.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `execute` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Probe` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `BrokenReply` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `runSmoke` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `it: retains the closed-payment deployment as the default baseline` | 135 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses a single-card paginated read instead of the retired unbounded feed` | 141 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts private uploads and additive capabilities without skipping the remaining access checks` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: still rejects the excluded %s capability when private uploads are enabled` | 175 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a missing or malformed %s capability (%s)` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the explicit TEST deployment without preparing a purchase or signed callback` | 207 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unexpected payment deployment ($deployment / $mode)` | 243 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unknown payment modes before making any request` | 253 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails instead of reporting readiness when $name` | 259 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a redirect without requesting the redirect destination` | 341 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/storage-public-boundary.test.ts](../../../tests/storage-public-boundary.test.ts)

Модуль storage-public-boundary.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: current storage publication boundary on loopback S3 wire` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requests public ACL and returns a direct object URL for %s` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns an unsigned object address without an application access check or storage request` | 93 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the returned URL on the exact uploaded object: $key` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps configured trailing endpoint separators out of the object key` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects ambiguous object key before storage effects: %j` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/subscription-cancellation-provider.browser.test.ts](../../../tests/subscription-cancellation-provider.browser.test.ts)

Модуль subscription-cancellation-provider.browser.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: cancellation handler requires paid access, not moderator service access (paid=%s)` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/subscription-cancellation-status.mysql.test.ts](../../../tests/subscription-cancellation-status.mysql.test.ts)

Модуль subscription-cancellation-status.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: cancellation status across native HTTP and SQL` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `listen` | 46 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `close` | 52 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `rows` | 59 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 62 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `client` | 74 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `due` | 90 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: SQL failure %s is a server error, never a terminal client rejection` | 253 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an unverified legacy billing profile remains a safe client refusal` | 300 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns pending on provider 503, then restores it with a read-only fresh client` | 312 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a lost response without a second provider attempt or duplicate request` | 348 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports a disconnected provider as pending, not a failed API request` | 364 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: worker confirmation changes reads to confirmed and preserves the paid period` | 376 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: partial provider confirmation does not report all renewal profiles cancelled` | 398 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects cancellation after session revocation while waiting for the user lock` | 425 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unbound new order despite an older cancelled profile` | 466 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a receipt whose profile is different even when amount and email match` | 491 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not leak or cancel another account's pending request` | 512 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a saved pending request visible even after paid access expires` | 531 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never emits none between an earlier paid read and concurrent worker confirmation` | 544 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/supported-audio.test.ts](../../../tests/supported-audio.test.ts)

Модуль supported-audio.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: allows lossless FLAC recognized from actual bytes through the private delivery boundary` | 6 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unsupported raw containers out of delivery: %s` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/test-database-policy.test.ts](../../../tests/test-database-policy.test.ts)

Модуль test-database-policy.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: refuses non-test and external databases even with the CI service flag` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts a CI service only when both explicit CI conditions are set` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses extra connection settings on an otherwise permitted test URL: %s` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/toolchain-dependencies.test.ts](../../../tests/toolchain-dependencies.test.ts)

Модуль toolchain-dependencies.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `requireConcurrent` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `quote` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: rejects line terminators in shell operator objects rather than producing another command` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary quoted development-command arguments` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/trpc-availability.test.ts](../../../tests/trpc-availability.test.ts)

Модуль trpc-availability.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `failure` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `it: preserves temporary infrastructure failure as a safe retryable tRPC error` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not reclassify an explicit %s denial even with a nested queue failure` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not treat an unknown error, SQL timeout or an unrelated message as queue exhaustion` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/trpc-batch-admission.test.ts](../../../tests/trpc-batch-admission.test.ts)

Модуль trpc-batch-admission.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `application` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `batch` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `it: rejects more than 20 operations before executing a public batch` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects repeated full-feed reads in one batch` | 25 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary short batches` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/trpc-dependency.test.ts](../../../tests/trpc-dependency.test.ts)

Модуль trpc-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `corePath` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: does not write global prototype through form path %s` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary nested form fields` | 31 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/trusted-edge-client-ip.test.ts](../../../tests/trusted-edge-client-ip.test.ts)

Модуль trusted-edge-client-ip.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `expressRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `proxyAddress` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: uses the client's address after the private edge, not the shared edge address` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/user-upsert-identity.mysql.test.ts](../../../tests/user-upsert-identity.mysql.test.ts)

Модуль user-upsert-identity.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: identity upsert on disposable MySQL` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `accounts` | 61 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: rejects a different openId colliding on $email $phone without changing the owner` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back every field when an existing identity attempts an occupied email` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refreshes the existing identity without resetting its credentials or session version` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates one identity under sequential retries of the same openId` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/user-upsert-identity.test.ts](../../../tests/user-upsert-identity.test.ts)

Модуль user-upsert-identity.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `transport` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `database` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: identity-scoped user upsert SQL boundary` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects another identity's unique-key collision without sending a credential update` | 45 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: updates only the locked account for the requested openId, retaining explicit nulls` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back a credential update rejected by another unique constraint` | 103 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates an identity with defaults and refreshes login without resetting absent fields` | 118 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the absent-database contract without emitting a write` | 134 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/validation-collection-dependency.test.ts](../../../tests/validation-collection-dependency.test.ts)

Модуль validation-collection-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: bounded input validation rejects oversized collections before visiting elements` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reports the array size violation without expanding every invalid item` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-fixture-isolation.mysql.test.ts](../../../tests/video-fixture-isolation.mysql.test.ts)

Модуль video-fixture-isolation.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: video SQL fixture isolation` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 13 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: keeps an imported row when an independent connection cleans fixed fixture IDs` | 33 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-import.test.ts](../../../tests/video-import.test.ts)

Модуль video-import.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uploads` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requests` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: video link import never makes a server-side request to a user-selected URL` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects untrusted URL %s before network access` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: retains a configured-storage URL without downloading it` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects encoded traversal out of the configured bucket` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-persistence-availability.test.ts](../../../tests/video-persistence-availability.test.ts)

Модуль video-persistence-availability.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: reports $name unavailable rather than empty when no database is configured` | 7 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses $name instead of reporting a write without a database` | 26 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-persistence.mysql.test.ts](../../../tests/video-persistence.mysql.test.ts)

Модуль video-persistence.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: video catalogue persistence on disposable MySQL` | 15 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 33 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `stored` | 38 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: stores original titles and metadata while public reads normalize only published rows` | 64 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: updates only the selected row and retains untouched columns` | 88 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: deletes only the selected row and tolerates an already missing ID` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-publication.mysql.test.ts](../../../tests/video-publication.mysql.test.ts)

Модуль video-publication.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `external` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `httpFetch` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: public video HTTP boundaries on disposable MySQL` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not disclose a hidden video or its media URL by public numeric ID` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps published detail and list available, with hidden rows excluded` | 110 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps unpublished entries available to internal import deduplication` | 122 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses %s before any external downloader or media request` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: streams a published catalog entry with Range semantics preserved` | 137 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks publication even when playback resolution is cached` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed YouTube IDs without external work` | 161 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies a club video before downloader, cached URL, or upstream requests` | 167 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks club access after an in-flight upstream response before returning bytes` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-service.test.ts](../../../tests/video-service.test.ts)

Модуль video-service.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `test: isolated public-video worker passes its native HTTP/cache/process suite` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-thumbnail.test.ts](../../../tests/video-thumbnail.test.ts)

Модуль video-thumbnail.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `bucket` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicCover` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `vkCover` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `input` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: VK public cover contract` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the public cover on write and read: %s` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses private, malformed and ambiguous addresses: %s` | 30 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept a public namespace on another origin` | 49 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/video-upload-admission.test.ts](../../../tests/video-upload-admission.test.ts)

Модуль video-upload-admission.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storage` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `path` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `headers` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `deferred` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `it: refuses another video before reading its body while storage is busy, without blocking ordinary reads` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps admission occupied after the client disconnects until its in-flight upload settles` | 57 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: releases admission after an aborted body, parser rejection and controller rejection` | 72 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/videos.test.ts](../../../tests/videos.test.ts)

Модуль videos.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: Videos API` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: getVideos` | 17 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should return an array of videos` | 18 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should return empty array when no videos` | 59 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: getVideoById` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should return a single video by ID` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should return undefined for non-existent video` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: bulkImportVideos` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should import videos and return count` | 99 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: Video data structure` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should have correct YouTube thumbnail URL format` | 114 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: should format duration correctly` | 120 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vitest-mocker-dependency.test.ts](../../../tests/vitest-mocker-dependency.test.ts)

Модуль vitest-mocker-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: enforces Vite file policy for %s over loopback WebSocket/HTTP` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-catalog.mysql.test.ts](../../../tests/vk-catalog.mysql.test.ts)

Модуль vk-catalog.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: VK catalog boundaries` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `rows` | 39 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `request` | 43 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 71 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: creates a real VK row without a fake YouTube ID and replays the same source` | 113 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: saves a hash-free export, replays it and changes hash only through an explicit edit` | 142 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serializes concurrent creates of the same source without duplicate rows` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: saves a VK cover and replays creation after a lost response without duplicates` | 215 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps a server-owned public cover through HTTP save and catalog: %s` | 303 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves omitted VK cover on update and clears only explicit null` | 338 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects an unsafe cover without changing the VK row (%s)` | 384 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects changed create payload under the same source` | 418 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a share URL and extra privileges rather than accepting arbitrary embed data` | 436 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the legacy public YouTube wire shape without new source fields` | 461 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: lists source-free cards and gates club playback by current club access` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: returns only a public cover after explicit client opt-in (%s)` | 504 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps cover opt-in and the forward cursor independent across pages` | 583 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: serves public VK through additive playback, not through legacy worker authority` | 630 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts paid membership but denies expired, blocked and revoked identities (%s)` | 642 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses explicit updates for existing VK rows, and denies moderator writes` | 683 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: is disabled by default and does not weaken legacy filtering when disabled` | 714 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed embeds without recording a source` | 729 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: replays reordered parameters but conflicts when embed hash changes` | 757 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the existing infinite-query client across all pages without exposing club sources` | 788 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsupported infinite-query input %j` | 838 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: paginates source-free cards and validates safe IDs and strict query fields` | 850 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed when the unique source guard is missing` | 894 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects corrupted source evidence instead of falling back to YouTube` | 913 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the unique source guard across independent administrators` | 923 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rolls back an interrupted insertion and permits retry of the same source` | 944 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rechecks revoked admin identity inside the transaction` | 962 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not overwrite an existing source through another video's ID` | 982 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves old YouTube data when applying the actual additive migration` | 1015 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects new access or provider fields on the legacy public import` | 1059 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-embed-input.test.ts](../../../tests/vk-embed-input.test.ts)

Модуль vk-embed-input.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `identity` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bare` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: VK exports with an optional access hash` | 10 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts an exported player without inventing a hash on %s` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps source identity stable with or without a valid hash` | 29 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe or ambiguous input even without a hash: %s` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-oembed-collection.test.ts](../../../tests/vk-oembed-collection.test.ts)

Модуль vk-oembed-collection.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: offline VK source selection` | 12 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads the existing TXT shape and deduplicates by video ID` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an unsafe or unsupported input: %s` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an oversized file before parsing links` | 40 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds a single batch at100 distinct videos` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: oEmbed metadata through an isolated local HTTP provider` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: exports only verified matching src and optional cover metadata, without HTML or credentials` | 138 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an input outside the community before contacting any provider` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes the observed oEmbed tracking parameter before strict backend validation` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts an exported iframe without an optional hash` | 184 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not let tracking normalization bypass the player guards` | 198 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not export an unsupported or mismatched iframe` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not treat unsafe/missing cover metadata as complete` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: marks a missing title without inventing it` | 253 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: records a bounded safe failure without leaking raw responses` | 263 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: records HTTP refusal rather than success` | 291 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not follow redirects` | 297 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds a hung provider request` | 304 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the deadline active after response headers arrive` | 310 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a stalled response body even when its transport ignores abort (headers after %sms)` | 316 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `describe: native CLI and private export` | 359 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: defaults to an offline plan without requesting the provider` | 397 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: writes a new0600 report only with explicit collection and never embeds raw HTML` | 406 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses an existing output before collecting and preserves it` | 431 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: writes a canonical player for the observed multiline oEmbed response` | 440 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses output inside the repository before collecting` | 464 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: saves a safe failure report and exits2 without pretending collection succeeded` | 472 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unknown switches before requesting the provider` | 487 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: continues the batch after a refusal and preserves separate per-video results` | 493 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-post-posters.test.ts](../../../tests/vk-post-posters.test.ts)

Модуль vk-post-posters.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `stored` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `storage` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `link` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `small` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `large` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `page` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `transport` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `describe: VK post covers` | 47 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: uses the exact hash at a fixed VK host and keeps the largest signed image intact` | 51 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: falls back to a matching VK first frame when the cover CDN refuses it` | 65 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not return a transient VK URL if storing its stable copy fails` | 85 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never requests arbitrary hosts, share pages, private uploads or duplicate parameters` | 91 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: ignores mismatched or unsafe metadata: %j` | 109 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: prefers a real unpadded image over a larger padded thumbnail` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails softly without interpreting scripts` | 152 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: handles JSON strings containing braces and script-like text as data` | 160 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not turn refusal, network errors or oversized bodies into a save failure` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not persist metadata for a missing/non-image cover (%s)` | 179 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks image bytes and rejects an oversized preview` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a stalled image body under the same save deadline` | 212 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cancels a body stalled after headers when the shared deadline expires` | 233 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: bounds lookups per save` | 249 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-poster-object.test.ts](../../../tests/vk-poster-object.test.ts)

Модуль vk-poster-object.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `source` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `status` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `describe: immutable automatic VK covers` | 14 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates a bounded WebP and reuses the same immutable object on retry` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers a lost PUT acknowledgement by HEAD on the next call without another PUT` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses a pre-existing object with mismatched evidence without overwriting it` | 98 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid image bytes and source identity before any object request` | 108 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-preview-fetch.test.ts](../../../tests/vk-preview-fetch.test.ts)

Модуль vk-preview-fetch.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: private VK preview egress` | 4 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the player parameters and uses the private gateway without credentials` | 5 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves signed image query parameters and pins the upstream host` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects non-preview resources before transport: %s` | 37 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not accept an arbitrary configured proxy` | 50 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-revisions.mysql.test.ts](../../../tests/vk-revisions.mysql.test.ts)

Модуль vk-revisions.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: VK edit revisions over native HTTP` | 20 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `cleanup` | 32 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `request` | 68 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: exposes an editable revision and rejects the stale administrator without replacing content` | 101 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts exactly one concurrent update with the same revision` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: requires a revision when the existing strict switch is on, preserving legacy compatibility while off` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps source creation idempotent and checks fresh rights before revision/detail` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects malformed expected revision %j` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/vk-worker-boundary.mysql.test.ts](../../../tests/vk-worker-boundary.mysql.test.ts)

Модуль vk-worker-boundary.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: live SQL API to native anonymous worker` | 13 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: denies GET HEAD Range and thumbnails after access revocation despite warm media cache` | 39 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/worker-entrypoint.test.ts](../../../tests/worker-entrypoint.test.ts)

Модуль worker-entrypoint.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: executable activates one owned scheduler only after successful listen; occupied port runs none` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/worker-jobs.test.ts](../../../tests/worker-jobs.test.ts)

Модуль worker-jobs.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `database` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `deferred` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `fixture` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `describe: explicit worker job orchestration` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: passes every scheduled callback through the shared admission before domain work` | 67 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled binding flag=%s performs no SQL or mail work` | 80 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not touch domain boundaries or schedule timers during construction` | 96 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves the four fixed cadences after a single explicit start` | 104 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: announces only returned published rows with their original targets` | 128 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: passes the same database and original sender bindings to both billing workers` | 148 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps email processing independent of a failed cancellation worker` | 174 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps cancellation processing independent of a failed email worker` | 192 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: isolates binding failure and retries it on the next billing cadence` | 210 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: holds billing single-flight while binding delivery is still pending` | 235 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: holds billing single-flight until both settled workers finish` | 261 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: catches database acquisition failure and recovers on the next billing cadence` | 286 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: waits for the existing shop helper before retention maintenance` | 308 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/worker-lifecycle.test.ts](../../../tests/worker-lifecycle.test.ts)

Модуль worker-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `deferred` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `describe: inert single-flight interval jobs` | 21 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not run or schedule anything until explicitly started` | 22 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: starts once immediately, then follows the fixed interval` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: skips busy intervals without overlap or a catch-up backlog` | 61 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps different jobs independent while one is blocked` | 86 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers after a %s without logging private error data` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stop before start permanently prohibits activation` | 149 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops timers but honestly exposes an unfinished run until it settles` | 167 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fences a timer callback already queued before stop` | 206 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stop fences initial work that has not yet entered its callback` | 231 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows stop from inside a callback without starting other queued jobs` | 250 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: settles a rejected pending run after stop without claiming provider success` | 275 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: only clears timers owned by this runner` | 292 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/worker-lock-guard.test.ts](../../../tests/worker-lock-guard.test.ts)

Модуль worker-lock-guard.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: waits for a pending ownership check before returning the session after callback %s` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/worker-lock-loss.mysql.test.ts](../../../tests/worker-lock-loss.mysql.test.ts)

Модуль worker-lock-loss.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `blackholeProxy` | 11 | Функция. Подробности и ограничения — в исходнике. |
| `describe: running worker loses its named lock` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `replica` | 78 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `answer` | 104 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `finish` | 119 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `killOwnedLock` | 143 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `waitForExit` | 153 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 166 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: stops the old process before it can resume stale work after %s` | 178 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: removes the guard after normal completion so a later idle connection failure does not kill the API` | 213 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: stops on a silent transport timeout while another API remains available` | 234 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/worker-restart.mysql.test.ts](../../../tests/worker-restart.mysql.test.ts)

Модуль worker-restart.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Ready` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `supervisedReplica` | 26 | Функция. Подробности и ограничения — в исходнике. |
| `launch` | 34 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `finish` | 66 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `stop` | 80 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `describe: API worker recovery after automatic process restart` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `health` | 121 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `phase` | 128 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: resumes publication after restart (lock occupied on restart: %s)` | 186 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/worker-stale-lease.mysql.test.ts](../../../tests/worker-stale-lease.mysql.test.ts)

Модуль worker-stale-lease.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: worker lease ownership before external effects` | 16 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not perform %s after another worker takes its lease` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not perform %s with an expired lease` | 75 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `check` | 81 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tests/workers-built.test.ts](../../../tests/workers-built.test.ts)

Модуль workers-built.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `it: compiled ESM composes inert workers and only runs explicitly supplied local effects` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/yaml-dependency.test.ts](../../../tests/yaml-dependency.test.ts)

Модуль yaml-dependency.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `toolingRequire` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `yamlPath` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `it: %s reports a YAML error for deeply nested collections` | 8 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: preserves ordinary tooling configuration, documents and flow formatting` | 38 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/yookassa-checkout.mysql.test.ts](../../../tests/yookassa-checkout.mysql.test.ts)

Модуль yookassa-checkout.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `realFetch` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `key` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `id` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: YooKassa native checkout and settlement` | 23 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `clearOrders` | 43 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `state` | 174 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: HTTP return checking a missing intent reports unknown without creating anything` | 200 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP return ignores forged query success while the provider is pending` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP verified return settles once with a concurrent webhook and reveals only state` | 223 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP canceled return never starts the next purchase` | 245 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP GET cannot settle a known succeeded payment` | 256 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP return outage is retriable and does not leak the key or grant access` | 263 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: HTTP quota refuses before provider lookup and preserves committed access on retry` | 278 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: return checking a missing intent cannot create an order or provider payment` | 300 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: return checking an uncertain create never retries provider POST` | 305 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: return checking a known pending payment uses GET without granting access` | 319 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: an uncaptured payment stays pending; return checking cannot capture it` | 326 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: another configured shop cannot discover or settle the saved intent` | 334 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a verified return and parallel webhook commit one grant before reporting success` | 344 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a canceled return reports only a verified state without a new purchase` | 363 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a provider outage cannot turn an existing intent into unknown or terminal` | 371 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a blocked recipient cannot reconcile or receive access` | 382 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: another signed-in actor cannot use the saved return capability` | 390 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a changed persisted email cannot turn a return into access` | 403 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a mismatched persisted %s refuses return checking` | 419 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a return cannot report success when atomic email/access settlement fails` | 437 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: return checking refuses a missing key or disabled test mode` | 453 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates a pending test payment, never a login or access grant` | 463 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: the same checkout key reuses a known payment instead of posting again` | 476 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a forged succeeded body cannot grant while the provider reports pending` | 482 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: verified succeeded grants one period and one outbox event under parallel replay` | 488 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a webhook before provider binding is retriable, not acknowledged or trusted` | 504 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: unknown creation retains the intent and repeats the stored request` | 509 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: test checkout refuses a missing key before creating a payment` | 518 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects fetched %s without granting access` | 523 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not acknowledge a provider lookup outage; a later retry settles` | 546 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a blocked recipient cannot receive access after checkout` | 556 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: outbox failure rolls back the receipt and access, then safely recovers` | 563 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a verified cancellation closes only the pending order, never grants` | 578 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a browser-style GET to the callback cannot settle a payment` | 587 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: oversized and malformed notifications are rejected before verification` | 599 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: disabled test mode cannot acknowledge or settle a test callback` | 613 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a six-month test purchase grants 180 days with no recurring profile` | 620 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a proved one-off payment can close renewal controls without calling Prodamus or reducing access` | 632 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: a yookassa-looking order without persisted receipt and binding cannot claim renewal cancellation` | 651 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/yookassa-client.test.ts](../../../tests/yookassa-client.test.ts)

Модуль yookassa-client.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `config` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `id` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `order` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payment` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `describe: YooKassa test-only provider boundary` | 34 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: fails closed without explicit test enablement` | 35 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe credentials before an external request: %s` | 43 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: accepts the explicitly enabled test stand only` | 56 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects production return origins even with a test key` | 66 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: checks the authenticated store is a test payment store` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses wrong/live/payout accounts` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: reads a payment on the fixed origin, redacting unused card fields` | 100 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: creates a one-off payment using the given stable key, without email/card data` | 119 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses mismatched created payments` | 147 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: never retries an uncertain create automatically or leaks error bodies` | 165 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects invalid payment IDs before network work` | 183 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects unsafe confirmation %s` | 194 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects oversized JSON and frees the transport slot` | 211 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: limits concurrent network operations without an unbounded queue` | 220 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/yookassa-egress.native.test.mjs](../../../tests/yookassa-egress.native.test.mjs)

Модуль yookassa-egress.native.test.mjs; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `enabled` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `nginx` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `probeImage` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `prefix` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `control` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `external` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `gateway` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `probe` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `label` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `config` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `owned` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `docker` | 86 | Функция. Подробности и ограничения — в исходнике. |
| `create` | 89 | Функция. Подробности и ограничения — в исходнике. |
| `inProbe` | 94 | Функция. Подробности и ограничения — в исходнике. |

## [tests/yookassa-intents.mysql.test.ts](../../../tests/yookassa-intents.mysql.test.ts)

Модуль yookassa-intents.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `order` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: durable YooKassa intents on disposable MySQL` | 27 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `count` | 81 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: persists a pending club order and the immutable request before dispatch` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent requests win one dispatch lease and create one pending order` | 97 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects payload changes instead of replaying another purchase` | 107 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: recovers after restart with the original price/body, not new configuration` | 115 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: refuses to redispatch an unknown create after the safe window` | 131 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: blacklist rejection leaves no intent or order` | 139 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: binds a verified create response and later recovers without another dispatch` | 158 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a mismatched binding without modifying the intent` | 169 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: late failure from an old attempt cannot clear a recovered dispatch lease` | 189 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/yookassa-return-http.test.ts](../../../tests/yookassa-return-http.test.ts)

Модуль yookassa-return-http.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `app` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `url` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `check` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `it: refuses disabled test return checking without entering legacy checkout or DB` | 44 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects missing/malformed intent header %s before storage` | 54 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects client supplied payment/identity input %j` | 62 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: cannot settle through a browser GET or paid URL parameter` | 71 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: rejects a payment-keyed batch instead of applying one key to multiple operations` | 77 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: keeps the existing cross-site rejection %j` | 87 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/yookassa-return-limit-http.test.ts](../../../tests/yookassa-return-limit-http.test.ts)

Модуль yookassa-return-limit-http.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `app` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `base` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `windowIndex` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `check` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `it: allows twelve checks of one intent then refuses without exposing its key` | 52 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: normalizes intent UUID casing so uppercase cannot reset the quota` | 69 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: shares the intent budget across resolved IPs` | 76 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: allows sixty distinct intents per resolved IP despite forged leftmost forwarded headers` | 89 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not spend an intent budget when its IP is already blocked` | 111 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts malformed and missing intent headers in the IP budget` | 126 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: counts invalid bodies without allowing them to invoke payment storage` | 133 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not extend the window on refusal and resumes only at expiry` | 140 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: concurrent requests cannot exceed the per-intent budget` | 153 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: does not spend the payment-check budget on unrelated subscription queries` | 166 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/youtube-publication.mysql.test.ts](../../../tests/youtube-publication.mysql.test.ts)

Модуль youtube-publication.mysql.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `describe: single-video public publication authority` | 11 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `query` | 23 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `it: uses a bounded authority response even beyond 1000 catalog records and revokes visibility immediately` | 28 | Проверочный сценарий. Подробности и ограничения — в исходнике. |

## [tests/youtube-stream-lifecycle.test.ts](../../../tests/youtube-stream-lifecycle.test.ts)

Модуль youtube-stream-lifecycle.test.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `run` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `describe: legacy API video streaming on isolated loopback processes` | 9 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
| `it: survives %s and releases the upstream connection` | 83 | Проверочный сценарий. Подробности и ограничения — в исходнике. |
