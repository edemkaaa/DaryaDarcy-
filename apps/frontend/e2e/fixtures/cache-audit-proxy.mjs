import http from "node:http";
import { readFileSync } from "node:fs";

// Local synthetic API + transparent Next proxy. No browser request routing:
// Chromium's real memory/disk cache stays enabled during the route audit.
const origin = "http://127.0.0.1:19092";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#d8c7ac"/></svg>';
const video = readFileSync(new URL("./carousel-video.webm", import.meta.url));
const post = (id = 501, target = "feed", tag = "") => ({
  id,
  text: "Публикация аудита",
  photos: [`${origin}/media/cache-audit/post-${id}.svg`],
  tags: tag ? [tag] : [],
  richText: null,
  media: [],
  target,
  source: "",
  published: true,
  status: "published",
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-01T12:00:00Z",
  publishedAt: "2026-10-01T12:00:00Z",
  scheduledAt: null,
});
const article = {
  id: 701,
  title: "Статья аудита",
  coverUrl: `${origin}/media/cache-audit/article.svg`,
  access: "public",
  published: true,
  locked: false,
  sections: [{ type: "text", text: "Текст статьи аудита" }],
};
const videoCard = {
  id: 801,
  youtubeId: "dQw4w9WgXcQ",
  title: "Видео аудита",
  thumbnailUrl: `${origin}/media/cache-audit/video.svg`,
  videoUrl: `${origin}/media/cache-audit/video.webm`,
  duration: "00:01",
  published: true,
  provider: "youtube",
  access: "public",
};
const fields = (keys) => Object.fromEntries(keys.map((key) => [key, ""]));
const guide = (key) => ({
  key,
  style: {
    ...fields([
      "contrast",
      "details",
      "accessories",
      "shoes",
      "fabrics",
      "colors",
      "bonus",
      "principle",
      "mixing",
    ]),
    intro: `Приватный текст ${key}`,
    table: { romantic: [], workwear: [] },
  },
  space: fields([
    "intro",
    "finishing",
    "wallpaperBrands",
    "ceilings",
    "importantNote",
    "palette",
    "lifehack",
    "furniture",
    "furnitureWhere",
    "furnitureAvoid",
    "textile",
    "textileFormula",
    "details",
    "lighting",
  ]),
  rituals: { items: [] },
  blog: { intro: "", strength: "", rubrics: [], tips: [] },
  inspiration: {
    films: [],
    series: [],
    books: [],
    music: [],
    blogs: { instagram: [], youtube: [] },
    magazines: [],
  },
});
const capabilities = {
  smsLogin: false,
  penPals: false,
  shopOnlinePayment: false,
  webPush: false,
  privateContentUploads: false,
  privatePostMediaUploads: false,
  privatePostVideoUploads: false,
};
const config = {
  revision: 1,
  season: "autumn",
  appearance: { startsOn: "09-01", backgroundUrl: null, bannerUrl: null },
  managerEmail: "manager@example.test",
  orderMethod: "email-client",
  capabilities,
};
const stats = {
  totalPosts: 1,
  publishedPosts: 1,
  scheduledPosts: 0,
  draftPosts: 0,
  feedPosts: 1,
  clubPosts: 0,
  bothPosts: 0,
  totalLikes: 0,
  totalSaves: 0,
  postsThisMonth: 1,
  postsLastMonth: 0,
  topLikedPosts: [],
};
function answer(name, input, role) {
  switch (name) {
    case "club.subscription":
      return {
        hasClubAccess: role !== "guest",
        subscribed: role !== "guest",
        expiresAt: "2040-11-01T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancellationStatus: "none",
        isOwner: role === "admin",
        monthlyPrice: "790",
      };
    case "club.claimPending":
      return { granted: false, orderId: null };
    case "feed.listPaginated":
      return { posts: [post()], nextCursor: null };
    case "club.list":
      return {
        posts: ["podborki", "community", "exclusive", "life"].map((tag, i) =>
          post(511 + i, "club", tag),
        ),
        nextCursor: null,
      };
    case "feed.getById":
      return input.id === 501 ? post() : null;
    case "feed.tags":
      return [{ slug: "books", label: "Книги" }];
    case "feed.userInteractions":
      return { likedIds: [], savedIds: [501] };
    case "feed.savedPosts":
      return [post()];
    case "articles.list":
    case "admin.articles":
      return [article];
    case "articles.getById":
      return input.id === 701 ? article : null;
    case "videos.list":
      return [videoCard];
    case "videos.getById":
      return input.id === 801 ? videoCard : null;
    case "videos.catalog":
      return {
        items: [
          {
            id: videoCard.id,
            title: videoCard.title,
            duration: videoCard.duration,
            access: videoCard.access,
            canWatch: true,
            thumbnailUrl: videoCard.thumbnailUrl,
          },
        ],
        nextCursor: null,
      };
    case "videos.playback":
      return {
        id: 801,
        provider: "youtube",
        youtubeId: videoCard.youtubeId,
        videoUrl: videoCard.videoUrl,
      };
    case "admin.postsPage":
      return { posts: [post()], nextCursor: null };
    case "admin.postDetail":
      return post();
    case "admin.postCounts":
      return { total: 1, published: 1, scheduled: 0, draft: 0 };
    case "admin.postCalendar":
      return { days: [], upcoming: [] };
    case "admin.stats":
      return stats;
    case "shop.owned":
      return { owned: false };
    case "notifications.latest":
      return { feedId: 501, feedText: "", clubId: null, clubText: "" };
    default:
      return [];
  }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  const role =
    /(?:^|; )cache_audit_role=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ??
    "guest";
  const json = (data, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/api/auth/me")
    return json({
      user:
        role === "guest"
          ? null
          : {
              id: 101,
              openId: "cache-audit",
              role: role === "member" ? "user" : role,
              name: "Участница",
              gender: "female",
              email: "audit@example.test",
              avatarUrl: `${origin}/media/cache-audit/avatar.svg`,
              lastSignedIn: "2026-10-01T12:00:00Z",
            },
    });
  if (url.pathname === "/api/launch-config") return json(config);
  if (url.pathname === "/api/capabilities") return json(capabilities);
  if (url.pathname === "/api/admin/launch-config")
    return json({
      ...config,
      seasonMode: "calendar",
      forcedSeason: "autumn",
      seasons: Object.fromEntries(
        ["winter", "spring", "summer", "autumn"].map((key) => [
          key,
          {
            startsOn: {
              winter: "12-01",
              spring: "03-01",
              summer: "06-01",
              autumn: "09-01",
            }[key],
            backgroundUrl: null,
            bannerUrl: null,
          },
        ]),
      ),
    });
  if (url.pathname.startsWith("/api/trpc/")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    const inputs = JSON.parse(body || url.searchParams.get("input") || "{}");
    const results = decodeURIComponent(url.pathname.slice("/api/trpc/".length))
      .split(",")
      .map((name, index) => {
        const input = inputs[index]?.json ?? {};
        if (name === "videos.playback" && input.id !== videoCard.id)
          return {
            error: {
              json: {
                message: "Видео не найдено",
                code: -32004,
                data: { code: "NOT_FOUND", httpStatus: 404, path: name },
              },
            },
          };
        return {
          result: { data: { json: answer(name, input, role) } },
        };
      });
    return json(url.searchParams.get("batch") === "1" ? results : results[0]);
  }
  if (url.pathname.startsWith("/api/library/guides/aesthetics/"))
    return role === "guest"
      ? json({}, 403)
      : json(guide(url.pathname.split("/").at(-1)));
  if (url.pathname === "/api/library/materials/patterns/files")
    return role === "guest"
      ? json({}, 403)
      : json({
          files: ["holly", "sock", "star", "apple", "loshadka"].map(
            (fileKey, sortOrder) => ({
              fileKey,
              sortOrder,
              revision: 1,
              filename: "audit",
              mimeType:
                fileKey === "loshadka" ? "application/pdf" : "image/png",
              fileSize: 100,
              url: `/api/media/library-files/patterns/${fileKey}`,
            }),
          ),
          nextCursor: null,
        });
  if (url.pathname.startsWith("/api/media/library-files/")) {
    if (role === "guest") return json({}, 403);
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, no-store",
    });
    return res.end(svg);
  }
  if (url.pathname.startsWith("/media/cache-audit/")) {
    const bytes = url.pathname.endsWith(".webm") ? video : svg;
    res.writeHead(200, {
      "Content-Type": url.pathname.endsWith(".webm")
        ? "video/webm"
        : "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      ETag: '"cache-audit-v1"',
    });
    return res.end(bytes);
  }
  if (url.pathname.startsWith("/api/"))
    return json({ error: "Synthetic API: unsupported read/write" }, 404);
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 18081,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});
server.listen(19092, "127.0.0.1");
