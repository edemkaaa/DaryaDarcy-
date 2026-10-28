import { AUDIO_MIMES } from "../../../../packages/shared/src/audio-formats";
// Keep private upload acceptance aligned with the existing closed read boundary.
const DELIVERABLE_MIMES = new Set([
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ...AUDIO_MIMES,
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/octet-stream",
]);

export function isDeliverableAttachmentMime(mime: string): boolean {
  return DELIVERABLE_MIMES.has(mime.split(";")[0].trim().toLowerCase());
}
