import { describe, expect, it } from "vitest";
import { decodeMediaBase64 } from "../apps/backend/src/media/media-encoding";

describe("canonical media Base64", () => {
  it.each([
    ["Zg==", [102]], ["Zm8=", [102, 111]], ["Zm9v", [102, 111, 111]],
    ["/w==", [255]], ["//8=", [255, 255]],
    ["AA==", [0]], ["AAA=", [0, 0]], ["AAAA", [0, 0, 0]],
  ] as const)("decodes %s exactly", (encoded, bytes) => {
    expect(decodeMediaBase64(encoded)).toEqual(Buffer.from(bytes));
  });

  it.each([
    "", "A", "AA", "AAA", "A===", "====", "AA=A", "AAAA=AAA",
    "AAAA====", "AA==AAAA", "Zg==\n", " Zg==", "Zg== ", "Zg=",
    "Zg===", "Zg--", "Zg__", "Zh==", "Zm9=", "Aé==", "AA\0=",
  ])("refuses malformed or noncanonical encoding %j", encoded => {
    expect(() => decodeMediaBase64(encoded)).toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });

  it("preserves every byte and refuses nonzero unused padding bits", () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let byte = 0; byte < 256; byte++) {
      const bytes = Buffer.from([byte]);
      const encoded = bytes.toString("base64");
      expect(decodeMediaBase64(encoded)).toEqual(bytes);
      const second = alphabet.indexOf(encoded[1]!);
      for (let extra = 1; extra < 16; extra++) {
        expect(() => decodeMediaBase64(encoded[0] + alphabet[second + extra]! + "=="))
          .toThrowError(expect.objectContaining({ code: "BAD_REQUEST" }));
      }
    }
  });

  it("enforces a decoded-byte ceiling including padding without changing valid bytes", () => {
    expect(decodeMediaBase64("AA==", 1)).toEqual(Buffer.from([0]));
    expect(decodeMediaBase64("AAA=", 2)).toEqual(Buffer.from([0, 0]));
    expect(decodeMediaBase64("AAAA", 3)).toEqual(Buffer.from([0, 0, 0]));
    for (const [encoded, limit] of [["AA==", 0], ["AAA=", 1], ["AAAA", 2]] as const) {
      expect(() => decodeMediaBase64(encoded, limit)).toThrowError(
        expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }),
      );
    }
  });

  it("checks both unused bits for every two-byte suffix", () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let byte = 0; byte < 256; byte++) {
      const bytes = Buffer.from([0, byte]);
      const encoded = bytes.toString("base64");
      expect(decodeMediaBase64(encoded)).toEqual(bytes);
      const third = alphabet.indexOf(encoded[2]!);
      for (let extra = 1; extra < 4; extra++) {
        expect(() => decodeMediaBase64(encoded.slice(0, 2) + alphabet[third + extra]! + "="))
          .toThrowError(expect.objectContaining({ code: "BAD_REQUEST" }));
      }
    }
  });

  it("does not disguise invalid padding bits as a size rejection", () => {
    expect(() => decodeMediaBase64("AAB=", 1)).toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });
});
