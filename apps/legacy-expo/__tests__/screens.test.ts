// Архив Expo. Архивные source-text проверки экранов, SQL-модели и старых маршрутов; исторические пути сохранены, текущую приёмку web они не заменяют.
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { FEED_TAGS } from "../apps/frontend/lib/post-tags";

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(REPOSITORY_ROOT, "apps", "frontend");

describe("App Structure", () => {
  it("should have all required screen files", () => {
    // Сценарий: Проверяет наличие набора архивных экранов по историческим путям.

    const screens = [
      "app/(tabs)/index.tsx",
      "app/(tabs)/feed.tsx",
      "app/(tabs)/library.tsx",
      "app/(tabs)/shop/index.tsx",
      "app/(tabs)/club.tsx",
      "app/(tabs)/profile.tsx",
      "app/(tabs)/interactive.tsx",
      "app/(tabs)/_layout.tsx",
    ];

    screens.forEach((screen) => {
      const filePath = path.join(APP_DIR, screen);
      expect(fs.existsSync(filePath), `Missing: ${screen}`).toBe(true);
    });
  });

  it("should have custom brand colors in theme.config.js", () => {
    // Сценарий: Сверяет согласованные значения цветовых токенов темы.

    const themePath = path.join(APP_DIR, "theme.config.js");
    const content = fs.readFileSync(themePath, "utf-8");

    expect(content).toContain("#8B7355"); // primary light (brown)
    expect(content).toContain("#FDF8F0"); // background light
    expect(content).toContain("#EEE9E0"); // surface light
    expect(content).toContain("#2D3A2E"); // foreground light
  });

  it("should have app branding configured in app.config.ts", () => {
    // Сценарий: Проверяет имя и slug бренда в Expo-конфигурации.

    const configPath = path.join(APP_DIR, "app.config.ts");
    const content = fs.readFileSync(configPath, "utf-8");

    expect(content).toContain("DARYADARCY");
    expect(content).toContain("daryadarcy_app");
  });

  it("should have icon mappings for all tab icons", () => {
    // Сценарий: Проверяет таблицу иконок вкладок для web/Android.

    const iconPath = path.join(APP_DIR, "components/ui/icon-symbol.tsx");
    const content = fs.readFileSync(iconPath, "utf-8");

    expect(content).toContain('"house.fill"');
    expect(content).toContain('"book.fill"');
    expect(content).toContain('"star.fill"');
    expect(content).toContain('"newspaper.fill"');
    expect(content).toContain('"sparkles"');
  });
});

describe("Home Screen (index.tsx)", () => {
  const content = fs.readFileSync(path.join(APP_DIR, "app/(tabs)/index.tsx"), "utf-8");

  it("should have hero section", () => {
    // Сценарий: Проверяет первый экран и название бренда.

    expect(content).toContain("heroContainer");
    expect(content).toContain("DARYADARCY");
  });

  it("should have about section", () => {
    // Сценарий: Проверяет блок об авторе и имя Дарьи.

    expect(content).toContain("ОБ АВТОРЕ");
    expect(content).toContain("Дарья");
  });

  it("should have section banners", () => {
    // Сценарий: Проверяет переходы по основным разделам на главной.

    expect(content).toContain("SECTION_BANNERS");
    expect(content).toContain("Лента");
    expect(content).toContain("Клуб Darcy");
    expect(content).toContain("Библиотека");
    expect(content).toContain("Магазин");
    expect(content).toContain("Интерактив");
  });

  it("should have 'новое' badge for sections with fresh content", () => {
    // Сценарий: Проверяет метку свежих публикаций у разделов.

    expect(content).toContain("hasNew");
    expect(content).toContain("newBadge");
    expect(content).toContain("newBadgeText");
    expect(content).toContain("НОВОЕ");
  });

  it("should have secret garden section", () => {
    // Сценарий: Проверяет подключение секции таинственного сада.

    expect(content).toContain("GardenTourSection");
  });

  it("should have season indicator", () => {
    // Сценарий: Проверяет наличие определения сезона главной.

    expect(content).toContain("getCurrentSeason");
  });

  it("should have crossfade slideshow hero with seasonal switching", () => {
    // Сценарий: Закрепляет сезонные hero-слайды с двумя фазами crossfade.

    expect(content).toContain("slideshowHeroContainer");
    expect(content).toContain("heroImages");
    expect(content).toContain("CROSSFADE_DURATION");
    expect(content).toContain("DARYADARCY");
    expect(content).toContain("slideshowTitle");
    expect(content).toContain("currentSlide");
    expect(content).toContain("nextSlide");
    expect(content).toContain("Spring");
    expect(content).toContain("Summer");
    expect(content).toContain("Autumn");
    expect(content).toContain("Winter");
  });

  it("should have animated entrance", () => {
    // Сценарий: Проверяет используемые primitive появления Reanimated.

    expect(content).toContain("useSharedValue");
    expect(content).toContain("useAnimatedStyle");
    expect(content).toContain("FadeIn");
  });

  it("should have parallax scroll effect", () => {
    // Сценарий: Проверяет scroll-driven параллакс с ограничением интерполяции.

    expect(content).toContain("useAnimatedScrollHandler");
    expect(content).toContain("scrollHandler");
    expect(content).toContain("scrollEventThrottle");
    expect(content).toContain("interpolate");
    expect(content).toContain("Extrapolation.CLAMP");
  });

  it("should have parallax styles for hero, welcome, about, book, stamps, and explore", () => {
    // Сценарий: Проверяет раздельные параллакс-слои главной страницы.

    expect(content).toContain("heroParallaxStyle");
    expect(content).toContain("welcomeParallaxStyle");
    expect(content).toContain("aboutParallaxStyle");
    expect(content).toContain("bookParallaxStyle");
    expect(content).toContain("stampParallaxStyle");
    expect(content).toContain("exploreParallaxStyle");
  });

  it("should have enlarged cottage illustration", () => {
    // Сценарий: Закрепляет увеличенный декоративный домик.

    expect(content).toContain('width: "110%"');
    expect(content).toContain("cottageIllustration");
  });

  it("should have scroll-driven medallion glint effect with oval-clipped gradient", () => {
    // Сценарий: Проверяет блик медальона внутри овальной маски градиента.

    expect(content).toContain("medallionGlintStyle");
    expect(content).toContain("glintOpacity");
    expect(content).toContain("glintTranslate");
    expect(content).toContain("glintOvalLeft");
    expect(content).toContain("glintOvalRight");
    expect(content).toContain("glintStripe");
    expect(content).toContain("LinearGradient");
  });
});

describe("Feed Screen (feed.tsx)", () => {
  const content = fs.readFileSync(path.join(APP_DIR, "app/(tabs)/feed.tsx"), "utf-8");

  it("should have two view modes", () => {
    // Сценарий: Проверяет наличие ленты и сетки как двух режимов выдачи.

    expect(content).toContain("ViewMode");
    expect(content).toContain('"feed"');
    expect(content).toContain('"grid"');
  });

  it("should have view mode toggle", () => {
    // Сценарий: Проверяет кнопки переключения ленты и сетки.

    expect(content).toContain("toggleButton");
    expect(content).toContain("view-agenda");
    expect(content).toContain("grid-view");
  });

  it("should have tag-based filters", () => {
    // Сценарий: Проверяет состояние и список фильтров тегов.

    expect(content).toContain("TAGS");
    expect(content).toContain("TagSlug");
    expect(content).toContain("selectedTag");
  });

  it("should have seasonal banner", () => {
    // Сценарий: Проверяет выбор сезонного баннера Ленты.

    expect(content).toContain("getCurrentSeason");
    expect(content).toContain("bannerImage");
  });

  it("should have mock posts data", () => {
    // Сценарий: Историческая проверка фикстурных постов; это не доказательство живой загрузки API.

    expect(content).toContain("MOCK_POSTS");
    expect(content).toContain("FeedPost");
  });

  it("should have Telegram-style photo grid", () => {
    // Сценарий: Проверяет общий компонент раскладки Telegram-фото.

    expect(content).toContain("NaturalPhotoStack");
    expect(content).toContain("photos");
  });

  it("should have expand/collapse text", () => {
    // Сценарий: Проверяет раскрытие и сворачивание длинного текста.

    expect(content).toContain("Читать дальше");
    expect(content).toContain("expanded");
  });

  it("should have like and save actions", () => {
    // Сценарий: Проверяет наличие обработчиков и значков лайка/сохранения.

    expect(content).toContain("favorite");
    expect(content).toContain("work-outline");
    expect(content).toContain("handleLike");
    expect(content).toContain("handleSave");
  });

  it("should have grid rendering", () => {
    // Сценарий: Проверяет render сетки и число колонок.

    expect(content).toContain("renderGridItem");
    expect(content).toContain("numColumns");
  });
});

describe("Tab Layout (_layout.tsx)", () => {
  const content = fs.readFileSync(path.join(APP_DIR, "app/(tabs)/_layout.tsx"), "utf-8");

  it("should have 5 visible tabs (Home hidden from tab bar)", () => {
    // Сценарий: Исторически проверяет названия основных вкладок и скрытую главную.

    expect(content).toContain("Лента");
    expect(content).toContain("Клуб");
    expect(content).toContain("Интерактив");
    expect(content).toContain("Библиотека");
    expect(content).toContain("Магазин");
  });

  it("should have Home icon in header (top-left)", () => {
    // Сценарий: Проверяет кнопку домашней страницы в header.

    expect(content).toContain("HomeHeaderButton");
  });

  it("should hide profile from tab bar", () => {
    // Сценарий: Проверяет скрытый маршрут профиля в tab bar.

    expect(content).toContain("href: null");
  });

  it("should have profile accessible from header", () => {
    // Сценарий: Проверяет верхнюю кнопку доступа к профилю.

    expect(content).toContain("ProfileHeaderButton");
    expect(content).toContain("person-outline");
  });
});

describe("Shop Screen (shop.tsx)", () => {
  const content = fs.readFileSync(path.join(APP_DIR, "app/(tabs)/shop/index.tsx"), "utf-8");

  it("should have real book data with Wildberries links", () => {
    // Сценарий: Сверяет исторические данные книг и внешние магазинные ссылки.

    expect(content).toContain("PRODUCTS");
    expect(content).toContain("Wildberries");
    expect(content).toContain("Тропинка к Творчеству");
    expect(content).toContain("Книга Вдохновения");
    expect(content).toContain("Романтика Дачи");
    expect(content).toContain("wildberries.ru/catalog");
  });
});

describe("Playfair Display Font", () => {
  it("should have font files in assets/fonts", () => {
    // Сценарий: Проверяет локальное наличие гарнитуры Playfair.

    const fontFiles = [
      "assets/fonts/PlayfairDisplay-Regular.ttf",
      "assets/fonts/PlayfairDisplay-Italic.ttf",
    ];
    fontFiles.forEach((font) => {
      const fontPath = path.join(APP_DIR, font);
      expect(fs.existsSync(fontPath), `Missing font: ${font}`).toBe(true);
    });
  });

  it("should load fonts in root layout", () => {
    // Сценарий: Проверяет регистрацию шрифтов в корневом Expo layout.

    const layoutContent = fs.readFileSync(path.join(APP_DIR, "app/_layout.tsx"), "utf-8");
    expect(layoutContent).toContain("PlayfairDisplay-Regular");
    expect(layoutContent).toContain("PlayfairDisplay-Italic");
    expect(layoutContent).toContain("useFonts");
  });

  it("should use Playfair Display or EBGaramond in screen headings", () => {
    // Сценарий: Проверяет брендовые гарнитуры основных архивных экранов.

    const screens = [
      "app/(tabs)/library.tsx",
      "app/(tabs)/club.tsx",
      "app/(tabs)/interactive.tsx",
      "app/(tabs)/profile.tsx",
    ];
    screens.forEach((screen) => {
      const content = fs.readFileSync(path.join(APP_DIR, screen), "utf-8");
      expect(content, `${screen} should use PlayfairDisplay or EBGaramond`).toMatch(/fontFamily:\s*["'](?:PlayfairDisplay|EBGaramond)-/);
    });
    // Shop uses EBGaramond
    const shopContent = fs.readFileSync(path.join(APP_DIR, "app/(tabs)/shop/index.tsx"), "utf-8");
    expect(shopContent, "shop.tsx should use EBGaramond").toContain("EBGaramond");
    // Home and Feed use EBGaramond
    const indexContent = fs.readFileSync(path.join(APP_DIR, "app/(tabs)/index.tsx"), "utf-8");
    expect(indexContent, "index.tsx should use EBGaramond").toContain("EBGaramond");
    const feedContent = fs.readFileSync(path.join(APP_DIR, "app/(tabs)/feed.tsx"), "utf-8");
    expect(feedContent, "feed.tsx should use EBGaramond").toContain("EBGaramond");
  });
});

describe("Real Photos (no Unsplash placeholders)", () => {
  const screenFiles = [
    "app/(tabs)/index.tsx",
    "app/(tabs)/feed.tsx",
    "app/(tabs)/library.tsx",
    "app/(tabs)/shop/index.tsx",
    "app/(tabs)/club.tsx",
    "app/(tabs)/interactive.tsx",
    "app/(tabs)/profile.tsx",
  ];

  screenFiles.forEach((file) => {
    it(`${file} should not contain Unsplash URLs`, () => {
    // Сценарий: Для каждого экрана запрещает случайные Unsplash-заглушки.

      const content = fs.readFileSync(path.join(APP_DIR, file), "utf-8");
      expect(content).not.toContain("unsplash.com");
    });

    it(`${file} should use real image sources`, () => {
    // Сценарий: Для каждого экрана проверяет наличие настоящего источника изображения.

      const content = fs.readFileSync(path.join(APP_DIR, file), "utf-8");
      const hasYouTube = content.includes("i.ytimg.com");
      const hasS3 = content.includes("s3.twcstorage.ru");
      expect(hasYouTube || hasS3).toBe(true);
    });
  });
});

describe("Feed Section", () => {
  const feedPath = path.join(APP_DIR, "app/(tabs)/feed.tsx");
  const feedContent = fs.readFileSync(feedPath, "utf-8");

  it("should have seasonal banner component", () => {
    // Сценарий: Проверяет сезонную шапку Ленты.

    expect(feedContent).toContain("bannerContainer");
    expect(feedContent).toContain("getCurrentSeason");
  });

  it("should have tag chips with all required tags", () => {
    // Сценарий: Сверяет обязательные slug и общий источник тегов Ленты.

    expect(feedContent).toContain('from "@/lib/post-tags"');
    expect(feedContent).toContain("...FEED_TAGS");
    expect(FEED_TAGS.map((tag) => tag.slug)).toEqual(expect.arrayContaining([
      "spring", "summer", "autumn", "winter", "home", "garden", "recipes", "personal",
    ]));
  });

  it("should have list and grid view modes", () => {
    // Сценарий: Проверяет согласованность режима списка и сетки.

    expect(feedContent).toContain('"feed"');
    expect(feedContent).toContain('"grid"');
    expect(feedContent).toContain("viewMode");
    expect(feedContent).toContain("renderGridItem");
  });

  it("should have Telegram-style photo layout component", () => {
    // Сценарий: Проверяет подключение общей фотораскладки.

    expect(feedContent).toContain("NaturalPhotoStack");
  });

  it("should have expand/collapse text functionality", () => {
    // Сценарий: Сверяет русские действия раскрытия/сворачивания текста.

    expect(feedContent).toContain("читать →");
    expect(feedContent).toContain("свернуть");
    expect(feedContent).toContain("expanded");
  });

  it("should have like and save buttons", () => {
    // Сценарий: Проверяет кнопки лайка и сохранения в карточке.

    expect(feedContent).toContain("handleLike");
    expect(feedContent).toContain("handleSave");
    expect(feedContent).toContain("favorite");
    expect(feedContent).toContain("work-outline");
  });

  it("should use tRPC to fetch posts from database", () => {
    // Сценарий: Проверяет декларации постраничного tRPC чтения вместо фикстур.

    expect(feedContent).toContain("trpc.feed.listPaginated.useInfiniteQuery");
    expect(feedContent).toContain("trpc.feed.tags.useQuery");
  });

  it("should have pull-to-refresh", () => {
    // Сценарий: Проверяет обработчик жеста обновления.

    expect(feedContent).toContain("RefreshControl");
    expect(feedContent).toContain("onRefresh");
  });
});

describe("Admin Panel", () => {
  it("should have admin screen file", () => {
    // Сценарий: Проверяет наличие архивной страницы администратора.

    const adminPath = path.join(APP_DIR, "app/admin/index.tsx");
    expect(fs.existsSync(adminPath)).toBe(true);
  });

  it("should have admin screen with CRUD operations", () => {
    // Сценарий: Проверяет объявления админских create/read/update/delete мутаций.

    const adminPath = path.join(APP_DIR, "app/admin/index.tsx");
    const adminContent = fs.readFileSync(adminPath, "utf-8");

    expect(adminContent).toContain("trpc.admin.posts.useQuery");
    expect(adminContent).toContain("trpc.admin.createPost.useMutation");
    expect(adminContent).toContain("trpc.admin.updatePost.useMutation");
    expect(adminContent).toContain("trpc.admin.deletePost.useMutation");
  });

  it("should have post form with text, photos, and tags", () => {
    // Сценарий: Проверяет поля архивного редактора поста.

    const adminPath = path.join(APP_DIR, "app/admin/index.tsx");
    const adminContent = fs.readFileSync(adminPath, "utf-8");

    expect(adminContent).toContain("Текст поста");
    expect(adminContent).toContain("Фотографии");
    expect(adminContent).toContain("Метки");
    expect(adminContent).toContain("RichTextField");
  });

  it("feed screen should import React hooks", () => {
    // Сценарий: Проверяет корректный import React hooks в Ленте.

    const feedPath = path.join(APP_DIR, "app/(tabs)/feed.tsx");
    const feedContent = fs.readFileSync(feedPath, "utf-8");
    expect(feedContent).toMatch(/import\s*\{[^}]*useState[^}]*\}\s*from\s*"react"/);
  });

  it("should be accessible from profile screen", () => {
    // Сценарий: Проверяет переход в админку из профиля.

    const profilePath = path.join(APP_DIR, "app/(tabs)/profile.tsx");
    const profileContent = fs.readFileSync(profilePath, "utf-8");

    expect(profileContent).toContain("/admin");
  });
});

describe("Database Schema", () => {
  const schemaPath = path.join(REPOSITORY_ROOT, "packages/database/src/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  it("should have posts table", () => {
    // Сценарий: Проверяет декларацию posts и основных полей схемы без SQL.

    expect(schemaContent).toContain('mysqlTable("posts"');
    expect(schemaContent).toContain("photos");
    expect(schemaContent).toContain("tags");
    expect(schemaContent).toContain("published");
  });

  it("should have tags table", () => {
    // Сценарий: Проверяет декларацию tags со slug/category.

    expect(schemaContent).toContain('mysqlTable("tags"');
    expect(schemaContent).toContain("slug");
    expect(schemaContent).toContain("category");
  });

  it("should have likes table", () => {
    // Сценарий: Проверяет декларацию связи likes userId/postId.

    expect(schemaContent).toContain('mysqlTable("likes"');
    expect(schemaContent).toContain("userId");
    expect(schemaContent).toContain("postId");
  });

  it("should have saved_posts table", () => {
    // Сценарий: Проверяет декларацию таблицы сохранённых постов.

    expect(schemaContent).toContain('mysqlTable("saved_posts"');
  });
});

describe("Feed API Routes", () => {
  const routerPath = path.join(REPOSITORY_ROOT, "apps/backend/src/routers.ts");
  const routerContent = fs.readFileSync(routerPath, "utf-8");
  const feedContent = fs.readFileSync(path.join(REPOSITORY_ROOT, "apps/backend/src/content/feed-router.ts"), "utf-8");
  const adminContent = fs.readFileSync(path.join(REPOSITORY_ROOT, "apps/backend/src/admin/router.ts"), "utf-8");

  it("should have feed router with list and tags endpoints", () => {
    // Сценарий: Проверяет подключение feed router и публичные read-процедуры.

    expect(routerContent).toContain("feed: feedRouter");
    expect(feedContent).toContain("list: publicProcedure");
    expect(feedContent).toContain("tags: publicProcedure");
  });

  it("should have protected like/save endpoints", () => {
    // Сценарий: Проверяет требование сессии для изменений лайков/закладок.

    expect(feedContent).toContain("toggleLike: protectedProcedure");
    expect(feedContent).toContain("toggleSave: protectedProcedure");
  });

  it("should have admin router with CRUD endpoints", () => {
    // Сценарий: Проверяет adminProcedure для записи постов.

    expect(routerContent).toContain("admin: adminRouter");
    expect(adminContent).toContain("createPost: adminProcedure");
    expect(adminContent).toContain("updatePost: adminProcedure");
    expect(adminContent).toContain("deletePost: adminProcedure");
  });
});

describe("Feed Search", () => {
  const feedPath = path.join(APP_DIR, "app/(tabs)/feed.tsx");
  const feedContent = fs.readFileSync(feedPath, "utf-8");

  it("should have search bar with TextInput", () => {
    // Сценарий: Проверяет строку поиска и её локальное состояние.

    expect(feedContent).toContain("TextInput");
    expect(feedContent).toContain("searchQuery");
    expect(feedContent).toContain("searchContainer");
  });

  it("should have debounced search (300ms)", () => {
    // Сценарий: Закрепляет задержку поискового запроса на 300 мс.

    expect(feedContent).toContain("debouncedSearch");
    expect(feedContent).toContain("setTimeout");
    expect(feedContent).toContain("300");
  });

  it("should pass search param to API query", () => {
    // Сценарий: Проверяет передачу debounce-результата серверному запросу.

    expect(feedContent).toContain("search: debouncedSearch");
  });

  it("should have clear search button", () => {
    // Сценарий: Проверяет явную очистку поиска.

    expect(feedContent).toContain('setSearchQuery("")');
    expect(feedContent).toContain('"close"');
  });

  it("should have search placeholder text in Russian", () => {
    // Сценарий: Проверяет русскую подсказку поиска.

    expect(feedContent).toContain("Поиск");
  });
});

describe("Feed Search - Server Side", () => {
  const routerPath = path.join(REPOSITORY_ROOT, "apps/backend/src/content/feed-router.ts");
  const routerContent = fs.readFileSync(routerPath, "utf-8");
  const dbPath = path.join(REPOSITORY_ROOT, "apps/backend/src/db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");

  it("should accept search parameter in listPaginated endpoint", () => {
    // Сценарий: Проверяет search в исторической схеме входа списка.

    expect(routerContent).toContain("search: z.string().optional()");
  });

  it("should have search filtering in db helper", () => {
    // Сценарий: Исторически проверяет наличие поиска в фасаде БД по исходному тексту.

    expect(dbContent).toContain("search");
    expect(dbContent).toContain("toLowerCase");
  });
});

describe("Push Notifications", () => {
  const layoutPath = path.join(APP_DIR, "app/_layout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  const routerPath = path.join(REPOSITORY_ROOT, "apps/backend/src/routers.ts");
  const routerContent = fs.readFileSync(routerPath, "utf-8");
  const notificationsContent = fs.readFileSync(path.join(REPOSITORY_ROOT, "apps/backend/src/notifications/router.ts"), "utf-8");
  const schemaPath = path.join(REPOSITORY_ROOT, "packages/database/src/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const dbPath = path.join(REPOSITORY_ROOT, "apps/backend/src/db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");

  it("should have push_tokens table in schema", () => {
    // Сценарий: Проверяет поля токена и enabled в SQL-модели без выполнения SQL.

    expect(schemaContent).toContain('mysqlTable("push_tokens"');
    expect(schemaContent).toContain("token");
    expect(schemaContent).toContain("enabled");
  });

  it("should have push token registration in db helpers", () => {
    // Сценарий: Проверяет объявленные фасады регистрации и согласия push.

    expect(dbContent).toContain("registerPushToken");
    expect(dbContent).toContain("getMarketingPushTokens");
    expect(dbContent).toContain("logPushConsentEvent");
  });

  it("should have marketing push consent endpoints", () => {
    // Сценарий: Проверяет процедуры согласия и таблицу истории согласий.

    expect(notificationsContent).toContain("marketingConsent");
    expect(notificationsContent).toContain("setMarketingConsent");
    expect(schemaContent).toContain('mysqlTable("push_consent_events"');
  });

  it("should send marketing notifications when post is published", () => {
    // Сценарий: Проверяет объявленный канал отправки push после публикации, не отправляя уведомления.

    const adminContent = fs.readFileSync(path.join(REPOSITORY_ROOT, "apps/backend/src/admin/router.ts"), "utf-8");
    expect(adminContent).toContain("sendNewPostNotification");
    const pushModule = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "apps/backend/src/push.ts"),
      "utf-8",
    );
    expect(pushModule).toContain("getMarketingPushTokens");
    expect(pushModule).toContain("exp.host/--/api/v2/push/send");
  });

  it("should have notifications router with registerToken endpoint", () => {
    // Сценарий: Проверяет регистрацию notifications router.

    expect(routerContent).toContain("notifications: notificationsRouter");
    expect(notificationsContent).toContain("registerToken");
  });

  it("should initialize notifications in root layout (native only)", () => {
    // Сценарий: Проверяет native bootstrap push и получение Expo-токена.

    const pushContent = fs.readFileSync(path.join(APP_DIR, "lib/register-push.ts"), "utf-8");
    expect(layoutContent).toContain("registerNativePush");
    expect(pushContent).toContain("expo-notifications");
    expect(pushContent).toContain("registerPush");
    expect(pushContent).toContain("getExpoPushTokenAsync");
  });

  it("should handle notification tap to navigate to post", () => {
    // Сценарий: Проверяет обработчик открытия поста из push.

    const pushContent = fs.readFileSync(path.join(APP_DIR, "lib/register-push.ts"), "utf-8");
    expect(pushContent).toContain("addNotificationResponseReceivedListener");
    expect(pushContent).toContain("postId");
    expect(pushContent).toContain("router.push(`/post/");
  });

  it("should request notification permissions", () => {
    // Сценарий: Проверяет запрос и чтение разрешений native push.

    const pushContent = fs.readFileSync(path.join(APP_DIR, "lib/register-push.ts"), "utf-8");
    expect(pushContent).toContain("requestPermissionsAsync");
    expect(pushContent).toContain("getPermissionsAsync");
  });
});
