import { expect, test } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

for (const path of ["/club", "/feed"]) {
  for (const width of [390, 1440]) {
    test.describe(`${path} album at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      for (const scenario of [
        { name: "five", ratios: [0.8, 0.8, 0.8, 0.8, 0.8], rows: [2, 3] },
        { name: "seven", ratios: Array(7).fill(0.8), rows: [3, 4] },
        { name: "landscape pair", ratios: [1.6, 1.6], rows: [1, 1] },
        { name: "portrait pair", ratios: [0.8, 0.8], rows: [2] },
        { name: "mixed pair", ratios: [1.6, 0.8], rows: [2] },
      ]) {
        test(`${scenario.name} fills rows and opens the original photo index`, async ({
          page,
        }, testInfo) => {
          const photos = scenario.ratios.map(
            (_, i) => `https://album.example.test/${i}.svg`,
          );
          const post = {
            id: 42,
            text: "Осенняя подборка для дома",
            richText: null,
            photos,
            tags: ["podborki"],
            target: "both",
            published: true,
            createdAt: "2026-10-05T10:00:00Z",
            publishedAt: "2026-10-05T10:00:00Z",
            media: [],
            likeCount: 0,
            commentCount: 0,
          };
          await editorApi(page, (name) => {
            if (name === "feed.listPaginated" || name === "club.listByCategory")
              return ok({ posts: [post], nextCursor: null });
            if (name === "feed.getById") return ok(post);
          });
          const requests: string[] = [];
          let releaseSecond: (() => void) | undefined;
          const second = new Promise<void>((resolve) => {
            releaseSecond = resolve;
          });
          await page.route("https://album.example.test/**", async (route) => {
            requests.push(route.request().url());
            const i = photos.indexOf(route.request().url());
            if (scenario.name === "landscape pair" && i === 1) await second;
            const w = scenario.ratios[i] * 800;
            const color = ["#94795a", "#677657", "#a16a4e", "#82776b"][i % 4];
            await route.fulfill({
              contentType: "image/svg+xml",
              body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="800"><rect width="100%" height="100%" fill="${color}"/><rect x="30" y="30" width="${w - 60}" height="740" fill="#f3ead7"/><text x="50%" y="48%" text-anchor="middle" font-size="90" fill="${color}">${i + 1}</text><text x="50%" y="60%" text-anchor="middle" font-size="32" fill="${color}">Осенняя подборка</text></svg>`,
            });
          });
          await gotoWithSession(page, path);
          const album = page.getByRole("group", {
            name: "Фотографии поста",
            exact: true,
          });
          const images = album.locator("img");
          await expect(images).toHaveCount(photos.length);
          if (scenario.name === "landscape pair") {
            await expect
              .poll(() =>
                images
                  .first()
                  .evaluate((img: HTMLImageElement) => img.naturalWidth),
              )
              .toBe(1280);
            const before = await images.evaluateAll((nodes) =>
              nodes.map((node) => node.getBoundingClientRect().top),
            );
            expect(before[0]).toBe(before[1]);
            releaseSecond!();
          }
          await expect
            .poll(() =>
              images.evaluateAll((nodes) =>
                nodes.every(
                  (node) => (node as HTMLImageElement).naturalWidth > 0,
                ),
              ),
            )
            .toBe(true);
          const geometry = () =>
            images.evaluateAll((nodes) =>
              nodes.map((node) => {
                const b = node.getBoundingClientRect();
                return {
                  x: b.x,
                  y: b.y,
                  width: b.width,
                  height: b.height,
                  right: b.right,
                };
              }),
            );
          await expect
            .poll(async () => {
              const rows = new Map<number, number>();
              for (const box of await geometry())
                rows.set(
                  Math.round(box.y),
                  (rows.get(Math.round(box.y)) ?? 0) + 1,
                );
              return [...rows.values()];
            })
            .toEqual(scenario.rows);
          const boxes = await geometry();
          const frame = (await album.boundingBox())!;
          expect(Math.abs(boxes[0].y - frame.y)).toBeLessThan(2);
          expect(
            Math.abs(
              Math.max(...boxes.map((box) => box.y + box.height)) -
                (frame.y + frame.height),
            ),
          ).toBeLessThan(2);
          for (let offset = 0, row = 0; row < scenario.rows.length; row++) {
            const size = scenario.rows[row];
            expect(Math.abs(boxes[offset].x - frame.x)).toBeLessThan(2);
            expect(
              Math.abs(
                boxes[offset + size - 1].right - (frame.x + frame.width),
              ),
            ).toBeLessThan(2);
            offset += size;
          }
          if (scenario.name === "five" || scenario.name === "seven") {
            expect(boxes[0].width).toBeGreaterThan(boxes.at(-1)!.width);
            expect(boxes[0].height).toBeGreaterThan(boxes.at(-1)!.height);
          }
          expect(requests.sort()).toEqual([...photos].sort());
          await album.screenshot({ path: testInfo.outputPath("album.png") });
          await album
            .getByRole("button", { name: /Открыть фото/ })
            .last()
            .click();
          const viewer = page.getByRole("dialog", {
            name: "Просмотр фотографий",
          });
          await expect(viewer).toBeVisible();
          await expect(
            viewer.getByText(`${photos.length} / ${photos.length}`, {
              exact: true,
            }),
          ).toBeVisible();
        });
      }
    });
  }
}
