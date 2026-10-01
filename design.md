# Daria Darcy App — Design Document

## Brand Identity

The app embodies the **Slow Living, Cottagecore, and Vintage** aesthetic of daryadarcy. It should feel like opening a beautifully bound journal — warm, calm, and inviting. Every screen should evoke the feeling of a cozy cottage with soft natural light.

## Color Palette

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| primary | #8B6F5C | #C4A882 | Warm brown — vintage leather, wood |
| background | #FDF8F3 | #1A1612 | Cream parchment / dark walnut |
| surface | #F5EDE4 | #2A2420 | Linen card surfaces |
| foreground | #3D2E22 | #F0E6DA | Rich espresso text / warm cream |
| muted | #9C8B7E | #8A7D72 | Soft taupe for secondary text |
| border | #E8DDD2 | #3D342C | Delicate lace-like dividers |
| success | #6B8F71 | #8FB996 | Garden green |
| warning | #C4956A | #D4A574 | Honey amber |
| error | #B85C5C | #D47A7A | Muted rose |

## Typography

- **Headers:** Serif-inspired feel (system serif or loaded custom font)
- **Body:** Clean sans-serif for readability
- **Accent:** Italic serif for quotes and special sections

## Screen List

### 1. Feed (Лента) — Tab "Home"
The main landing screen. A vertical scrollable feed combining content from Instagram, YouTube, and lifestyle updates.

**Content:**
- Hero banner at top with latest featured post/video
- Content cards with image, title, date, source badge (Instagram/YouTube/Blog)
- Pull-to-refresh functionality
- Category filter chips: All, Instagram, YouTube, Blog

**Layout:**
- Full-width image cards with rounded corners
- Source badge (small icon) in top-right of card
- Title below image, 2 lines max
- Date in muted text below title
- Tap opens detail view or external link

### 2. Library (Библиотека) — Tab "Library"
Free downloadable materials: sewing patterns, recipes, wallpapers, printables.

**Content:**
- Category sections: Patterns, Recipes, Wallpapers, Printables, Guides
- Material cards with preview image, title, file type badge
- Download button on each card
- Search bar at top

**Layout:**
- Horizontal category pills at top
- 2-column grid of material cards
- Each card: square preview image, title, file type (PDF/PNG), download icon
- Tap opens detail with full description and download button

### 3. Shop (Магазин) — Tab "Shop"
Books, e-books, and digital guides with links to marketplaces.

**Content:**
- Featured book banner (carousel)
- Book cards: cover image, title, price, "Buy" button
- Sections: Physical Books, E-Books, Digital Guides
- Each item links to external marketplace (Ozon, Wildberries, LitRes, etc.)

**Layout:**
- Horizontal scroll carousel for featured items
- Vertical list of book cards
- Each card: book cover (left), title + description + price (right), "Buy" button
- "Buy" opens bottom sheet with marketplace options (links)

### 4. Club Darcy (Клуб Darcy) — Tab "Club"
Premium subscription section with exclusive content, comments, and live streams.

**Content (Locked state — non-subscriber):**
- Beautiful hero image with club description
- Benefits list (exclusive content, community, live streams, personal cabinet)
- "Subscribe" button with pricing
- Preview of blurred exclusive content

**Content (Unlocked state — subscriber):**
- Exclusive posts feed (articles, behind-the-scenes, letters)
- Comments section under each post
- Live stream schedule and access
- Discussion threads
- "Letter of the Month" special section

**Layout:**
- If not subscribed: full-screen promotional page with CTA
- If subscribed: feed-like layout with richer interaction (comments, likes, bookmarks)

### 5. Profile (Профиль) — Accessible from header or tab
User's personal cabinet.

**Content:**
- Avatar, name, subscription status
- Saved/bookmarked items
- Downloaded materials
- Subscription management
- App settings (notifications, dark mode)
- About Daria Darcy section

**Layout:**
- Header with avatar and name
- Section list with icons
- Toggle for dark mode
- "Manage Subscription" button

## Key User Flows

### Flow 1: Browse Feed
Home → Scroll feed → Tap card → View detail (or open external link)

### Flow 2: Download Material
Library → Browse/Search → Tap material → View detail → Tap Download → File saved

### Flow 3: Buy a Book
Shop → Browse books → Tap book → View detail → Tap "Buy" → Bottom sheet with marketplace links → Opens external browser

### Flow 4: Join Club
Club tab (locked) → Read benefits → Tap "Subscribe" → Payment flow → Club unlocked → Browse exclusive content → Leave comment

### Flow 5: Manage Profile
Profile → View saved items → Toggle dark mode → Manage subscription

## Tab Bar Configuration

| Tab | Icon | Label |
|-----|------|-------|
| Feed | house.fill | Лента |
| Library | book.fill | Библиотека |
| Shop | bag.fill | Магазин |
| Club | star.fill | Клуб |
| Profile | person.fill | Профиль |

## Design Principles

1. **Warmth over coldness:** Every element should feel handcrafted, not corporate
2. **Breathing space:** Generous padding and margins — content needs room to breathe
3. **Natural imagery:** Botanical illustrations, soft shadows, linen textures
4. **Minimal chrome:** Let the content (photos, text) be the star
5. **Consistent radius:** 16px border radius for cards, 12px for buttons
6. **Subtle animations:** Gentle fade-ins, no aggressive bouncing
