#!/usr/bin/env python3
"""Generate App Store marketing screenshots (1284x2778) from raw app captures.

Composites each screenshot into a device frame on a Suds-branded background
with headline/subhead marketing copy, sized for Apple's 6.7" portrait slot.

Usage:
    pip install Pillow
    python3 scripts/generate_app_store_screenshots.py

Edit SHOTS below to change which screenshots are used and their copy.
Fonts: Inter (700/800/500) is downloaded to .cache/fonts on first run;
falls back to DejaVu Sans if offline.
"""

import io
import os
import re
import urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT_DIR = os.path.join(ASSETS, "app-store")
FONT_CACHE = os.path.join(ROOT, ".cache", "fonts")

CANVAS = (1284, 2778)  # Apple 6.7" portrait

# Brand colors sampled from the app UI
ORANGE = (233, 163, 59)        # #E9A33B — Suds accent
GRADIENT_TOP = (244, 181, 77)
GRADIENT_BOTTOM = (209, 122, 26)
INK = (26, 15, 2)              # near-black warm ink for headlines
INK_SOFT = (61, 38, 10)        # subheads
BEZEL = (16, 16, 18)

SHOTS = [
    {
        "src": "feed.png",
        "out": "01-feed.png",
        "headline": "See what your\ncrew is drinking",
        "subhead": "Nights out, rounds, and ratings —\nall in one live feed.",
    },
    {
        "src": "map.png",
        "out": "02-map.png",
        "headline": "Every round,\non the map",
        "subhead": "Hold anywhere to drop a drink and\ntrace the night’s route.",
    },
    {
        "src": "view-stats.png",
        "out": "03-stats.png",
        "headline": "Know your pace",
        "subhead": "Weekly limits, streaks, and trends\nthat keep you honest.",
    },
]

INTER_WEIGHTS = {"800": None, "500": None}


def _download_inter(weight: str, dest: str) -> bool:
    try:
        css_url = f"https://fonts.googleapis.com/css2?family=Inter:wght@{weight}"
        req = urllib.request.Request(css_url, headers={"User-Agent": "Mozilla/5.0"})
        css = urllib.request.urlopen(req, timeout=30).read().decode()
        m = re.search(r"https://fonts\.gstatic\.com[^)]+", css)
        if not m:
            return False
        data = urllib.request.urlopen(m.group(0), timeout=30).read()
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(data)
        return True
    except Exception:
        return False


def load_font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    path = os.path.join(FONT_CACHE, f"Inter-{weight}.ttf")
    if not os.path.exists(path):
        if not _download_inter(weight, path):
            return ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
                if int(weight) >= 700
                else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                size,
            )
    return ImageFont.truetype(path, size)


def gradient_bg(size) -> Image.Image:
    w, h = size
    bg = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        bg.putpixel(
            (0, y),
            tuple(
                round(GRADIENT_TOP[i] + (GRADIENT_BOTTOM[i] - GRADIENT_TOP[i]) * t)
                for i in range(3)
            ),
        )
    return bg.resize((w, h))


def rounded_mask(size, radius: int) -> Image.Image:
    mask = Image.new("L", (size[0] * 2, size[1] * 2), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size[0] * 2 - 1, size[1] * 2 - 1], radius * 2, fill=255)
    return mask.resize(size, Image.LANCZOS)


def draw_centered(draw, canvas_w, y, text, font, fill, line_gap=12):
    for line in text.split("\n"):
        box = draw.textbbox((0, 0), line, font=font)
        lw, lh = box[2] - box[0], box[3] - box[1]
        draw.text(((canvas_w - lw) / 2 - box[0], y - box[1]), line, font=font, fill=fill)
        y += lh + line_gap
    return y


def compose(shot) -> Image.Image:
    canvas = gradient_bg(CANVAS).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    w, _ = CANVAS

    wordmark_font = load_font("800", 58)
    headline_font = load_font("800", 108)
    subhead_font = load_font("500", 47)

    y = draw_centered(draw, w, 118, "Suds", wordmark_font, INK)
    y = draw_centered(draw, w, y + 52, shot["headline"], headline_font, INK, line_gap=18)
    draw_centered(draw, w, y + 34, shot["subhead"], subhead_font, INK_SOFT, line_gap=14)

    # Device frame, bleeding off the bottom edge
    shot_img = Image.open(os.path.join(ASSETS, shot["src"])).convert("RGB")
    screen_w = 1016
    screen_h = round(shot_img.height * screen_w / shot_img.width)
    shot_img = shot_img.resize((screen_w, screen_h), Image.LANCZOS)

    bezel_pad, screen_radius = 26, 118
    dev_w, dev_h = screen_w + bezel_pad * 2, screen_h + bezel_pad * 2
    dev_x, dev_y = (w - dev_w) // 2, 742

    # Soft shadow
    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [dev_x - 8, dev_y + 8, dev_x + dev_w + 8, dev_y + dev_h],
        screen_radius + bezel_pad,
        fill=(40, 18, 0, 130),
    )
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(38)))

    device = Image.new("RGBA", (dev_w, dev_h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(device)
    dd.rounded_rectangle([0, 0, dev_w - 1, dev_h - 1], screen_radius + bezel_pad, fill=BEZEL + (255,))
    screen = Image.new("RGBA", (screen_w, screen_h), (0, 0, 0, 0))
    screen.paste(shot_img, (0, 0))
    screen.putalpha(rounded_mask((screen_w, screen_h), screen_radius))
    device.alpha_composite(screen, (bezel_pad, bezel_pad))

    canvas.alpha_composite(device, (dev_x, dev_y))
    return canvas.convert("RGB")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for shot in SHOTS:
        img = compose(shot)
        assert img.size == CANVAS, img.size
        out = os.path.join(OUT_DIR, shot["out"])
        img.save(out, optimize=True)
        print(f"wrote {out} {img.size}")


if __name__ == "__main__":
    main()
