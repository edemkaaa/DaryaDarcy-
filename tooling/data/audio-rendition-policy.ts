// Выбирает битрейт совместимой аудиокопии в пределах прежней квоты 32 МиБ, оставляя запас на контейнер и дрейф среднего битрейта.
import assert from "node:assert/strict";

/** Offline copies must fit the existing 32 MiB audio quota, not bypass it.
 * Reserve 2 MiB for container overhead and the AAC encoder's average-rate drift. */
export function audioRenditionBitrate(duration: number) {
  assert(Number.isFinite(duration) && duration > 0, "Invalid audio duration");
  const bitrate = [96, 80, 64, 48, 40, 32].find(
    (kbps) => (duration * kbps * 1000) / 8 <= 30 * 1024 * 1024,
  );
  assert(
    bitrate,
    "Recording needs an explicitly reviewed size/quality decision",
  );
  return bitrate;
}
