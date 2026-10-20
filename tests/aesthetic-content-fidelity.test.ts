import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aestheticGuides } from "../apps/backend/src/content/aesthetic-guides";
import { aestheticGuideSchema } from "../packages/shared/src/aesthetic-guide";
import { aestheticContentHashes } from "./fixtures/aesthetic-content-hashes";

describe("paid aesthetic content move", () => {
  it.each(Object.keys(aestheticGuides) as (keyof typeof aestheticGuides)[])(
    "preserves every original paid field for %s",
    (key) => {
      const paid = aestheticGuides[key];
      expect(
        createHash("sha256").update(JSON.stringify(paid)).digest("hex"),
      ).toBe(aestheticContentHashes[key].paid);
      expect(aestheticGuideSchema.parse({ key, ...paid })).toEqual({
        key,
        ...paid,
      });
    },
  );
});
