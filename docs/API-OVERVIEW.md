# API Overview (tRPC)

Base URL: `https://daryadarcy.com/api/trpc/`  
Format: tRPC batch HTTP, superjson serialization  
Types: inferred from `server/routers.ts` → `AppRouter`

## Procedure types

- **publicProcedure** — без авторизации
- **protectedProcedure** — требуется JWT (cookie web / Bearer native)
- **adminProcedure** — role `admin`

## Routers

### auth
| Procedure | Type | Auth |
|-----------|------|------|
| `auth.me` | query | public |
| `auth.logout` | mutation | public |

### profile
| Procedure | Type | Auth |
|-----------|------|------|
| `profile.update` | mutation | protected |
| `profile.uploadAvatar` | mutation | protected |

### feed
| Procedure | Type | Auth |
|-----------|------|------|
| `feed.list` | query | public |
| `feed.listPaginated` | query | public |
| `feed.getById` | query | public |
| `feed.tags` | query | public |
| `feed.toggleLike` | mutation | protected |
| `feed.toggleSave` | mutation | protected |
| `feed.userInteractions` | query | protected |
| `feed.savedPosts` | query | protected |

### videos
| Procedure | Type | Auth |
|-----------|------|------|
| `videos.list` | query | public |
| `videos.getById` | query | public |

### club
| Procedure | Type | Auth |
|-----------|------|------|
| `club.list` | query | public |
| `club.subscription` | query | public |
| `club.createCheckout` | mutation | public |
| `club.claimPending` | mutation | protected |
| `club.cancel` | mutation | protected |
| `club.comments` | query | public |
| `club.addComment` | mutation | protected |
| `club.deleteComment` | mutation | protected |

### admin (admin only)
Posts, videos, articles, members, payments, media upload, scheduling, stats, `grantClub`, etc.

### articles
| Procedure | Type | Auth |
|-----------|------|------|
| `articles.list` | query | public |
| `articles.getById` | query | public (club lock for premium) |

### shop
| Procedure | Type | Auth |
|-----------|------|------|
| `shop.owned` | query | public |
| `shop.createCheckout` | mutation | protected |

### penPals
| Procedure | Type | Auth |
|-----------|------|------|
| `penPals.me` | query | protected |
| `penPals.upsert` | mutation | protected |
| `penPals.find` | mutation | protected |
| `penPals.remove` | mutation | protected |

### notifications
| Procedure | Type | Auth |
|-----------|------|------|
| `notifications.registerToken` | mutation | public |
| `notifications.latest` | query | public |

## REST endpoints (non-tRPC)

| Path | Method | Description |
|------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/oauth/*` | * | OAuth / SMS auth callbacks |
| `/media/yt-thumb/:id/:quality.jpg` | GET | YouTube thumbnail proxy |

## Example batch request

```
GET /api/trpc/feed.tags?batch=1&input={"0":{"json":null}}
```

Response: JSON batch array with `result.data.json`.
