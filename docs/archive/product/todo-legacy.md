> Архивный материал: сохранён для истории, не является текущей инструкцией запуска, деплоя или источником состояния проекта. Актуальная навигация — [документация](../../README.md).

# Project TODO

- [x] Initial project setup and scaffolding
- [x] Design system (theme.config.js, colors, typography)
- [x] Tab navigation with 5 tabs (Home, Club, Interactive, Library, Shop)
- [x] Home screen with hero image, about section, quote, seasonal content
- [x] Club screen placeholder
- [x] Interactive screen placeholder
- [x] Library screen placeholder
- [x] Shop screen placeholder
- [x] Profile screen
- [x] App branding (logo, icon, splash screen)
- [x] Fix bottom tab bar icons being clipped at the bottom
- [x] Add parallax effect on hero image (Home screen)
- [x] Add 16:9 hero video to top of Home screen with DARYADARCY title overlay
- [x] Fix hero video not playing (add fallback poster image, check web/native compatibility)
- [x] Compress hero video for faster loading and reliable autoplay on mobile
- [x] Fix hero video not playing on iOS Expo Go (autoplay/format issue)
- [x] Replace hero video with animated GIF (remove expo-video to fix crash)
- [x] Implement seasonal auto-switching hero image (spring/summer/autumn/winter)
- [x] Implement smooth looping background video hero (like shopslowsunday.com reference)
- [x] Replace video hero with smooth crossfade slideshow of frames (meditative feel)
- [x] Fix tab bar label clipping on iOS
- [x] Create rustic heirloom-style lettering logo DARYADARCY (half-slant variant, thinned, tightened)
- [x] Integrate lettering logo into hero slideshow replacing text DARYADARCY
- [x] Download assets from Yandex Disk (house illustration, meadow photo, book UI)
- [x] Process house illustration: remove background, reduce opacity 5-7%
- [x] Redesign home screen welcome section with vintage book UI (book on meadow background, house illustration, new texts)
- [x] Fix book: shift left so only right page visible, text on right page, house illustration at 96% opacity
- [x] Stylize section cards as vintage postcards/album pages
- [x] Add smooth book reveal animation on scroll
- [x] Generate vintage envelope UI element (milky-beige, open, aged paper inside, embossed D, transparent PNG)
- [x] Add screen capture protection (expo-screen-capture) to Club section screens
- [x] Add text copy prevention (disable text selection) on Club content screens
- [x] Redesign home screen to match detailed design mockups (9 sections)
- [x] Download all assets from Yandex.Disk (hero_header, medallion, book, stamps, explore, banners)
- [x] Install and configure EB Garamond font (Regular + Italic)
- [x] Install and configure Gogol font for author name
- [x] Fix PNG transparency issues (book, medallion displaying on cream bg not black)
- [x] Implement hero section with full-width cottagecore image
- [x] Implement welcome section with "Добро пожаловать" + medallion
- [x] Implement about author section with blurred floral bg, Gogol font
- [x] Implement book section with quote and cottage illustration
- [x] Implement stamps 3x3 grid collage section
- [x] Implement explore section with "Исследуйте" title and feed card
- [x] Implement postcard banners for all 5 tabs (Лента, Клуб, Библиотека, Магазин, Интерактив)
- [x] Implement letter section "Дорогой друг"
- [x] Implement footer with QR code and tagline
- [x] Replace placeholder font with EB Garamond (free OFL license, covers app + YouTube)
- [x] Replace app logo with new version from Yandex.Disk
- [x] Medallion: make larger and overlap onto about-author photo (like reference)
- [x] About-author photo: make more horizontally stretched, use original without cropping
- [x] Book: shift left, text+cottage on right page only, cottage inside book bounds
- [x] Explore panels: uniform layout, beige background matching page bg
- [x] Tighter spacing between all sections (reduce gaps)
- [x] Medallion: make even larger (55% screen width)
- [x] About photo: use 3:2 aspect ratio (landscape), no side cropping
- [x] Section headers (Добро пожаловать, Исследуйте): EB Garamond Regular uppercase with letterSpacing + dashes
- [x] Book cottage: center on right page, move higher
- [x] Book quote: move lower, remove bold formatting
- [x] Book quote author: right-aligned + italic (like reference)
- [x] Raise medallion higher so it doesn't overlap "Дарья Левина" text
- [x] Raise "узнать больше" button higher in about section
- [x] Book quote text: proper margins inside book page (like real book editions)
- [x] Book: shift more to the left (matching reference)
- [x] Cottage illustration: make larger, position like reference (fills bottom of right page)
- [x] Add stylish parallax scroll effect to home screen
- [x] Enlarge cottage illustration on book even more
- [x] Increase size of 9-photo stamp collage under the book
- [x] Add scroll-driven light glint/shimmer effect on medallion
- [x] Fix medallion glint: visible circular mask boundary — shrink mask and soften edges
- [x] Fix medallion glint v2: use medallion PNG shape as mask so glint follows exact locket contour
- [x] Fix medallion glint not visible on native device (use RNImage in mask + increase opacity)
- [x] Fix cottage illustration not loading on device (switched to CDN URL)
- [x] Reduce spacing: book closer to about section, collage closer to book (more compact layout)
- [x] Fix medallion glint v3: pre-rendered glint overlay PNG (no MaskedView needed)
- [x] Move book quote and author text lower on page, closer to center/cottage (top 18%, justifyContent center)
- [x] Fix medallion glint v4: restore sweeping LinearGradient clipped with overflow:hidden on two oval containers matching each locket half
- [x] Shrink glint oval containers inward to stay within locket frame + reduce gradient intensity
- [x] Replace Explore section cover images with new custom covers from Yandex.Disk (Лента, Клуб Darcy, Интерактив, Библиотека, Магазин)
- [x] Add text overlays to cover images (EB Garamond Bold milky white + Gogol for "Клуб")
- [x] Update section descriptions/subtitles across all screens to match new copy
- [x] Remove bold from cover text overlays (use Regular weight instead)
- [x] Remove duplicate section titles below cover images (keep only description text)
- [x] Resize cover images to 9:16 aspect ratio (no head cropping)
- [x] Increase font size on cover text overlays
- [x] Update app card aspect ratio to 16:9 (full display, no cropping)
- [x] Add parallax effect on cover cards (scroll-based image movement)
- [x] Fix cover image cropping - show full image without cropping (removed parallax oversizing)
- [x] Decrease title font size on cover overlays
- [x] Increase subtitle/description font size below covers
- [x] Increase "Клуб" text size on club cover overlay
- [x] Increase section headers font size ("Исследуйте", "Добро пожаловать")
- [x] Make entire card+subtitle block clickable (navigates to section)
- [x] Add "новое" badge indicator on section cards with fresh content
- [x] Move "НОВОЕ" badge to bottom-right corner, uppercase text
- [x] Auto-hide badge after 2 days since last content update
- [x] Add soft glow/pulse animation to badge
- [x] Add unread counter next to badge (e.g. "НОВОЕ · 3")
- [x] Shift "Клуб" text further left on club cover image
- [x] Fix "МАГАЗИН" text centering on shop cover (moved up 30px)
- [x] Reorder SECTION_BANNERS: move Интерактив after Клуб DARCY (before Библиотека)
- [x] Make newCount counter dynamic (derive from real section content data)
- [x] Add zoom-in press animation on section cards before navigation
- [x] Bind lastUpdated to real content dates so НОВОЕ badges auto-hide after 2 days
- [x] Add haptic feedback (expo-haptics) on card press for tactile response
- [x] Implement pull-to-refresh on home screen to refresh counters and content
- [x] Center ИССЛЕДУЙТЕ title vertically between Лента card and stamp collage
- [x] Replace Лента cover photo with new user-provided image (IMG_0979.JPG) + text overlay
- [x] Reduce gap between stamp collage and ИССЛЕДУЙТЕ — equal spacing above/below text
- [x] Add fade-in scroll animation to ИССЛЕДУЙТЕ title
- [x] Make ИССЛЕДУЙТЕ fade-in animation smoother and with bigger rise distance
- [x] Add parallax effect to stamp collage (9 photos) on scroll
- [x] Add subtle shadow/glow around stamp collage for visual separation from background
- [x] Remove shadow/glow from stamp collage (revert to no wrapper)
- [x] Add text overlay on stamp collage image: "мир" (Gogol, left-aligned) + "daryadarcy" (EB Garamond, centered, lowercase) in brown
- [x] Generate new book image with olive cover (Книга Вдохновения style) to replace current one
- [x] Add scroll-driven left page turn animation (perspective rotateY from perpendicular to flat)
- [x] Fix left page overlay: use extracted page texture from book image instead of flat color, match size/position exactly
- [x] Remove left page turn animation from book section (keep book image as-is)
- [x] Make book section clickable — navigate to Магазин (books) with zoom animation and haptic
- [x] Add subtle caption "Мои книги →" below the book as a clickability hint
- [x] Fix book section background — restore cream background (was white)
- [x] Move "мои книги →" inside the book page (bottom-right, under cottage) styled like "узнать больше →" button

## Лента (Feed) Section

### Phase 1: Feed UI (static/mock data)
- [x] Seasonal banner at top of feed (auto-switches by season)
- [x] Horizontal scrollable tag chips (Все, Весна, Лето, Осень, Зима, Дом, Сад, Образы, Видео, Рецепты, Стилизации, Мастер-классы, Путешествия, Личное)
- [x] Single-tag filter selection (tap to filter posts)
- [x] List/Grid view toggle button
- [x] Post card — Telegram-style photo layout (1-9 photos, smart grid)
- [x] Post card — text preview with "читать дальше" expand button
- [x] Post card — date, tags display
- [x] Grid view — thumbnail previews, tap to open full post
- [x] Mock data with sample posts (various photo counts, tags)

### Phase 2: Database schema
- [x] Posts table (id, text, photos[], tags[], createdAt, updatedAt, source)
- [x] Tags table (id, name, slug, category)
- [x] PostTags junction table (using JSON column on posts instead)
- [x] Likes table (userId, postId)
- [x] Saved/bookmarks table (userId, postId)

### Phase 3: API + data connection
- [x] tRPC endpoints for posts (list, getById, filter by tag)
- [x] tRPC endpoints for likes/saves (toggle, count)
- [x] Connect Feed UI to live database data
- [x] Like/save buttons for authorized Club members

### Phase 4: Admin panel
- [x] Admin screen accessible from profile (for app owner only)
- [x] Create new post form (text, photos upload, tag selection)
- [x] Edit existing post (reorder photos, edit text, change tags)
- [x] Delete post
- [x] Instagram import button (future: auto-sync placeholder)

## Feed Enhancements (Phase 2)

### Photo display fixes
- [x] Remove border-radius from post photos (sharp corners)
- [x] Preserve photo orientation (horizontal stays horizontal, no cropping)
- [x] Use resizeMode contain/cover to show full image without cropping

### Post detail screen
- [x] Create post detail screen (app/post/[id].tsx)
- [x] Full photo viewer with swipe between photos
- [x] Full text display (no truncation)
- [x] Like/save buttons on detail screen
- [x] Navigate from feed list/grid to detail screen
- [x] Back button to return to feed

### Photo upload from device in admin
- [x] Add image picker button in admin post form
- [x] Upload photos to S3 storage
- [x] Show upload progress indicator
- [x] Support multiple photo selection

### Instagram import
- [x] Instagram Graph API integration on server
- [x] Import button in admin panel
- [x] Fetch posts with photos and captions from Instagram
- [x] Allow editing imported posts (reorder photos, add tags)
- [x] Store Instagram post ID to avoid duplicates

## Feed Improvements (Phase 3)

### Drag-and-drop photo reordering in admin
- [x] Add move up/down buttons for photos in admin post form
- [x] Visual feedback when reordering (numbered badges update)
- [x] Persist new photo order when saving post

### Feed pagination with infinite scroll
- [x] Add paginated API endpoint (limit/offset or cursor-based)
- [x] Implement infinite scroll in feed (load more on scroll to bottom)
- [x] Show loading indicator at bottom while fetching more posts
- [x] Handle end-of-list state (no more posts to load)

### Post preview before publishing
- [x] Add "Preview" button in admin post form
- [x] Show post as it would appear in feed (same card layout)
- [x] Allow toggling between edit and preview modes

## Feed Improvements (Phase 4)

### Search across posts
- [x] Add search bar at top of feed (below banner, above tags)
- [x] Search by post text content
- [x] Show search results in same feed/grid layout
- [x] Clear search button
- [x] Debounced search input (300ms delay)
- [x] Server-side search endpoint

### Push notifications for new posts
- [x] Register device for push notifications (expo-notifications)
- [x] Store push tokens in database
- [x] Send push notification when admin publishes new post
- [x] Notification opens the new post detail screen
- [x] Notification permission request on first launch

## Infrastructure (Phase 5)

### Timeweb S3 Storage
- [x] Install @aws-sdk/client-s3 package
- [x] Configure S3 credentials as environment variables (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET)
- [x] Update storage.ts to use Timeweb S3 (endpoint: s3.twcstorage.ru, bucket: daryadarcy-s3, region: ru-1)
- [x] Add fallback to Manus storage when S3 env vars not configured
- [x] Write S3 connection test (validates credentials + upload)
- [x] All 89 tests passing including S3 connection

### Timeweb Cloud Server (72.56.239.34)
- [ ] SSH into server and configure system (apt update, Node.js 22, Nginx)
- [ ] Install and configure MySQL/PostgreSQL
- [ ] Deploy app backend to server
- [ ] Configure Nginx reverse proxy for API
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Configure firewall (ufw)
- [ ] Set up PM2 for process management

### Selectel Backup Server
- [ ] Rent Selectel server (Saint Petersburg)
- [ ] Configure as backup/replica
- [ ] Set up database replication

## Feed UI Improvements (Phase 6)

- [x] Shorter search bar + list/grid toggle on same row (search left, toggle right)
- [x] Tag chips get their own full-width row below search
- [x] Serif font (EB Garamond) for tag chips text
- [x] Serif font for "читать дальше" button text
- [x] Serif font for tab bar labels (Лента, Клуб, Интерактив, Библиотека, Магазин)
- [x] Add arrow "→" after "читать дальше" (like "мои книги →")
- [x] Larger post text font size
- [x] Telegram-style photo grid: full-width, no white gaps, smart layouts based on photo count and orientation

## Instagram Import (Phase 7 - No Token/Password)

- [x] Scrape public Instagram profile daryadarcy (744 posts, 4433 photos)
- [x] Remove all hashtags from post text during import
- [x] Map relevant hashtags to app tags (home, garden, personal, etc.)
- [x] Import posts into database in chronological order (newest first)
- [x] Deduplicate by Instagram shortcode
- [x] All 744 posts successfully imported (752 total with existing test posts)
- [x] Re-upload photos from Instagram CDN to Timeweb S3 (4393 photos, 0 failures)
- [ ] Import remaining ~665 posts (2017-2020) when password is recovered

## Feed Layout Fixes (Phase 8)

- [x] Delete non-Instagram test posts from database (8 deleted)
- [x] Remove side padding from post photos (full-width edge-to-edge)
- [x] Show 4:5 vertical photos larger without cropping to horizontal
- [x] Make photo collages bigger overall (all grid cells use portrait-friendly ratios)

## Photo Viewer & Video Player (Phase 9)

- [x] Fullscreen photo viewer modal (tap any photo to open)
- [x] Swipe left/right to navigate between photos in a post
- [x] Close viewer by swiping down or tapping X
- [x] Photo counter indicator (1/5, 2/5, etc.)
- [x] Dark background overlay in viewer
- [x] Video player component created (inline playback with thumbnail + play button)
- [x] Play/pause button overlay on video thumbnails
- [ ] Video controls (progress bar, mute toggle) — pending video URLs in DB
- [ ] Video plays in fullscreen viewer too — pending video URLs in DB

## Tag Classification (Phase 10)

- [x] Add new tags to database: Детское, Дача, Книги, Творчество
- [x] Update tag definitions in feed UI code (tag chips, filters)
- [x] Build auto-classification logic (text keywords + date + season)
- [x] Classify all 744 posts with appropriate tags (multiple tags per post)
- [x] Verify tag distribution and accuracy

## Post Management in Feed (Phase 11)

- [x] Fix admin panel showing 0 posts (root cause: user not logged in; added role to auth payload)
- [x] 3-dot menu on each post in feed (visible to owner only via OWNER_OPEN_ID)
- [x] Edit post: text editing
- [x] Edit post: add/remove photos
- [x] Edit post: reorder photos
- [x] Delete post with confirmation dialog
- [x] Tag selection UI (choose hashtags for post)
- [x] Save changes to database via API

## Texture Background (Phase 12)

- [x] Generate rustic paper texture image (warm cream, subtle grain)
- [x] Integrate texture as ImageBackground in ScreenContainer
- [x] All screens automatically get textured background
- [x] Added showTexture prop for screens that need flat background

## UI Bug Fixes (Phase 13)

- [x] Generate higher quality paper texture with visible fibers (more detailed, naturalistic)
- [x] Apply texture uniformly to ALL screens (no plain white areas or stripe artifacts)
- [x] Remove divider lines between posts in feed
- [x] Fix header sliding down after returning to home from other tabs
- [x] Fix tab bar text being cut off at bottom

## UI Bug Fixes (Phase 14)

- [x] Fix header sliding down on home screen — hide native header for index tab (headerShown: false)
- [x] Fix paper texture not visible on home screen — make section backgrounds transparent/semi-transparent so texture shows through
- [x] Add SafeArea padding top on home screen so icons don't overlap status bar

## UI Bug Fixes (Phase 15)

- [x] Fix header sliding — replace native navigator header with custom in-content header for home screen
- [x] Add paper texture background to the custom header for visual consistency

## UI Color Update (Phase 16)

- [x] Change primary/accent color from green to brown (#8B7355) in theme.config.js
- [x] Update tab bar icon and label colors to brown
- [x] Update header icons to brown on all screens
- [x] Update feed view toggle icons (grid/list) to brown
- [ ] Fix header height expanding issue on home screen (Expo Go limitation)

## UI Polish (Phase 17)

- [x] Add paper texture background to the tab bar
- [x] Update muted color from greenish (#7A8A7C) to warm gray-brown (#9C8E80)
- [ ] (skipped) APK build — user will do via Publish button when ready

## UI Polish (Phase 18)

- [x] Make tab bar icons/labels more saturated and readable (darker active #5C4033, inactive #8B7355)
- [x] Update dark theme to warm brown tones (background #1C1714, surface #2A2320, border #3D3530)
- [x] Add animated header — hide on scroll down, show on scroll up (absolute positioned, animated translateY)

## Header Fix (Phase 19)

- [x] Remove background from home screen custom header (icons float on banner without a strip)
- [x] Disable native headers on ALL tabs (headerShown: false globally) to avoid Expo Go double header
- [x] Add compact custom in-content header to other tab screens (feed, club, interactive, library, shop, profile)

## Header Style Update (Phase 20)

- [x] Update TabHeader to support transparent mode with white icons (no background strip)
- [x] Apply transparent white header on feed (has banner) and non-transparent on other tabs (no banner yet)
- [x] Replace hero banner with new cottagecore photo (embroidery + houses + meadow)
- [x] Add native DARYADARCY text overlay on banner (EB Garamond, milky white, centered at bottom)
- [x] Add "пространство вдохновения" subtitle on paper background below banner
- [x] Move DARYADARCY text higher on banner (upper third, on the meadow area)
- [x] Reduce letter-spacing on DARYADARCY
- [x] Remove "пространство вдохновения" subtitle from below banner
- [x] Move "ДОБРО ПОЖАЛОВАТЬ" directly under the banner
- [x] Add "в пространство вдохновения" in italic above "для тех кто…" text
- [x] Change "для тех кто…" to Regular (non-italic) font
- [x] Remove icons (star, etc.) from section banner cards, keep only arrow
- [x] Make arrows more elegant and slightly larger (like "мои книги" style)
- [x] Change "пространство вдохновения" to Gogol font

## Grid Mode Fix (Phase 10)

- [x] Fix grid mode error: "Changing numColumns on the fly is not supported" — added key prop to FlatList
- [x] Set grid items to 4:5 aspect ratio (Instagram-style)
- [x] Add play icon overlay on video/reel posts in grid view
- [x] Grid tap opens post detail screen instead of photo viewer

## Grid Polish (Phase 11)

- [x] Fix grid gaps: uniform 1px spacing both horizontal and vertical (Instagram-style)
- [x] Video posts: show video thumbnail frame instead of first photo (ready for when video posts exist)
- [x] Smooth scale animation on grid item press before navigating to post detail
- [x] Quick "Видео" filter button in grid mode header for video-only view

## Video Section (Phase 12)

- [x] Scrape YouTube channel @daryadarcy — get all video metadata (title, thumbnail, duration, date, YouTube ID)
- [x] Create videos table in database (id, title, thumbnailUrl, videoUrl, duration, youtubeId, publishedAt)
- [x] Seed 60 videos from YouTube channel into database
- [x] Build video feed UI — YouTube-style cards (16:9 thumbnail + title + duration badge)
- [x] Build video player/detail screen with YouTube link and future S3 player
- [x] Add "Видео" tab to bottom navigation
- [x] Integrate "Видео" button in feed grid mode to navigate to videos tab
- [ ] Upload video thumbnails to Timeweb S3 (currently using YouTube CDN)
- [ ] Download actual video files to S3 for VPN-free playback (large task, may need separate process)

## Shop Section (Phase 13)

- [x] Generate 3D book mockups with real covers (all 5 products)
- [x] Generate light warm wooden shelf background (honey-colored, dried herbs, wicker basket)
- [x] Generate vintage sign "Магазин" on chains
- [x] Build Shop main screen with light cottagecore wooden shelf aesthetic
- [x] Upper shelf: 3 physical books (Книга вдохновения, Романтика дачи, Тропинка к творчеству)
- [x] Lower shelf: 2 digital products (Пособие по фотографии, Винтажные книги и открытки)
- [x] Product detail screen: image carousel with pagination dots
- [x] Product detail screen: buy buttons (Wildberries links for books, "coming soon" for digital)
- [x] Product detail screen: description + characteristics sections
- [x] Add medieval lute background music (Pixabay, royalty-free) with toggle button
- [x] Music auto-loops at 30% volume, toggle in header (note icon)
- [ ] Product detail screen: reviews section
- [ ] Add more gallery images for each product (inside pages, spreads)
- [ ] Add prices when available

## Shop Visual Fixes (Phase 14)

- [x] Remove white backgrounds from book mockups (transparent PNG)
- [x] Make all books same size and properly aligned on shelf
- [x] Regenerate shelf background: darker, rougher, more medieval/textured wood (keep herbs + basket)
- [x] Removed sign (using section labels instead for cleaner look)
- [x] Books aligned to bottom of shelf row, uniform size

## Shop Visual Overhaul (Phase 15)

- [x] Generate cinematic shelf background v10 (v9 composition + v6 atmosphere)
- [x] Apply shelf v10 as background in shop.tsx
- [x] Books positioned absolutely on shelf planks (scroll with background, not independently)
- [x] Digital products positioned on 3rd shelf with offset for pouch
- [ ] Shop sign "Магазин" on chains (waiting for user reference)
- [ ] Animated dust particles floating in light beams on scroll
- [ ] Product detail screen: reviews section
- [ ] Real prices and purchase links for digital products

## Shop V14 - Clean Mockups + Extended Shelf
- [x] Replace mockups with user's clean transparent versions (5 books, no white bg)
- [x] Programmatically extend shelf by duplicating empty section (added 300px before drawers)
- [x] Keep original shelf color, mешочки, and style intact
- [x] Update product detail page with clean mockup URLs

## Shop Positioning & Labels (Phase 16)
- [x] Raise books higher on shelf 2 (closer to plank)
- [x] Spread side books toward walls with space-evenly layout
- [x] Lower center book (Тропинка к Творчеству) relative to side books
- [x] Fine-tune side books spacing (paddingHorizontal: 70)
- [x] Raise digital books higher on shelf 3
- [x] Shift digital books to the right (away from pouch)
- [x] Lower master-class book relative to pособие
- [x] Make master-class book smaller (85% size)
- [x] Shift master-class further right from pособие
- [x] Generate vintage rusty metal label frame (wide, with antique nails, aged paper inside)
- [x] Add shelf labels under each book on shelf 2 (Книга Вдохновения, Тропинка к Творчеству, Романтика Дачи)
- [x] Add shelf labels under digital books on shelf 3 (Пособие, Мастер-класс)
- [x] Absolutely position labels to align precisely under book centers (shelf 2)
- [x] Absolutely position labels to align under digital book centers (shelf 3)
- [x] Lower house on shelf 4 to sit on plank (0.73 multiplier)

## Shop New Shelf Image Integration (Phase 17)
- [x] Integrate user's Photoshop shelf image (1021x3118px) as new background
- [x] Replace wooden sign image with "МАГАЗИН" text in EB Garamond caps (cream/milk color)
- [x] Add section label "Печатные книги" on shelf 2 back wall (EB Garamond Italic, milk color)
- [x] Add section label "Электронные продукты" on shelf 3 back wall (EB Garamond Italic, milk color)
- [x] Recalculate plank positions for new image proportions (41%, 61.5%, 78.5%)
- [x] Reposition all books, digital products, and house on correct shelves
- [x] Keep metal label frames (ShelfLabel) under each book
- [x] Adjust digital products layout (reduced paddingLeft from 210 to 80 since no pouch in new image)

## Shop Animation Refinements (Phase 18)
- [x] Smaller dust motes (reduced from 2-3.5px to 1-1.5px for subtler cinematic effect)
- [x] Slower price tag swing (modulo 600 instead of 300, amplitude ±2°/±2.5° instead of ±3°/±4°)
- [x] Price tag pivot point at top (where string attaches) using translateY trick for top-center rotation

## Shop Animation Enhancements (Phase 19)
- [x] Increase dust mote count (16 motes total, up from 10)
- [x] Add fade in/out to dust motes (opacity pulsing via loop interpolation)
- [x] Scroll-reactive light beam (translateX/Y shift on scroll)
- [x] Haptic feedback on book and price tag press
- [x] Wood creak sound effect on scroll (3s cooldown, triggered every ~250px)

## Quiz: "Какая твоя сказка?" (Phase 28)

- [x] Create quiz asset directories and copy all images (landscapes, shelters, outfits, animals, houses, artifacts, chest, start-collage)
- [x] Create quiz data layer (lib/quiz-data.ts) with 10 questions, 7 aesthetics, scoring logic, result descriptions
- [x] Create quiz state management (lib/quiz-state.ts) with React Context + useReducer
- [x] Create quiz route (app/quiz/index.tsx + _layout.tsx)
- [x] Create QuizWelcome component (hero image, description, info cards, start button)
- [x] Create QuizQuestion component (progress bar, text/visual answer modes, navigation)
- [x] Create QuizResult component (hero, fairy tale, archetype, values, superpower, aesthetic in life, score breakdown, share/restart)
- [x] Connect quiz from Interactive tab (first card navigates to /quiz)
- [x] Unit tests for quiz scoring logic (12 tests passing)

## Quiz Animations (Phase 29)

- [ ] Smooth slide transition between quiz questions (slide out left / slide in right)
- [ ] Confetti celebration effect on result screen appearance
- [x] Update all quiz answers to match official document (7 options per question)
- [x] Update welcome screen description to final text
- [x] Add missing images (badger, light-academia outfit, fairycore/light-academia shelters, 3 landscapes)
- [x] Update visual grid layout to 3 top + 4 bottom
- [x] Remove text labels from visual answer cards (images only)
- [x] Change visual grid layout from 3+4 to 2-3-2 (larger images)
- [x] Apply EB Garamond Bold for question titles, Italic for narratives
- [x] Use brown color for all quiz text (no black)
- [ ] Fix incorrect images showing on visual questions (verify after restart)
- [x] Update welcome screen: floating collage on app background, new title
- [x] Remove black background from outfit/artifact image cards (images float on app bg)
- [x] Remove thin borders from all visual quiz cards — only show border on selected card

## Cottagecore Result Content (Phase 30)

- [x] Add full Cottagecore result content data file (Style, Space, Rituals, Blog, Inspiration sections)

- [x] Replace old placeholder Cottagecore result texts with new detailed content from cottagecore-result.ts
- [x] Fix black background on transparent PNG images in quiz (outfits, artifacts show black instead of app bg)
- [x] Redesign result screen: Hero → Archetype → Fairy Tale → Role Models → Depth → Score → Club CTA → Club Content
- [x] Add moodboard photo carousel in Style section (club content)
- [x] Add outfit photo carousel in Style section after moodboards (club content)
- [x] Add interior photo carousel in Space section (club content)
- [x] Change quiz visual questions (outfits, artifacts) from grid to full-screen swipe carousel
- [x] Swipe carousel only for outfits/artifacts questions; grid for landscape/animal/house
- [x] Replace "свайпай" with "листай" in swipe hint
- [x] Increase outfit/moodboard image size in carousel
- [x] Fix question title "первый пейзаж" → "что ты видишь?"
- [x] Fix text card colors: warm milky background, brown text

## Interactive Tab Redesign (Phase 31)

- [x] Redesign Interactive tab: header with "И Н Т Е Р А К Т И В" (EB Garamond Bold, letter-spacing) + italic subtitle
- [x] Add decorative elements: books PNG (left) and key PNG (right) near header
- [x] Two cards only: Тест-путешествие (gothic door cover, "Начать" button) and Мудборд (apothecary shelf cover, "Скоро" disabled)
- [x] Card layout: white uppercase title + icon on bottom-left, light button on bottom-right, italic description below on cream background
- [x] Remove green overlay (only 12% dark overlay for text readability)
- [x] Remove "Уютная игра" card and "Есть идея?" section
- [x] Compress all images under 900KB (quiz-cover 171KB, moodboard-cover 159KB, key-decor 17KB, books-decor 42KB)
- [x] Change first quiz question title from «пробуждение» to «Что ты чувствуешь?»
- [x] Change quiz font color to match Interactive tab title color (#5C4033 brown) across entire quiz
- [x] Make text after dashes in answer options italic
- [x] Bold key words in answer options: спокойствие, любопытство, внимательность, тишину, восторг и лёгкость, желание понять, радость и вдохновение
- [x] Swap landscape photos 3 (goblincore/mushrooms) and 4 (castlecore/stone arch) so second row has all square images
- [x] Normalize all Q3 outfit images to match goblincore canvas (600x1301) and content positioning
- [x] Enlarge outfit images to fill more of the screen
- [x] Fix pagination dots to scroll with carousel (not stay fixed)
- [x] Add looping video clip between title and narrative on Q3 (outfit question)
- [x] Add link to full YouTube video below outfit carousel
- [x] Remove video clip and YouTube link from Q3
- [x] Add pouch image to the right of Q3 narrative text
- [x] Redesign Q4 (shelter) grid: row1=3 squares (greenhouse, cafe, tree hollow), row2=1 wide tavern, row3=3 squares (witchcore bottles, fairy greenhouse, library)
- [x] Remove chest image from Q5
- [x] Change Q5 title from "Находка" to "Твои артефакты"
- [x] Move all artifact images higher
- [x] Move witchcore artifact (cauldron/stone) especially higher
- [x] Reorder Q7 animals: row1(cat+horse), row2(badger+owl+raven), row3(borzoi+deer) with gridLayout [2,3,2]
- [x] Reduce gap between animal images for tighter layout
- [x] Update Q8 (Испытание) answer texts with new formulations and bold keywords
- [x] Fix Q8 answer 1: "будут цвести и плодоносить", bold "цвести"
- [x] Fix artifact carousel clipping (witchcore bags cut off) - added bottom padding

## Light Academia Content (Phase 32)

- [x] Create lightacademia-result.ts from PDF content (Style, Space, Rituals, Blog, Inspiration)
- [x] Copy 16 outfit images (transparent PNG) to assets/results/lightacademia/outfits/
- [x] Copy 11 moodboard images to assets/results/lightacademia/moodboards/
- [x] Copy 11 interior images to assets/results/lightacademia/interiors/
- [x] Import LIGHT_ACADEMIA_RESULT in quiz-result.tsx
- [x] Add LIGHTACADEMIA_OUTFITS, LIGHTACADEMIA_MOODBOARDS, LIGHTACADEMIA_INTERIORS arrays
- [x] Integrate lightAcademia into getClubContent function
- [x] Add lightAcademia to moodboards/outfits/interiors selection logic in ClubContentSection
- [x] Add Light Academia table headers ("Силуэты" / "Детали")
- [x] Update Club CTA block: show privilege text for subscribers ("Вам доступен полный гид по вашей эстетике")
- [x] Ensure isSubscribed=true for testing access to all results
- [x] Restore fairycore content and assets from git history
- [x] Replace "Миксование" with "Сочетание с другими эстетиками" in all results
- [x] Replace "Контраст" with "Основа гардероба" for Light Academia
- [x] Make all rubric labels italic (EB Garamond Italic)
- [x] Section titles (СТИЛЬ, ПРОСТРАНСТВО, РИТУАЛЫ, БЛОГ, ВДОХНОВЕНИЕ) uppercase EB Garamond with letterSpacing
- [x] Add spacing before "Сочетание с другими эстетиками" block
- [x] Fix moodboard image aspect ratio
- [x] Update Witchcore title: "Та, чьи руки пахнут травами и дождем"
- [x] Update Goblincore title: "Девушка, чьи карманы полны лесных сокровищ"
- [x] Update Dark Academia title: "Девушка, влюблённая в тишину старых библиотек"
- [x] Fix all 7 aesthetics free result content from PDF (fairyTale, archetype, roleModels, depth)
- [x] Add tab switcher at top of result screen for blend (switch between primary and secondary aesthetics)
- [x] Update Cottagecore hero title: "Девушка, вернувшая жизнь заброшенному саду"
- [x] Create Aesthetics Guide screen in Library section (all 7 aesthetics, free + premium content with images)
- [x] Add table of contents with links to each aesthetic section
- [x] Add CTA buttons: "Вступить в клуб" (if not subscribed) and "Узнать свою эстетику" (link to quiz)
- [x] Navigate from Library tab to Aesthetics Guide
- [x] Replace Library guide card icon with banner image preview
- [x] Gate full aesthetics guide behind subscription (show only banner + locked message + join CTA if not subscribed)
- [x] Add library banner with books image and EB Garamond uppercase title
- [x] Library: full-width banner with books photo, white header icons on transparent overlay (like Shop)
- [x] Library: make entire screen scrollable (banner + guide card + materials all scroll together)
- [x] Add "Сборник стилизаций" card in Library (free, with cover + read/download button)
- [x] Add "Сборник рецептов" card in Library (club-only, with subscription gate like aesthetics guide)
- [x] Library: paper texture background + title moved higher
- [x] Add "Мини-гид по Петербургу" card in Library (club-only, with subscription gate)
- [x] Create Patterns Gallery screen (app/library/patterns.tsx) with Christmas toy patterns (holly, sock, star, apple)
- [x] Full-screen image viewer with pinch-to-zoom and double-tap zoom
- [x] Download button "Скачать для печати" (saves to gallery on native, opens in browser on web)
- [x] Subscription gate on patterns screen (same pattern as aesthetics guide)
- [x] Wire up patterns card in Library tab to navigate to /library/patterns
- [x] Upload pattern images to S3 CDN
- [x] Include "Лошадка-качалка" PDF link in patterns screen

## Library Screen Redesign
- [x] Remove fake/placeholder materials from Library screen
- [x] Move search bar under the banner (before material cards)
- [x] Fit card sizes to real cover images without stretching (no extra white/cream space)
- [x] Add title below each card + action button (read/download or lock "для участниц клуба Darcy")
- [x] Implement Pinterest-style masonry layout for Library cards (remove extra spacing between items)
- [x] Create in-app PDF viewer screen with WebView and scroll (replace external browser opening)
- [x] Wire PDF materials in Library to navigate to the in-app viewer instead of WebBrowser
- [x] Add download button to PDF viewer header (save to device)
- [x] Add progress indicator (percentage) during PDF loading
- [x] Cache downloaded PDFs locally for instant re-opening
- [x] Fix PDF viewer: switch from Google Docs viewer to Mozilla PDF.js for proper multi-page rendering
- [x] Replace PDF viewer with Yandex Disk links (Stilizacii, Recipes, Peterburg)
- [x] Add rocking horse cover image to patterns screen
- [x] Replace Peterburg cover with cropped version (no black bar)
- [x] Remove unused pdf-viewer.tsx screen and route
- [x] Add Лошадка-качалка as free card on main Library screen with cover
- [x] Rename Выкройки to Зимние выкройки'26 (club-only)

## Club Tab

- [x] Create club banner image (клуб DARCY text overlay on meadow background)
- [x] Upload club banner to S3
- [x] Redesign Club tab with subscription gate: landing page with banner when not subscribed
- [x] Club subscribed state: banner + member badge + broadcast banner + posts list
- [x] Brand-consistent styling (EB Garamond, olive/brown/cream palette, paper texture bg)
- [x] Add letter carousel (3 images) under Письмо месяца benefit with rounded corners and pagination dots


## Клуб (подписная часть) — приложение в приложении

- [x] Внутренний таб-бар клуба (4 вкладки: Подборки, Комьюнити, Эксклюзив, Лайф)
- [x] Визуальное оформление клуба (другой фон, баннер «Клуб Darcy», цветовая палитра)
- [x] Экран «Подборки» — лента постов-подборок
- [x] Экран «Комьюнити» — посты-обсуждения, вопросы дня
- [x] Экран «Эксклюзив» — статьи, видео, подкасты, письмо месяца
- [x] Экран «Лайф» — закулисье, неформальный контент
- [ ] Пробковая доска с тегами (навигация по архиву, свайп справа)
- [x] Почтовое отделение (Pen Pals) — экран с формой заявки
- [ ] Логика мэтчинга Pen Pals (backend)
- [x] Экран после мэтча (карточка друга по переписке)
- [x] Сезонный фон-тартан для клуба (осенний по умолчанию, зимний с 20 ноября, полная видимость без прозрачности)
- [x] Осенний баннер+фон клуба одним изображением (IMG_4768.JPG — пейзаж с предметами наверху, тартан ниже)
- [ ] Зимний баннер+фон клуба (добавить позже)
- [x] PNG-стикеры в таб баре клуба (корзинка, чашки, ключик, ёжик)
- [x] PNG-стикеры лайк/сохранить на карточках постов (бронзовое сердце, чемодан)
- [x] Добавить поле gender в БД (users table) и API
- [x] Персонализированное приветствие «Очень рада тебе, дорогая/дорогой [Имя]» в клубе (на основе gender из профиля)
- [x] Экран оформления профиля после оплаты подписки (имя, пол, фото)
- [x] Приветствие показывать только на главной клуба (без выбранной вкладки), скрывать при переключении на вкладки
- [x] Убрать плавающую кнопку Pen Pals с главной клуба
- [x] Добавить во вкладку «Комьюнити» после баннера: изображение почтового ящика + кнопка «найти друга по переписке ➡️»
- [x] Убрать «расскажи о себе» из модалки профиля
- [x] Добавить кадрирование фото при выборе (кастомный кроппер с pan + pinch-to-zoom внутри круглой рамки)
- [x] Убрать запятую после «дорогая/дорогой» в приветствии
- [x] Уменьшить промежуток между баннером и приветствием / почтовым ящиком
- [x] Кнопка «найти друга по переписке» — стиль, шрифт и стрелка как на главной странице
- [x] Модалка профиля показывается только 1 раз после оплаты подписки (не при каждом заходе в клуб)
- [x] Переработка экрана Профиль: фото (с заменой через кроппер) + имя из AsyncStorage
- [x] Две вкладки: сохранённые посты из ленты / сохранённые посты из клуба
- [x] Секция «Эстетика» (если пройден тест)
- [x] Секция «Мои мудборды» (заглушка на будущее)
- [x] Секция «Подписка» (инфо, отмена, вопрос по подписке)
- [x] Убрать из профиля: соцсети, моковые сохранённые, админку, «О Дарье Дарси»
- [x] Сохранять результат теста-путешествия в AsyncStorage и показывать в профиле (секция «Эстетика»)
- [x] Добавить значки лайка и сохранения в ленту (как в клубе)
- [x] Подключить сохранённые посты к профилю (вкладки «Из ленты» / «Из клуба»)
- [x] Добавить редактирование имени в профиле
- [x] Сохранение постов из клуба с персистенцией в AsyncStorage (вкладка «Из клуба» в профиле)
- [x] Переход к полному посту при нажатии на сохранённый пост в профиле
- [x] Анимация scale bounce при нажатии на кнопку сохранения и лайка (лента + клуб)
- [ ] Доска тегов в клубе (пробковая доска с навигацией по архиву)
- [x] Профиль: заголовки секций капсом EB Garamond
- [x] Профиль: кнопки вкладок с меньшим скруглением (стиль лендинга)
- [x] Профиль: переработка секции подписки (заголовок, статус, дата списания, убрать красный)
- [x] Профиль: тёплый кремовый фон плашек (как в лендинге, не белый)
- [x] Профиль: секция «ЗАДАТЬ ВОПРОС» с кнопками «По подписке» и «По приложению» (заглушки)
- [x] Профиль: иконки на каждую секцию (как карточки на лендинге)
- [x] Профиль: заглушка для неподписанных (текст + кнопка «Вступить в клуб»), полный профиль только для подписчиц
- [x] Баг: модалка профиля появляется повторно (флаг profileCompleted не сохраняется)
- [x] Баг v2: модалка профиля появляется повторно (await + fallback по name key)
- [x] Баг: фото из модалки клуба не отображается в профиле при переходе
- [x] Доска тегов: drawer справа (свайп справа налево), с тегами сезонов и категорий поверх доски
- [x] Доска тегов: peek-анимация (подёргивание края) для подсказки свайпа

## Admin Panel v2 — Full Post Management (Phase 40)

### Database & API
- [x] Extend posts table: add status (draft/scheduled/published), scheduledAt, target (feed/club/both)
- [x] Add post_media table (id, postId, type, url, order, metadata)
- [x] API: create post with rich text + media attachments
- [x] API: update post (text, media reorder/replace/delete, tags, status, schedule)
- [x] API: delete post
- [x] API: list admin posts (all statuses, with filters)
- [x] API: upload media (photos, video, audio, documents) to S3
- [x] API: confirm scheduled post publication
- [x] Admin role detection by user account

### Post Creation Screen
- [x] Rich text editor (bold, italic, inline links)
- [x] Photo picker (multiple selection, up to 9+ photos)
- [ ] Photo management (reorder drag, replace, delete individual)
- [ ] Video attachment
- [ ] Audio/podcast attachment
- [ ] Document attachment
- [x] Tag selection UI (fixed tags as buttons)
- [x] Target feed selection (Лента / Клуб)
- [x] Schedule date/time picker
- [ ] Post preview before publishing
- [x] Publish / Save as draft / Schedule buttons

### Post Editing & Deletion
- [ ] Edit button on own posts in feed (admin only)
- [ ] Delete button with confirmation
- [ ] Edit media within post (replace photo, reorder, delete)

### Calendar Tracker (Admin only)
- [x] Monthly calendar view (grid 7 columns, Mon-Sun)
- [x] Circle thumbnails on days with scheduled posts
- [x] Tap circle to view/edit scheduled post
- [x] Month navigation (prev/next)
- [x] Visual distinction: published vs scheduled vs draft

### Display in Feed/Club
- [ ] Posts from DB render with rich text formatting (bold, italic, links)
- [ ] Photo grid (1-9 photos smart layout) / carousel (10+ photos)
- [ ] Video player inline
- [ ] Audio player inline
- [ ] Document download link

### FAB Button (Admin only)
- [x] Floating "+" button on Feed tab (bottom-right, visible only to owner)
- [x] Floating "+" button on Club tab (bottom-right, visible only to owner)
- [x] FAB opens CreatePostModal with auto-detected target (feed/club)
- [x] Long press on FAB opens admin panel (calendar tracker, full post list)


## Admin Panel v2.1 — Media & Edit Enhancements (Phase 41)

### Media Attachments in CreatePostModal
- [x] Video picker and upload (from gallery)
- [x] Audio/podcast picker and upload
- [x] Document picker and upload
- [x] Media type indicators in post form (icons for video/audio/doc)
- [x] Remove individual media attachments

### Photo Management in Edit Mode
- [x] Move photo up/down buttons (reorder)
- [x] Replace individual photo (pick new from gallery)
- [x] Delete individual photo from post
- [x] Visual numbered badges on photos

### Edit/Delete on Post Cards (Admin only)
- [x] Three-dot menu on post cards (visible only to owner)
- [x] Edit action opens CreatePostModal with pre-filled data
- [x] Delete action with confirmation alert
- [x] Works on both Feed and Club post cards

## Admin Panel v2.2 — Media Preview, Notifications, Statistics (Phase 42)

### Video/Audio Preview in Post Cards
- [x] Inline video player component (thumbnail + play button, expands on tap)
- [x] Audio/podcast player component (waveform-style bar, play/pause, progress)
- [x] Document attachment indicator (file icon + name, tap to open)
- [x] Show media previews in both Feed and Club post cards

### Scheduled Post Reminder Notifications
- [x] Local notification when scheduled post time arrives
- [x] Notification text: "Пост запланирован на сейчас — подтвердите публикацию"
- [x] Tap notification opens admin panel with the post ready to confirm
- [x] Schedule notifications when creating/updating scheduled posts
- [x] Cancel notifications when post is deleted or published early

### Post Statistics in Admin Panel
- [x] Stats dashboard tab in admin screen (alongside Posts and Calendar)
- [x] Total posts count (published/drafts/scheduled breakdown)
- [x] Likes and saves per post (top-5 most popular)
- [x] Posts per month comparison (this month vs last month + trend)
- [x] Channel breakdown (feed/club/both)

## Rich Text Rendering in Post Cards (Phase 43)

- [x] Create RichTextRenderer component (bold, italic, inline links)
- [x] Integrate RichTextRenderer into Feed post cards (full text + preview)
- [x] Integrate RichTextRenderer into Club post cards
- [x] Handle fallback for posts without richText field (plain text display)

## Formatting Toolbar & Inline Media Players (Phase 44)

### Formatting Toolbar in CreatePostModal
- [x] Add B/I/Link buttons above text input
- [x] Track selection range in TextInput
- [x] Apply bold/italic/link formatting to selected text
- [x] Generate richText blocks from formatted text on submit
- [x] Visual indicators for active formatting (highlighted buttons)

### Inline Media Players in Post Cards
- [x] Inline video player component (thumbnail + play button, tap to play inline)
- [x] Inline audio player component (waveform visualization, play/pause, progress)
- [x] Integrate players into PostMediaSection (already connected via existing dispatch)

## Bug Fixes

- [x] Fix ProfileSetup modal appearing repeatedly in Club tab when profile already set up (skip for admin + add dismiss button)

## About Me / Creative Journey Page (Phase 45)

- [x] Create about-me.tsx page in app/library/ with full article content
- [x] Carousel of 18 photos with paging dots at the top
- [x] 11 parts of text with titles, subtitles, and photos for each part
- [x] Navigation from library grid and home screen "узнать больше" button
- [x] Consistent styling with other library pages (EB Garamond, cream background, brown palette)

## About Me Page Enhancements (Phase 46)

- [x] Fullscreen photo viewer on tap (carousel and part photos)
- [x] Table of contents with quick navigation to each part
- [x] "Back to top" button at the end of the article
