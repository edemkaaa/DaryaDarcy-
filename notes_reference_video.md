# Reference: shopslowsunday.com video implementation

The site uses a standard HTML5 video element with these key attributes:
- `playsinline="true"` — critical for iOS (prevents fullscreen)
- `autoplay="autoplay"` — auto-starts
- `loop="loop"` — loops infinitely
- `muted="muted"` — muted (required for autoplay on mobile)
- `preload="metadata"` — only loads metadata initially
- `poster` — poster image for instant display
- Source: MP4 (H.264), 1080p, 7.2Mbps — quite large!
- Type: video/mp4

Key insight: This is a WEB site using standard HTML5 video. For our Expo app:
- On WEB: We can use the same HTML5 video approach (already works)
- On NATIVE (iOS/Android): We need expo-video or expo-av

The previous crash was likely caused by expo-video import issues, not the video itself.

## Strategy
1. Use HTML5 video for web (Platform.OS === 'web') — this already worked
2. For native: Try expo-av (Audio.Video) instead of expo-video — it's more mature and stable
3. Optimize video: reduce to 720p, lower bitrate for mobile
4. Key: playsinline + muted + autoplay + loop
