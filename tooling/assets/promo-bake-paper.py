#!/usr/bin/env python3
# Собирает промо-картинки поверх бумажной текстуры, чтобы прозрачность совпадала с фоном экрана. Это создание новых локальных вариантов.
"""Composite transparent promo PNGs onto the same paper texture as the home screen."""
from __future__ import annotations

from pathlib import Path

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
PROMO = ROOT / "assets" / "images" / "home" / "promo"
PAPER_URL = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg"
TARGET = (1024, 577)

PAIRS = [
    ("promo-club.png", "promo-club-paper.webp"),
    ("promo-quiz.png", "promo-quiz-paper.webp"),
    ("promo-feed.png", "promo-feed-paper.webp"),
]


def load_paper() -> Image.Image:
    cache = ROOT / ".tmp-yandex-promo" / "app-paper.jpg"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(requests.get(PAPER_URL, timeout=60).content)
    return ImageOps.fit(Image.open(cache).convert("RGB"), TARGET, method=Image.Resampling.LANCZOS)


def bake(src_name: str, dst_name: str, paper: Image.Image) -> None:
    src = PROMO / src_name
    if not src.exists():
        raise SystemExit(f"Missing {src}")
    overlay = Image.open(src).convert("RGBA")
    if overlay.size != TARGET:
        overlay = overlay.resize(TARGET, Image.Resampling.LANCZOS)
    out = paper.copy()
    out.paste(overlay, (0, 0), overlay)
    dst = PROMO / dst_name
    out.save(dst, "WEBP", quality=90, method=6)
    print(f"OK {dst_name} ({out.size[0]}x{out.size[1]})")


def main() -> None:
    paper = load_paper()
    for src, dst in PAIRS:
        bake(src, dst, paper)


if __name__ == "__main__":
    main()
