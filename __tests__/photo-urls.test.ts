import { describe, expect, it } from "vitest";
import { sanitizePhotoUrls } from "../lib/photo-urls";

describe("API photo URLs", () => {
  it("keeps valid signed URLs unchanged and in order", () => {
    const urls = ["https://cdn.example/a.jpg?signature=abc%2Fdef", "http://cdn.example/b.png"];
    expect(sanitizePhotoUrls(urls)).toEqual(urls);
  });
  it("rejects invalid types, local and executable URLs", () => {
    expect(sanitizePhotoUrls([null, {}, 4, "", "javascript:alert(1)", "file:///etc/passwd", "https://u:p@cdn.example/a", "not a URL"])).toEqual([]);
    expect(sanitizePhotoUrls(null)).toEqual([]);
  });
});
