#!/usr/bin/env python3
"""Feed still (1080x1350): brand header + headline over a real app screenshot.

  python3 still.py <captureDir> <out.jpg> [--headline "..."]

<captureDir> is what `capture/run.js <subject> still` wrote (app.png + still.json).
"""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFilter

from compose import font, AMBER, INK, ROOT
from bubbles import Bubbles

W, H = 1080, 1350
CARD_W = 860


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('capture'); ap.add_argument('out')
    ap.add_argument('--headline')
    a = ap.parse_args()
    meta = json.load(open(os.path.join(a.capture, 'still.json')))
    headline = a.headline or meta['headline']
    app = Image.open(os.path.join(a.capture, 'app.png')).convert('RGB')
    card_h = int(CARD_W * app.height / app.width)
    app = app.resize((CARD_W, card_h), Image.LANCZOS)

    # layout first, so the bubbles can stay out from behind the text and the card
    f = font('Black', 76)
    lines = headline.split('\n')
    y = 168 + 86 * len(lines)
    top = max(y + 24, H - card_h - 50)
    if top + card_h > H - 30:  # long headline: shrink the card to fit
        card_h2 = H - 30 - top
        app = app.resize((int(CARD_W * card_h2 / card_h), card_h2), Image.LANCZOS)
        card_h = card_h2

    img = Image.new('RGBA', (W, H), AMBER + (255,))
    d = ImageDraw.Draw(img)
    cx0 = (W - app.width) // 2
    avoid = [(110, 58, 204 + d.textlength('Suds', font=font('Black', 56)), 134),
             (110, 168, 110 + max(d.textlength(l, font=f) for l in lines), y),
             (cx0, top, cx0 + app.width, H)]
    img.alpha_composite(Bubbles(W, H, avoid=avoid, seed=sum(map(ord, headline))).render())
    # brand mark
    logo = Image.open(os.path.join(ROOT, 'assets', 'Suds.png')).convert('RGBA').resize((76, 76), Image.LANCZOS)
    m = Image.new('L', logo.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, 75, 75), radius=18, fill=255)
    img.paste(logo, (110, 58), m)
    d.text((204, 66), 'Suds', font=font('Black', 56), fill=INK)
    # headline
    for k, line in enumerate(lines):
        d.text((110, 168 + 86 * k), line, font=f, fill=INK)
    # card with shadow, rounded corners
    cw = app.width
    x = (W - cw) // 2
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x, top + 14, x + cw, top + card_h + 14), radius=44, fill=(0, 0, 0, 80))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
    mask = Image.new('L', app.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, card_h - 1), radius=40, fill=255)
    img.paste(app, (x, top), mask)
    img.convert('RGB').save(a.out, quality=92)
    print(json.dumps({'out': a.out, 'kb': os.path.getsize(a.out) // 1024}))


if __name__ == '__main__':
    main()
