import { expect, test } from "@playwright/test";

test("retired public pattern originals are unavailable while public covers remain available", async ({
  request,
}) => {
  for (const filename of [
    "18c14e47537e-EJllmcoOmdUexPyK.full.3806194d71bef3f6.webp",
    "958b97c139fc-kvcsayGSgtVcnjGN.full.1cc0462841dbff90.webp",
    "ded750bddbeb-HSvrSZijpbSHOLAN.full.493a6b466590d5c7.webp",
    "9b32f7b0c8f1-ReabYqEbymjBrDEY.full.73f233acce5d7b95.webp",
  ]) {
    const response = await request.get(`/assets/responsive/${filename}`, {
      headers: { Range: "bytes=0-63" },
    });
    expect(response.status()).toBe(404);
  }
  const cover = await request.get(
    "/assets/responsive/f8a919017d4c-WDRmWxjeWyXWNrto.w900.ea6d6770802512b5.webp",
  );
  expect(cover.status()).toBe(200);
  expect(cover.headers()["content-type"]).toContain("image/webp");
});
