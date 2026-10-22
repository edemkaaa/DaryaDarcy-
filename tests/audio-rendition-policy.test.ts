import { expect, it } from "vitest";
import { audioRenditionBitrate } from "../tooling/data/audio-rendition-policy";

it.each([
  [3, 96],
  [1305.77, 96],
  [2224.81, 96],
  [3000, 80],
  [3500, 64],
  [5832.96, 40],
  [7500, 32],
])(
  "keeps a %s-second legacy podcast within the existing audio quota at %s kbps",
  (duration, expected) =>
    expect(audioRenditionBitrate(duration)).toBe(expected),
);
it.each([0, -1, NaN, Infinity, 8000, 15000])(
  "refuses invalid or too long duration %s instead of raising the quota",
  (duration) => {
    expect(() => audioRenditionBitrate(duration)).toThrow();
  },
);
