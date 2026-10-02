#!/usr/bin/env python3
"""Convert promo JPG (black background) to PNG with conservative alpha."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PROMO = ROOT / "assets" / "images" / "home" / "promo"
# Only remove near-pure black — keeps photo shadows and anti-aliased edges.
THRESHOLD = 6


def convert(src: Path, dst: Path, threshold: int = THRESHOLD) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (0, 0, 0, 0)
    im.save(dst, optimize=True)
    print(f"OK {dst.name} ({w}x{h}, threshold={threshold})")


def main() -> None:
    pairs = [
        ("promo-club-src.jpg", "promo-club.png"),
        ("promo-quiz-src.jpg", "promo-quiz.png"),
        ("promo-feed-src.jpg", "promo-feed.png"),
    ]
    for jpg_name, png_name in pairs:
        src = PROMO / jpg_name
        if not src.exists():
            raise SystemExit(f"Missing {src}")
        convert(src, PROMO / png_name)


if __name__ == "__main__":
    main()
