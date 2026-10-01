# Parallax Effect Implementation Notes

- TypeScript error fixed: `</ScrollView>` → `</Animated.ScrollView>` at line 341
- Hero overlay changed from static `rgba(30,45,30,0.45)` to animated opacity (0.25 → 0.6 on scroll)
- Parallax image: translateY + scale interpolation based on scrollY
- Hero text content fades out and moves up as user scrolls
- Season badge also fades with scroll
- All 44 tests passing
- TypeScript: no errors
- Screenshot looks good: hero image with DARYADARCY title, overlay, season badge visible
