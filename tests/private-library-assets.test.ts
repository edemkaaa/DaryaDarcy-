/** Закрытые ресурсы и обход image optimizer проверяются через frontend proxy без запуска Next. */
import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../apps/frontend/src/proxy";

/** Обычный, URL-кодированный и optimizer-путь старой платной копии должны дать 404 с private/no-store. */
it.each([
  "/assets/results/castlecore/outfits/outfit3.lossless.webp",
  "/assets/results/castlecore/outfits/outfit3.webp",
  "/assets/results/%63astlecore/outfits/outfit3.lossless.webp",
  "/_next/image?url=%2Fassets%2Fresults%2Fcastlecore%2Foutfits%2Foutfit3.lossless.webp&w=640&q=75",
  "/assets/responsive/18c14e47537e-EJllmcoOmdUexPyK.w1200.dd9a8b6ba161a1ff.webp",
])(
  "refuses an old paid copy or optimizer bypass without redirect: %s",
  (path) => {
    const response = proxy(new NextRequest("https://app.test" + path));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  },
);
/** Бесплатный тест, служебные ресурсы и защищённый API не блокируются этим списком старых статических копий. */
it.each([
  "/assets/quiz/houses/cottagecore.webp",
  "/assets/images/icon.png",
  "/manifest.webmanifest",
  "/api/media/library-files/patterns/holly",
])(
  "leaves public/free assets and authenticated delivery to their existing handlers: %s",
  (path) => {
    expect(proxy(new NextRequest("https://app.test" + path)).status).toBe(200);
  },
);
