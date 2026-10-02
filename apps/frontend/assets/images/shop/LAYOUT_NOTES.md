# Layout Positioning Notes - UPDATED

## Current State (after v10 update)

The layout is working well! Key observations from the web preview (1280px wide viewport):

1. The shelf v10 background loads correctly and fills the full width
2. The 3 physical books (Книга Вдохновения, Романтика Дачи, Тропинка к Творчеству) are positioned on the SECOND shelf (below herbs/basket section) - they sit correctly on the plank
3. The 2 digital products (Пособие по фотографии, Мастер-класс) are positioned on the THIRD shelf with the pouch on the left - correctly offset to the right
4. The drawers section is visible at the bottom
5. The footer text "Доставка по всей России через маркетплейсы" appears below the shelf
6. Scrolling works (the content is taller than viewport)

## Issues to Address

1. The digital products are slightly too large relative to the shelf space - they extend a bit above the shelf area. Consider reducing their size slightly or adjusting the bottom position.
2. The price tags (book title labels) overlap slightly with the shelf plank below on the physical books row.
3. On desktop (1280px), the books are quite large. On mobile (390px), they'll be proportionally smaller which should look better.

## Shelf Plank Positions (as % of image height, measured from v10 at 941x1672):
- First plank bottom: ~29.5% (separates herbs from books section)
- Second plank bottom: ~53.5% (separates books from digital section)  
- Third plank bottom: ~72% (separates digital from small pouch section)
- Fourth section (drawers): starts at ~82%

## Current Code Values
- SHELF2_PLANK_BOTTOM = 0.535 (books bottom aligned here)
- SHELF3_PLANK_BOTTOM = 0.72 (digital products bottom aligned here)
- Digital products have paddingLeft: 60 to offset from the pouch on the left
