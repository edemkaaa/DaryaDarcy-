import { flacFixtureBase64 } from "./helpers/flac-fixture";
import { expect, it } from "vitest";
import { isDeliverableAttachmentMime } from "../apps/backend/src/media/private-attachment-mime";
import { resolveMediaContentType } from "../apps/backend/src/content/media-content-type";

it("allows lossless FLAC recognized from actual bytes through the private delivery boundary", async () => {
  const bytes = Buffer.from(flacFixtureBase64, "base64");
  const detected = await resolveMediaContentType("audio", "audio/flac", bytes);
  expect(isDeliverableAttachmentMime(detected)).toBe(true);
});
it.each(["audio/aac", "audio/aiff", "audio/x-aiff"])(
  "keeps unsupported raw containers out of delivery: %s",
  (mime) => {
    expect(isDeliverableAttachmentMime(mime)).toBe(false);
  },
);
