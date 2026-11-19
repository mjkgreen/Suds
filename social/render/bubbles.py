"""Soap bubbles for Suds' orange backgrounds (feed still, reel end card).

Every full-frame amber background gets these, to match the App Store art.
The sprites in bubbles/ were cut from that art: white highlights with alpha,
so they sit on any shade of orange.

  layer = Bubbles(W, H, avoid=[(x0, y0, x1, y1), ...], seed=3)
  img.alpha_composite(layer.render())        # still
  img.alpha_composite(layer.render(frame=i))  # animated: bubbles rise slowly

`avoid` keeps bubbles out from behind text, logos and buttons (including
everywhere a rising bubble passes through while it's on screen).
"""
import glob, os, random
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
_SPRITES = None
SIZES = (0.03, 0.04, 0.05, 0.06, 0.07, 0.09, 0.12, 0.16)  # diameter, as a fraction of width


def _sprites():
    global _SPRITES
    if _SPRITES is None:
        _SPRITES = [Image.open(p).convert('RGBA') for p in sorted(glob.glob(os.path.join(HERE, 'bubbles', 'bubble-*.png')))]
        if not _SPRITES:
            raise FileNotFoundError('no bubble sprites in social/render/bubbles/')
    return _SPRITES


class Bubbles:
    def __init__(self, w, h, avoid=(), seed=1, count=None, rise=0.0, frames=0, margin=24):
        """rise: pixels per frame (0 = static). frames: how many frames it animates for."""
        self.w, self.h = w, h
        rnd = random.Random(seed)
        count = count or int(round(26 * (w * h) / (1080 * 1350)))
        travel = rise * frames
        sprites = _sprites()
        self.items, placed, tries = [], [], 0
        while len(self.items) < count and tries < 6000:
            tries += 1
            d = int(w * rnd.choice(SIZES))
            x = rnd.randint(-d // 3, w - 2 * d // 3)
            y = rnd.randint(-d // 3, h - 2 * d // 3)
            speed = rise * (0.6 + 0.8 * d / (w * max(SIZES)))  # big bubbles rise faster
            box = (x - margin, y - speed * frames - margin, x + d + margin, y + d + margin)
            if any(box[0] < a[2] and box[2] > a[0] and box[1] < a[3] and box[3] > a[1] for a in avoid):
                continue
            if any((x + d / 2 - px) ** 2 + (y + d / 2 - py) ** 2 < ((d + pd) / 2 + 16) ** 2 for px, py, pd in placed):
                continue
            placed.append((x + d / 2, y + d / 2, d))
            sprite = rnd.choice(sprites).resize((d, d), Image.LANCZOS)
            self.items.append((sprite, x, y, speed))

    def render(self, frame=0):
        layer = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for sprite, x, y, speed in self.items:
            yy = int(round(y - speed * frame))
            if yy + sprite.height <= 0 or yy >= self.h:  # risen out of frame
                continue
            if x >= 0 and yy >= 0:
                layer.alpha_composite(sprite, (x, yy))
            else:  # partly off the top/left edge
                layer.alpha_composite(sprite, (max(x, 0), max(yy, 0)), (max(-x, 0), max(-yy, 0)))
        return layer
