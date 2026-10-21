import { describe, expect, it } from "vitest";
import {
  normalizeMediaContentType,
  resolveMediaContentType,
} from "../apps/backend/src/content/media-content-type";
import {
  mp3Fixture,
  mp4Fixture,
  movFixture,
  audioWebmFixture,
  wavFixture,
} from "./helpers/media-fixtures";
import {
  pdfFixture,
  docxFixture,
  docmFixture,
  zipFixture,
  docxMime,
} from "./helpers/document-fixtures";
import {
  utf8Text,
  cp1251Text,
  utf16leText,
  utf16beText,
} from "./helpers/text-fixtures";

// The policy is shared by private uploads. These byte/MIME regressions must not
// depend on keeping the retired public HTTP routes writable.
const resolve = (
  type: "audio" | "video" | "document",
  mime: string,
  bytes: Buffer,
) =>
  resolveMediaContentType(type, normalizeMediaContentType(type, mime), bytes);
describe("media policy independent of legacy public uploads", () => {
  it.each([
    ["PDF", pdfFixture, "application/pdf", "application/pdf"],
    ["DOCX", docxFixture, docxMime, docxMime],
    [
      "opaque PDF",
      pdfFixture,
      "application/octet-stream; charset=invalid",
      "application/pdf",
    ],
    ["opaque DOCX", docxFixture, "application/octet-stream", docxMime],
    ["UTF-8", utf8Text, "text/plain", "text/plain; charset=utf-8"],
    [
      "UTF-8 alias",
      utf8Text,
      'text/plain; CHARSET="utf8"',
      'text/plain; CHARSET="utf8"',
    ],
    ["UTF-16LE", utf16leText, "text/plain", "text/plain; charset=utf-16le"],
    ["UTF-16BE", utf16beText, "text/plain", "text/plain; charset=utf-16be"],
    [
      "Windows-1251",
      cp1251Text,
      "text/plain; charset=windows-1251",
      "text/plain; charset=windows-1251",
    ],
    [
      "opaque UTF-8",
      utf8Text,
      "application/octet-stream",
      "text/plain; charset=utf-8",
    ],
    [
      "opaque UTF-16BE",
      utf16beText,
      "application/octet-stream",
      "text/plain; charset=utf-16be",
    ],
    [
      "escaped charset",
      utf8Text,
      'text/plain; charset="utf\\-8"',
      'text/plain; charset="utf\\-8"',
    ],
    [
      "parameter isolation",
      utf8Text,
      'text/plain; note=";charset=windows-1251"',
      'text/plain; note=";charset=windows-1251"; charset=utf-8',
    ],
    [
      "literal markup",
      Buffer.from("<html><script>example only</script></html>"),
      "text/plain",
      "text/plain; charset=utf-8",
    ],
    [
      "split UTF-8",
      Buffer.concat([Buffer.alloc(16383, 0x61), Buffer.from("🙂")]),
      "text/plain",
      "text/plain; charset=utf-8",
    ],
    [
      "split surrogate",
      Buffer.concat([
        Buffer.from([255, 254]),
        Buffer.from("a".repeat(8190) + "🙂", "utf16le"),
      ]),
      "text/plain",
      "text/plain; charset=utf-16le",
    ],
    [
      "MIME ceiling",
      utf8Text,
      `text/plain; note="${"a".repeat(94)}"`,
      `text/plain; note="${"a".repeat(94)}"; charset=utf-8`,
    ],
  ] as const)(
    "resolves %s without modifying its bytes",
    async (_name, bytes, declared, canonical) => {
      const original = Buffer.from(bytes);
      expect(await resolve("document", declared, bytes)).toBe(canonical);
      expect(bytes).toEqual(original);
    },
  );
  it.each([
    ["invalid UTF-8", Buffer.from([255, 65]), "text/plain"],
    ["NUL", Buffer.from("hello\0world"), "text/plain"],
    ["escape", Buffer.from("hello\u001bworld"), "text/plain"],
    ["C1", Buffer.from("hello\u0085world"), "text/plain"],
    ["unknown charset", utf8Text, "text/plain; charset=shift_jis"],
    [
      "duplicate charset",
      utf8Text,
      "text/plain; charset=utf-8; CHARSET=windows-1251",
    ],
    ["empty charset", utf8Text, 'text/plain; charset=""'],
    ["unlabelled legacy text", cp1251Text, "text/plain"],
    ["BOM conflict", utf16beText, "text/plain; charset=utf-16le"],
    ["truncated UTF-16", Buffer.from([255, 254, 65]), "text/plain"],
    ["unpaired surrogate", Buffer.from("fffe00d8", "hex"), "text/plain"],
    [
      "split invalid UTF-8",
      Buffer.concat([Buffer.alloc(16384, 0x61), Buffer.from([226, 130])]),
      "text/plain",
    ],
    [
      "late control",
      Buffer.concat([Buffer.alloc(16384, 0x61), Buffer.from([0])]),
      "text/plain",
    ],
    [
      "resolved MIME overflow",
      utf8Text,
      `text/plain; note="${"a".repeat(109)}"`,
    ],
  ] as const)("rejects document %s", async (_name, bytes, declared) => {
    await expect(resolve("document", declared, bytes)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
  it.each([
    pdfFixture,
    docxFixture,
    docmFixture,
    zipFixture,
    mp3Fixture,
    mp4Fixture,
  ])("cannot disguise a binary document as plain text", async (bytes) => {
    await expect(
      resolve("document", "text/plain", bytes),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it.each([
    zipFixture,
    docmFixture,
    mp3Fixture,
    Buffer.from("<html>synthetic</html>"),
  ])("rejects foreign bytes labelled PDF or DOCX", async (bytes) => {
    for (const mime of ["application/pdf", docxMime])
      await expect(resolve("document", mime, bytes)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
  });
  it.each([
    [pdfFixture, docxMime],
    [docxFixture, "application/pdf"],
  ] as const)("rejects a PDF/DOCX format swap", async (bytes, mime) => {
    await expect(resolve("document", mime, bytes)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
  it.each([
    ["audio", " Audio/MPEG ", mp3Fixture, "audio/mpeg"],
    [
      "audio",
      'audio/webm; codecs="opus"',
      audioWebmFixture,
      'audio/webm; codecs="opus"',
    ],
    ["audio", "audio/x-wav", wavFixture(), "audio/wav"],
    ["audio", 'audio/mpeg; codecs="mp3"', wavFixture(), "audio/wav"],
    ["audio", "application/octet-stream", mp3Fixture, "audio/mpeg"],
    ["audio", "application/octet-stream", mp4Fixture, "audio/mp4"],
    ["video", "VIDEO/MP4", mp4Fixture, "video/mp4"],
    ["video", "application/octet-stream", movFixture, "video/quicktime"],
  ] as const)(
    "resolves %s %s from actual bytes",
    async (type, mime, bytes, canonical) => {
      expect(await resolve(type, mime, bytes)).toBe(canonical);
    },
  );
  it.each([mp3Fixture, wavFixture()])(
    "refuses audio bytes in the video category",
    async (bytes) => {
      await expect(resolve("video", "video/mp4", bytes)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    },
  );
  it.each([
    pdfFixture,
    zipFixture,
    Buffer.from("<html>synthetic</html>"),
    Buffer.from("<svg/>"),
    Buffer.from("0000001866747970", "hex"),
  ])("refuses foreign/truncated bytes as audio or video", async (bytes) => {
    for (const type of ["audio", "video"] as const)
      await expect(
        resolve(type, type === "audio" ? "audio/mpeg" : "video/mp4", bytes),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it.each([
    "text/html",
    "image/svg+xml",
    "audio/",
    "audio/mpeg/extra",
    "audio/mpeg\r\nX-Injected: yes",
    "audio/mpeg;garbage",
    "audio/mpeg; codecs=opus, text/html",
  ])("refuses invalid or unsafe declared MIME %s", (mime) => {
    expect(() => normalizeMediaContentType("audio", mime)).toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });
});
