// Архив Expo. Читает исторические пути исходников через repository/frontend fallback; архивный layout путей не является текущим web-пакетом.
/**
 * Regression guards — run before every deploy (`npm run verify`).
 * Add a test here when fixing a user-visible bug so it cannot silently return.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { splitVideoPhotos } from "../apps/frontend/lib/post-media-photos";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(root, "apps", "frontend");

function read(rel: string): string {
  // Читает исторические пути исходников через repository/frontend fallback; архивный layout путей не является текущим web-пакетом.

  const repositoryPath = path.join(root, rel);
  const filePath = fs.existsSync(repositoryPath)
    ? repositoryPath
    : path.join(frontendRoot, rel);
  return fs.readFileSync(filePath, "utf8");
}

describe("Feed stability", () => {
  const feed = read("app/(tabs)/feed.tsx");

  it("lazy-mounts PhotoViewer only when open", () => {
    // Сценарий: Проверяет отложенное монтирование viewer только при открытом просмотре.

    expect(feed).toContain("viewerVisible ?");
    expect(feed).toContain("<PhotoViewer");
  });

  it("invalidates paginated cache on refresh and delete", () => {
    // Сценарий: Проверяет сброс постраничной выдачи после обновления и удаления.

    expect(feed).toContain("utils.feed.listPaginated.invalidate");
    const mgmt = read("components/post-management.tsx");
    expect(mgmt).toContain("utils.feed.listPaginated.invalidate");
    expect(mgmt).toContain("setActivePost(null)");
  });

  it("normalizes API posts before render", () => {
    // Сценарий: Проверяет наличие нормализации поста, URL фото и richText перед render.

    expect(feed).toContain("normalizeFeedPost");
    expect(feed).toContain("sanitizePhotoUrls");
    expect(feed).toContain("sanitizeRichTextForDisplay");
  });

  it("uses ScrollView carousel instead of nested FlatList for 10+ photos", () => {
    // Сценарий: Не допускает вложенный FlatList для длинной фотокарусели.

    const carousel = read("components/media/post-photo-carousel.tsx");
    expect(carousel).toContain("ScrollView");
    expect(carousel).not.toContain("FlatList");
  });

  it("uses photo grid for 2-4 images, carousel only above nine", () => {
    // Сценарий: Закрепляет порог карусели и сетку для небольшого числа кадров.

    const stack = read("components/media/natural-photo-stack.tsx");
    expect(stack).toContain("photos.length > 9");
    expect(stack).not.toContain("photos.length <= 3");
    expect(stack).toContain("photos.length === 4");
  });

  it("pages photo viewer with horizontal ScrollView", () => {
    // Сценарий: Проверяет перелистывание viewer через измеряемый ScrollView.

    const viewer = read("components/photo-viewer.tsx");
    expect(viewer).toContain("ScrollView");
    expect(viewer).toContain("useWindowDimensions");
    expect(viewer).not.toContain("initialScrollIndex");
  });
});

describe("Video poster selection", () => {
  it("uses matching _thumb as cover and keeps gallery photos separate", () => {
    // Сценарий: Сопоставляет видео с одноимённым _thumb, не забирая обычные фото из галереи.

    const { posterUrl, galleryPhotos } = splitVideoPhotos(
      [
        "https://cdn/a.jpg",
        "https://cdn/b.jpg",
        "https://cdn/clip_thumb.jpg",
      ],
      "clip.mp4",
    );
    expect(posterUrl).toBe("https://cdn/clip_thumb.jpg");
    expect(galleryPhotos).toEqual(["https://cdn/a.jpg", "https://cdn/b.jpg"]);
  });
});

describe("Home — Secret Garden", () => {
  const garden = read("components/garden-tour-video.tsx");

  it("shows poster before play", () => {
    // Сценарий: Проверяет, что видео сада до запуска показывает poster.

    expect(garden).toContain("GARDEN_POSTER_URL");
    expect(garden).toContain("GardenPoster");
    expect(garden).toContain("!isPlaying");
  });

  it("does not import expo-video at module top level on web", () => {
    // Сценарий: Предотвращает загрузку native video-модуля в web import.

    expect(garden).not.toMatch(/^import\s+\{[^}]*useVideoPlayer[^}]*\}\s+from\s+"expo-video"/m);
    expect(garden).toContain('Platform.OS !== "web"');
  });
});

describe("Rich text selection", () => {
  const formatting = read("lib/use-rich-text-formatting.ts");
  const selection = read("lib/selection.ts");
  const createPost = read("components/admin/create-post-modal.tsx");

  it("debounces native selection UI and stores pending link snapshot", () => {
    // Сценарий: Проверяет задержку native selection и сохранение якоря ссылки.

    expect(formatting).toContain("pendingLinkSnapshotRef");
    expect(formatting).toContain("flushSelectionUi");
    expect(formatting).toContain("scheduleSelectionUi");
    expect(selection).toContain("bestDistance");
  });

  it("remounts rich text editor for each new draft post", () => {
    // Сценарий: Проверяет новый ключ редактора для каждого нового черновика.

    expect(createPost).toContain("draftKey");
    expect(createPost).toContain("setDraftKey((key) => key + 1)");
    expect(createPost).toContain("key={editingPost?.id ?? `draft-${draftKey}`}");
  });

  it("applies links only from the pending selection snapshot", () => {
    // Сценарий: Не допускает случайное применение ссылки к устаревшему общему выделению.

    expect(formatting).toContain("pendingLinkSnapshotRef.current");
    expect(formatting).not.toMatch(
      /pendingLinkSnapshotRef\.current \|\| selectionSnapshotRef\.current/,
    );
  });

  it("submits rich text using the same snapshot as preview", () => {
    // Сценарий: Проверяет общий снимок форматирования для preview и отправки обоих редакторов.

    expect(formatting).toContain("getRichTextBlocksForSubmit");
    expect(read("components/admin/rich-text-field.tsx")).toContain("getRichTextBlocksForSubmit");
    expect(createPost).toContain("getRichTextBlocksForSubmit");
    expect(read("app/admin/index.tsx")).toContain("getRichTextBlocksForSubmit");
  });

  it("keeps prior links when adding the next one", () => {
    // Сценарий: Сохраняет предыдущие ссылки и идентификацию повторяющихся текстовых якорей.

    expect(selection).toContain("if (current.length > 0) return normalized");
    expect(formatting).toContain("pendingLinkOccurrenceRef");
    expect(formatting).toContain("rangeForOccurrence");
    expect(formatting).toContain("runAfterSelectionReady");
    expect(formatting).not.toContain("prev.flatMap");
  });
});

describe("Emoji rendering", () => {
  it("splits emoji from serif body text", () => {
    // Сценарий: Проверяет отдельную отрисовку emoji системным шрифтом.

    const emoji = read("lib/emoji-text.ts");
    const renderer = read("components/rich-text-renderer.tsx");
    expect(emoji).toContain("splitForEmojiRendering");
    expect(renderer).toContain("styles.emojiText");
  });
});

describe("Club tag board", () => {
  const board = read("components/club/tag-board-drawer.tsx");

  it("positions tag grid slightly below linen center", () => {
    // Сценарий: Закрепляет расчёт области тегов относительно льняного участка доски.

    expect(board).toContain("BOARD_WIDTH_RATIO");
    expect(board).toContain("BOARD_IMG_ASPECT");
    expect(board).toContain("LINEN_TOP_RATIO = 0.23");
    expect(board).toContain("LINEN_BOTTOM_RATIO");
    expect(board).toContain("BOARD_LINEN_HEIGHT");
    expect(board).toContain("TAG_GRID_TOP_PADDING = Math.round(BOARD_LINEN_HEIGHT * 0.22)");
    expect(board).toContain('justifyContent: "flex-start"');
    expect(board).not.toContain("SCREEN_HEIGHT * 0.178");
  });
});

describe("Shop price tags", () => {
  const shop = read("app/(tabs)/shop/index.tsx");

  it("hangs price tags on nameplate side edges with inward tilt", () => {
    // Сценарий: Закрепляет положение и встречный наклон ценников около табличек полки.

    expect(shop).toContain("nameplateLeft(digitalCenter0)");
    expect(shop).toContain("nameplateRight(digitalCenter1)");
    expect(shop).toContain("PRICE_TAG_EDGE_OVERLAP");
    expect(shop).toContain("plankBottom - LABEL_HEIGHT * 0.05");
    expect(shop).toContain("LABEL_HEIGHT - TAG_H * 0.72");
    expect(shop).toContain("rotate: `${17 + swing}deg`");
    expect(shop).toContain("rotate: `${-17 + swing}deg`");
    expect(shop).toContain("PRICE_TAG_TOP");
    expect(shop).not.toContain("PRICE_TAG_TOP_0");
  });
});

describe("Videos rose-hip decor", () => {
  const videos = read("app/(tabs)/videos.tsx");

  it("uses compact rose branches fully inside the header", () => {
    // Сценарий: Проверяет компактные размеры и внутреннее положение веток шиповника.

    expect(videos).toContain("ROSE_W");
    expect(videos).toContain("ROSE_INSET");
    expect(videos).toContain("HEADER_MIN_HEIGHT");
    expect(videos).toContain("ROSE_W = 140");
    expect(videos).toContain("ROSE_H = 180");
    expect(videos).toContain("ROSE_TOP = 18");
    expect(videos).toContain("left: ROSE_INSET");
    expect(videos).toContain('contentFit="contain"');
  });

  it("shows readable Russian header copy", () => {
    // Сценарий: Проверяет русские подписи видео и отсутствие повреждённой кодировки.

    expect(videos).toContain("ВИДЕО");
    expect(videos).toContain("мини-фильмы об уютной жизни");
    expect(videos).not.toContain("Р’Р");
    expect(videos).toContain('fontFamily: "EBGaramond-Regular"');
    expect(videos).toContain('fontFamily: "EBGaramond-Regular"');
    expect(videos).not.toContain("EBGaramond-Bold");
  });
});

describe("Library loshadka cover", () => {
  const library = read("app/(tabs)/library.tsx");

  it("crops cover with cover/top fit", () => {
    // Сценарий: Проверяет специальную геометрию обложки бесплатной Лошадки.

    expect(library).toContain('item.id === "loshadka" ? "cover"');
    expect(library).toContain("1176 / 1500");
  });
});

describe("Quiz copy (Darya edits)", () => {
  const quiz = read("lib/quiz-data.ts");

  it("Q1/Q2 without leading «Ты»", () => {
    // Сценарий: Закрепляет согласованный текст начала первых двух вопросов.

    expect(quiz).not.toContain("Ты открываешь глаза");
    expect(quiz).not.toContain("Ты осматриваешься");
    expect(quiz).toContain("Открываешь глаза");
    expect(quiz).toContain("Осматриваешься");
  });

  it("Q8 bridge wording", () => {
    // Сценарий: Закрепляет формулировку расставания в вопросе о мосте.

    expect(quiz).toContain("нужно с чем-то расстаться");
    expect(quiz).not.toContain("нужно что-то отдать");
  });

  it("Q9 fairycore evening in future tense", () => {
    // Сценарий: Закрепляет будущее время ответа fairycore о вечере.

    expect(quiz).toContain("Заберусь на удобную ветку");
    expect(quiz).toContain("буду смотреть на звёзды");
    expect(quiz).not.toContain("Забралась на удобную ветку");
  });
});

describe("Rich text renderer safety", () => {
  const rt = read("components/rich-text-renderer.tsx");

  it("handles missing richText children", () => {
    // Сценарий: Проверяет защиту renderer от отсутствующего массива children.

    expect(rt).toContain("Array.isArray(children)");
  });
});

describe("Boot lock — native parity", () => {
  it("shows boot animation on native and web without blocking taps", () => {
    // Сценарий: Проверяет начальный этап заставки и отсутствие перехвата нажатий.

    const gate = read("components/app-boot-gate.tsx");
    expect(gate).toContain('useState<BootPhase>("playing")');
    expect(gate).toContain('pointerEvents="none"');
    expect(gate).toContain("const showBoot = phase !== \"hidden\"");
  });

  it("uses GestureHandlerRootView on web for stable profile taps", () => {
    // Сценарий: Закрепляет единый gesture root без прежних DOM-patches.

    const layout = read("app/_layout.tsx");
    expect(layout).toContain("GestureHandlerRootView");
    expect(layout).not.toContain("installWebTouchUnblock");
    expect(layout).not.toContain("AppBootGate");
    expect(layout).toContain("contentStyle: { backgroundColor: \"#FDF8F0\", flex: 1 }");
  });

  it("keeps Sep 2 shop routes inside tabs without extra web touch layers", () => {
    // Сценарий: Проверяет вложенные маршруты Магазина без лишних touch-слоёв.

    expect(read("app/(tabs)/shop/_layout.tsx")).toContain("ShopTabLayout");
    expect(read("app/(tabs)/shop/index.tsx")).toContain("ShopScreen");
    expect(read("app/(tabs)/shop/[id].tsx")).toContain("ProductDetailScreen");
    expect(read("app/(tabs)/shop/index.tsx")).toContain('router.push(`/shop/${product.id}`');
    expect(read("app/(tabs)/_layout.tsx")).not.toContain("dd-tab-bar");
    expect(read("app/(tabs)/feed.tsx")).not.toContain("TabFocusGate");
  });

  it("uses minimal web touch unblock without DOM tab patching", () => {
    // Сценарий: Не допускает таймерные DOM-удаления в лёгком исправлении touch.

    const touch = read("lib/web-touch-unblock.ts");
    expect(touch).toContain("export function runWebTouchUnblock");
    expect(touch).toContain("disableAriaHiddenTabScenes");
    expect(touch).not.toContain("setInterval");
    expect(touch).not.toContain("el.remove()");
    expect(read("components/haptic-tab.tsx")).toContain("pressableProps");
    expect(read("app/(tabs)/_layout.tsx")).not.toContain("runWebTouchUnblock");
  });

  it("does not mount AppBootGate on web root layout", () => {
    // Сценарий: Проверяет отсутствие устаревшего boot gate в корневом layout.

    expect(read("app/_layout.tsx")).not.toContain("AppBootGate");
    expect(read("app/_layout.tsx")).not.toContain("installWebTouchUnblock");
  });

  it("plays paper video on native via expo-video", () => {
    // Сценарий: Проверяет native adapter заставки и подписку на статус video.

    const canvas = read("components/boot-lock-canvas.tsx");
    expect(canvas).toContain("useVideoPlayer");
    expect(canvas).toContain("NativeBootLockPaperVideo");
    expect(canvas).toContain("statusChange");
  });
});

describe("Club access — server gates", () => {
  it("requires club membership for club.list and comments", () => {
    // Сценарий: Проверяет наличие серверного guard Клуба в исходниках, не выполняя запросы.

    const trpc = read("apps/backend/src/_core/trpc.ts");
    const routers = read("apps/backend/src/club/router.ts");
    expect(trpc).toContain("clubMemberProcedure");
    expect(routers).toContain("list: clubMemberProcedure");
    expect(routers).toContain("comments: clubMemberProcedure");
  });

  it("filters saved club posts for non-members", () => {
    // Сценарий: Закрепляет серверный фильтр закрытых закладок для обычных аккаунтов.

    const routers = read("apps/backend/src/content/feed-router.ts");
    expect(routers).toContain('post.target !== "club"');
  });
});

describe("Shop email delivery", () => {
  it("skips duplicate delivery emails for the same order", () => {
    // Сценарий: Проверяет наличие защиты от повторного письма одного заказа.

    const delivery = read("apps/backend/src/shop-delivery.ts");
    const db = read("apps/backend/src/platform-db.ts");
    expect(db).toContain("isShopDeliveryEmailSent");
    expect(delivery).toContain("isShopDeliveryEmailSent");
  });
});

describe("Push — EAS wiring", () => {
  it("reads projectId from app config extra.eas", () => {
    // Сценарий: Проверяет конфигурацию Expo push projectId из окружения.

    const config = read("app.config.ts");
    expect(config).toContain("expo-notifications");
    expect(config).toContain("EAS_PROJECT_ID");
  });
});

describe("Articles — photo captions", () => {
  it("keeps caption in createArticle/updateArticle API schema", () => {
    // Сценарий: Закрепляет caption в обеих серверных схемах статьи.

    const routers = read("apps/backend/src/admin/router.ts");
    expect(routers).toMatch(/createArticle:[\s\S]*caption: z\.string\(\)/);
    expect(routers).toMatch(/updateArticle:[\s\S]*caption: z\.string\(\)/);
  });

  it("renders captions in published article view", () => {
    // Сценарий: Проверяет отображение подписи фото опубликованной статьи.

    const content = read("components/article-content.tsx");
    expect(content).toContain("block.caption");
    expect(content).toContain("styles.caption");
  });
});

describe("Rich text — format toolbar (web)", () => {
  it("uses iOS-aware format toolbar props for Ж/К/🔗 buttons", () => {
    // Сценарий: Проверяет сохранение iOS selection при нажатиях toolbar.

    const field = read("components/admin/rich-text-field.tsx");
    expect(field).toContain("formatToolbarProps");
    expect(field).toContain("fmt.syncLiveSelection");
  });

  it("shows link dialog in Modal, not absolute overlay", () => {
    // Сценарий: Закрепляет отдельную Modal для формы ссылки.

    const field = read("components/admin/rich-text-field.tsx");
    expect(field).toContain("<Modal");
    expect(field).toContain("fmt.linkModalVisible ?");
  });

  it("unmounts post editor when closed so overlays cannot leak", () => {
    // Сценарий: Проверяет размонтирование закрытых редакторов вместе с overlay.

    const modal = read("components/admin/create-post-modal.tsx");
    expect(modal).toContain("if (!visible) return null");
    const admin = read("app/admin/index.tsx");
    expect(admin).toContain("if (!showForm) return null");
  });
});

describe("Built web-dist smoke (after build:web)", () => {
  it("includes feed chunk and garden poster URL in bundle", () => {
    // Сценарий: При явном CHECK_WEB_DIST проверяет собранный feed chunk и poster; обычный запуск не требует сборки.

    if (process.env.CHECK_WEB_DIST !== "1") return;

    const webDist = path.join(root, "web-dist", "_expo", "static", "js", "web");
    if (!fs.existsSync(webDist)) {
      throw new Error("web-dist missing — run build:web first");
    }

    const files = fs.readdirSync(webDist).filter((f) => f.endsWith(".js"));
    const feedChunk = files.find((f) => f.startsWith("feed-"));

    expect(feedChunk, "feed chunk missing — run build:web").toBeTruthy();
    if (feedChunk) {
      const feedJs = fs.readFileSync(path.join(webDist, feedChunk), "utf8");
      expect(feedJs.length).toBeGreaterThan(1000);
    }

    const allJs = files.map((f) => fs.readFileSync(path.join(webDist, f), "utf8")).join("\n");
    expect(
      allJs,
      "secret-garden-poster missing from bundle — rebuild web-dist",
    ).toContain("secret-garden-poster");
  });
});
