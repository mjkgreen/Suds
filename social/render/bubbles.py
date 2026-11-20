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


class RisingBubbles:
    """Bubbles that float up through the frame and loop, for video.

      rb = RisingBubbles(W, H, sizes=(30, 160), seed=3, fade=[(x0, y0, x1, y1), ...])
      img.alpha_composite(rb.render(frame))

    speed: pixels per frame for the biggest bubble (small ones rise slower).
    fade: boxes (text, logos, buttons) a bubble fades out behind, down to
    `behind` opacity, so the words stay readable.
    opacity: overall strength (lower it on small cards with white text).
    """

    def __init__(self, w, h, sizes=(30, 170), count=None, seed=1, speed=9.0,
                 fade=(), behind=0.12, opacity=1.0, wobble=6.0):
        import math
        self.w, self.h, self.fade, self.behind, self.opacity = w, h, list(fade), behind, opacity
        rnd = random.Random(seed)
        sprites = _sprites()
        count = count or max(4, int(round(30 * (w * h) / (1080 * 1920))))
        lo, hi = sizes
        self.items = []
        for k in range(count):
            # more small bubbles than big ones
            d = int(lo + (hi - lo) * rnd.random() ** 2.2)
            x = rnd.uniform(-d * 0.3, w - d * 0.7)
            y = rnd.uniform(-d, h)
            sp = speed * (0.45 + 0.55 * (d - lo) / max(1, hi - lo)) * rnd.uniform(0.85, 1.15)
            self.items.append(dict(s=rnd.choice(sprites).resize((d, d), Image.LANCZOS), d=d, x=x, y=y,
                                   sp=sp, ph=rnd.uniform(0, 2 * math.pi), fr=rnd.uniform(0.04, 0.09),
                                   amp=wobble * rnd.uniform(0.5, 1.0) * d / hi))
        self._math = math

    def _alpha(self, x, y, d):
        a = self.opacity
        for (x0, y0, x1, y1) in self.fade:
            ox = max(0, min(x + d, x1) - max(x, x0)); oy = max(0, min(y + d, y1) - max(y, y0))
            frac = (ox * oy) / (d * d)
            if frac > 0:
                a = min(a, self.opacity * (1 - (1 - self.behind) * min(1, frac * 1.6)))
        return a

    def render(self, frame):
        layer = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        span = self.h + 2 * max(b['d'] for b in self.items)
        for b in self.items:
            d = b['d']
            y = (b['y'] - b['sp'] * frame + d) % span - d   # loop back in below the bottom
            x = b['x'] + b['amp'] * self._math.sin(b['ph'] + b['fr'] * frame)
            xi, yi = int(round(x)), int(round(y))
            if yi + d <= 0 or yi >= self.h or xi + d <= 0 or xi >= self.w:
                continue
            a = self._alpha(xi, yi, d)
            if a <= 0.01:
                continue
            s = b['s']
            if a < 0.999:
                s = s.copy(); s.putalpha(s.getchannel('A').point(lambda v: int(v * a)))
            layer.alpha_composite(s, (max(xi, 0), max(yi, 0)), (max(-xi, 0), max(-yi, 0)))
        return layer
