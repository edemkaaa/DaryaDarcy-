#!/usr/bin/env python3
# Формирует непрозрачный WebP на кремовом фоне приложения, устраняя чёрные ореолы от неверной обработки прозрачности.
"""Build flat promo WebP on app cream background — no PNG alpha / black halos."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PROMO = ROOT / "assets" / "images" / "home" / "promo"
CREAM = (253, 248, 240)
BLACK_CUT = 18
BLACK_FEATHER = 22


def replace_black_background(im: Image.Image) -> Image.Image:
    # Заменяет почти чёрный фон на кремовый с мягким переходом, чтобы не оставить резкий чёрный край.
    out = im.convert("RGB")
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            m = max(r, g, b)
            if m <= BLACK_CUT:
                px[x, y] = CREAM
            elif m <= BLACK_CUT + BLACK_FEATHER:
                t = (m - BLACK_CUT) / BLACK_FEATHER
                px[x, y] = tuple(
                    int(CREAM[i] * (1 - t) + channel * t) for i, channel in enumerate((r, g, b))
                )
    return out


def save_webp(im: Image.Image, dst: Path) -> None:
    # Создаёт каталог назначения и сохраняет отдельную непрозрачную WebP-копию с выбранным quality.
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=88, method=6)
    print(f"OK {dst.name} ({im.size[0]}x{im.size[1]})")


def main() -> None:
    # Обрабатывает только согласованные промо-пары; остальные локальные изображения не обходятся.
    pairs = [
        ("promo-club-src.jpg", "promo-club-flat.webp"),
        ("promo-quiz-src.jpg", "promo-quiz-flat.webp"),
        ("promo-feed-src.jpg", "promo-feed-flat.webp"),
    ]
    for src_name, dst_name in pairs:
        src = PROMO / src_name
        if not src.exists():
            raise SystemExit(f"Missing {src}")
        save_webp(replace_black_background(Image.open(src)), PROMO / dst_name)


if __name__ == "__main__":
    main()
