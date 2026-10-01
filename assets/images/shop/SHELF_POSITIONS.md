# Shelf Position Analysis for shop_thin_shelves.png (1440x2560)

Image is 9:16 ratio (phone screen). The background has:
- Top area: dried herbs hanging on rope with clothespins + wicker basket on left
- Shelf 1 (top): thin plank at approximately 30% from top (y ~768px)
- Shelf 2 (middle): thin plank at approximately 50% from top (y ~1280px)  
- Shelf 3 (bottom): thin plank at approximately 68% from top (y ~1740px)
- Below shelf 3: drawers section with key and handles (bottom 30%)

For mobile screen (assuming ~844pt height on iPhone):
- Herbs/basket area: top 0-25%
- Shelf 1 surface: at ~30% from top
- Shelf 2 surface: at ~50% from top
- Shelf 3 surface: at ~68% from top
- Drawers: 70-100%

Books should be positioned so their bottom edges align with the shelf planks.
The background image will be used as a full-screen cover, so we need to calculate
the percentage positions of shelves relative to the full image height.

Key insight: The books should NOT scroll independently. Instead, the entire view
(background + books) should scroll together, with books positioned at fixed
positions relative to the background image.
