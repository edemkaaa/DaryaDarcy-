# Local build stabilization (2026-09-23)

This branch is not approved for deployment. No production environment is needed
for the following checks. Never copy production.env into a build workspace.

## Tested toolchain

- Node.js 22.23.3
- pnpm 9.12.0 (the packageManager field)
- Use pnpm-lock.yaml as the authoritative lock for this branch.
- package-lock.json is retained from the handover, is NOT synchronized with this
  branch, and must not be used for CI. An attempted npm lock-only update in the
  pnpm-installed sandbox failed inside npm (null edgesOut); no force flags used.
  Resolve the legacy npm workflow separately before offering npm instructions.

## Checks

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run build:web
pnpm run verify
pnpm run check
```

Installation, API compilation and clean Expo export pass. API runtime/integrations
are not tested. NativeWind uses its Metro integration (forceWriteFileSystem=false).
Regression checks: 52 pass. Focused checks: 12 pass (including 6 new tests).
Regression checks also pass with CHECK_WEB_DIST=1 against the new build artifacts.
TypeScript: zero diagnostics; strict checks have not been disabled.

Expanded offline suite (excluding the real S3 write test): 174 pass, 8 fail,
1 pre-existing skipped logout test. All 10 failures are in screens.test.ts;
Originally 10 failed in the preserved pre-fix build copy; two incorrect tests
were corrected to follow the shared tag data and their stated accepted fonts.
The remaining eight concern expected UI
sections, fonts, tags and marketing push controls. Do not remove these guards
without reconciling actual product requirements. This is not an all-green suite.

Native iOS/Android, browser interaction, database, payment, SMS and SMTP are not
verified. Several Expo dependencies span different SDK generations; web compile
success does not establish native compatibility. Sanitization now rejects
malformed/non-HTTP(S) API photo URLs and normalizes rich-text display; browser
acceptance should check real media and formatting before deployment.

Do not run deploy, smoke-production, db:push or S3 scripts during local build
verification. Historical deployment scripts require separate review. Frontend
build scripts overwrite their local output directories: use an exported working
copy rather than preserved handover artifacts.

Next: reconcile existing screen-test failures and perform staging browser/runtime
acceptance before enabling production deploys. The build archive is NOT approved
for production and has not been uploaded.
