/** Исторический слабый smoke старой структуры YouTube: все вызываемые DB-функции здесь замоканы, это не приёмка настоящего Videos API. */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../apps/backend/src/db", () => ({
  getVideos: vi.fn(),
  getVideoById: vi.fn(),
  bulkImportVideos: vi.fn(),
}));

import * as db from "../apps/backend/src/db";

/** Сценарии проверяют заранее заданные mock-ответы; не доказывают SQL, права или доступность проигрывания. */
describe("Videos API", () => {
  /** Сбрасываем вызовы mock DB между сценариями. */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Совместимая старая форма списка, не действующий VK-каталог. */
  describe("getVideos", () => {
    /** Проверяем чтение полей из двух заранее заданных mock-строк. */
    it("should return an array of videos", async () => {
      const mockVideos = [
        {
          id: 1,
          youtubeId: "sq7pY1H_fYU",
          title: "Creative Spring Vlog",
          duration: "15:27",
          thumbnailUrl: "https://i.ytimg.com/vi/sq7pY1H_fYU/maxresdefault.jpg",
          videoUrl: null,
          views: "40K views",
          publishedText: "2 months ago",
          sortOrder: 0,
          published: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          youtubeId: "_RZRJgVSD8Y",
          title: "Организация кухонной кладовки",
          duration: "30:45",
          thumbnailUrl: "https://i.ytimg.com/vi/_RZRJgVSD8Y/maxresdefault.jpg",
          videoUrl: null,
          views: "75K views",
          publishedText: "3 months ago",
          sortOrder: 1,
          published: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (db.getVideos as any).mockResolvedValue(mockVideos);

      const result = await db.getVideos();
      expect(result).toHaveLength(2);
      expect(result[0].youtubeId).toBe("sq7pY1H_fYU");
      expect(result[0].title).toBe("Creative Spring Vlog");
      expect(result[1].duration).toBe("30:45");
    });

    /** Фиксируем пустой mock-ответ без взаимодействия с БД. */
    it("should return empty array when no videos", async () => {
      (db.getVideos as any).mockResolvedValue([]);
      const result = await db.getVideos();
      expect(result).toEqual([]);
    });
  });

  /** Историческая numeric detail-форма. */
  describe("getVideoById", () => {
    /** Возвращаем заранее заданную строку через mock facade. */
    it("should return a single video by ID", async () => {
      const mockVideo = {
        id: 1,
        youtubeId: "sq7pY1H_fYU",
        title: "Creative Spring Vlog",
        duration: "15:27",
        thumbnailUrl: "https://i.ytimg.com/vi/sq7pY1H_fYU/maxresdefault.jpg",
        videoUrl: null,
        views: "40K views",
        publishedText: "2 months ago",
        sortOrder: 0,
        published: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.getVideoById as any).mockResolvedValue(mockVideo);

      const result = await db.getVideoById(1);
      expect(result).toBeDefined();
      expect(result!.id).toBe(1);
      expect(result!.youtubeId).toBe("sq7pY1H_fYU");
    });

    /** Отсутствие здесь целиком определяется mockResolvedValue(undefined). */
    it("should return undefined for non-existent video", async () => {
      (db.getVideoById as any).mockResolvedValue(undefined);
      const result = await db.getVideoById(999);
      expect(result).toBeUndefined();
    });
  });

  /** Старый bulk import interface проверяется только на уровне подменённого вызова. */
  describe("bulkImportVideos", () => {
    /** Число 5 задаётся mock, не вычисляется из двух inputs; это не доказательство импорта. */
    it("should import videos and return count", async () => {
      (db.bulkImportVideos as any).mockResolvedValue(5);

      const items = [
        { youtubeId: "test1", title: "Video 1", duration: "10:00", thumbnailUrl: null, videoUrl: null, views: null, publishedText: null, sortOrder: 0, published: true },
        { youtubeId: "test2", title: "Video 2", duration: "20:00", thumbnailUrl: null, videoUrl: null, views: null, publishedText: null, sortOrder: 1, published: true },
      ];

      const result = await db.bulkImportVideos(items, { id: 1, sessionVersion: 0 });
      expect(result).toBe(5);
    });
  });
});

/** Локальные строковые примеры старых данных не подтверждают текущий provider. */
describe("Video data structure", () => {
  /** Проверяется буквальный шаблон старой YouTube-ссылки, без запроса картинки. */
  it("should have correct YouTube thumbnail URL format", () => {
    const youtubeId = "sq7pY1H_fYU";
    const expectedUrl = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;
    expect(expectedUrl).toBe("https://i.ytimg.com/vi/sq7pY1H_fYU/maxresdefault.jpg");
  });

  /** Примеры длительности лишь соответствуют regex, форматтер production не вызывается. */
  it("should format duration correctly", () => {
    const durations = ["15:27", "30:45", "1:02:33"];
    durations.forEach((d) => {
      expect(d).toMatch(/^\d{1,2}:\d{2}(:\d{2})?$/);
    });
  });
});
