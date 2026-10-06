# ADR-006: Isolate public-video preparation from the application API

- **Status:** Accepted for the user-approved test stand, not production rollout
- **Date:** 2026-10-07

## Context

The imported catalog contains YouTube IDs, not local MP4 copies. Existing
playback returns 502: yt-dlp is missing and the main API has no external egress.
A checksum-verified, secretless probe can retrieve separate H.264 and AAC
tracks. There is no combined progressive MP4 for the observed first video.

## Decision

Add a dependency-free Node worker under `apps/video-service`, with a separate
versioned image and opt-in staging Compose/edge overlay. Main API, database,
frontend image and SMTP remain untouched. Only the worker gets video egress.
It joins a dedicated internal network shared with edge, not the API/DB network.

Use the current anonymous catalog as publication authority, checked before
external work/cache reads and again before sending a prepared file. Accept exact
YouTube IDs only, no client URLs. No database credentials, account cookies or
application volumes in the worker. Thumbnail fetches use one fixed HTTPS host
without redirects; catalog replies and image bytes are bounded and validated.

Pin and checksum-verify official yt-dlp; use Debian's signed FFmpeg package to
combine H.264/AAC without transcoding. Serve a faststart MP4 through the existing
same-origin video route, with GET/HEAD/Range. Bound preparation concurrency,
duration, files, process output and container resources. Temporary filesystem
limit is 384 MiB, including intermediate media; ready-file budget is 128 MiB.
No added npm packages, migrations, tRPC procedure or frontend generated type.

## Alternatives considered

Opening API egress and installing media tooling inside it: broadens the boundary
holding application credentials; rejected. Proxying one extracted URL: does not
combine the separate audio/video tracks. Full re-encoding: unnecessary CPU use
and quality loss. External paid video/CDN service: requires separate credentials,
authorization and commercial choice; not part of this test fix.

## Consequences

First playback waits for full preparation; cached playback supports seeking.
This is deliberately a bounded test adapter, not a scalable CDN or access-control
solution for private materials. Provider availability and size/duration limits
remain visible failures; never use account cookies, challenge bypasses or fake
success responses to conceal them. Real browser playback/sound/seek is an
acceptance gate beyond unit tests, metadata extraction and HTTP header checks.

The new optional routes supersede the old API proxy only on this test stand.
Keep the old handler and base deployment unchanged; removing them globally is a
separate decision. Roll back only edge and this optional worker; do not roll back
the main database, SMTP or backend security repairs.

References: [worker contract](../../apps/video-service/README.md),
[yt-dlp dependencies](https://github.com/yt-dlp/yt-dlp#dependencies),
[FFmpeg stream copy](https://ffmpeg.org/ffmpeg.html#Streamcopy),
[staging operations](../operations/teamassist-staging.md).
