#!/usr/bin/env python3
"""Turn a captured timeline (social/capture) into a finished 1080x1920 reel.

  python3 compose.py <captureDir> <out.mp4> [--end-title ...] [--max-mb 2.8]

Does, per frame: an eased camera crop (pan/zoom that follows the action),
touch rings where real taps happened, the hook / caption overlays, then an
end card with the call to action. Adds a synthesized music bed (no licensed
audio) with soft taps and the Suds theme over the end card, and encodes under
the Drive upload cap.
"""
import argparse, json, math, os, shutil, subprocess, sys, tempfile
import numpy as np

import music
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bubbles import RisingBubbles

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FONT_DIR = '/usr/share/fonts/opentype/inter'
AMBER, AMBER_DARK, INK = (243, 156, 11), (245, 90, 7), (17, 24, 39)
END_FRAMES, FADE_FRAMES = 120, 8   # 4 s: the Suds theme (theme.py) plays over it
# Safe area: platform UI covers the bottom fifth and the right-edge buttons.
SAFE_X0, SAFE_X1, SAFE_BOTTOM = 70, W - 150, int(H * 0.8)


def font(weight, size):
    for name in (f'InterDisplay-{weight}.otf', f'Inter-{weight}.otf'):
        p = os.path.join(FONT_DIR, name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def smooth_cameras(frames, alpha=0.085):
    """Critically-damped-ish easing of camera targets; snaps at scene cuts."""
    out, cur, scene = [], None, None
    for f in frames:
        tgt = np.array([f['cam']['cx'], f['cam']['cy'], f['cam']['z']], dtype=float)
        if cur is None or f['scene'] != scene:
            cur, vel, scene = tgt.copy(), np.zeros(3), f['scene']
        else:
            # spring toward target: smooth start and stop, no overshoot
            k = alpha
            vel = vel * (1 - 2 * math.sqrt(k)) + (tgt - cur) * k
            cur = cur + vel
        out.append(cur.copy())
    return out


def crop_box(cam, meta, scale):
    vw = meta['viewport']['width']
    top = meta['topCrop']
    vh = meta['viewport']['height'] - top
    z = max(1.0, cam[2])
    w, h = vw / z, vh / z
    cx = min(max(cam[0], w / 2), vw - w / 2)
    cy = min(max(cam[1], top + h / 2), top + vh - h / 2)
    x0, y0 = cx - w / 2, cy - h / 2
    return (x0, y0, w, h), (x0 * scale, y0 * scale, (x0 + w) * scale, (y0 + h) * scale)


def wrap_lines(text):
    return text.split('\n')


_HOOK_BUBBLES = {}


def hook_bubbles(bw, bh, text, lines, f, pad_x, pad_y, lh):
    key = (bw, bh, text)
    if key not in _HOOK_BUBBLES:
        d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
        fade = []
        for i, l in enumerate(lines):  # each text line's box, inside the card
            lw = d.textlength(l, font=f)
            y0 = pad_y + i * lh
            fade.append(((bw - lw) / 2, y0, (bw + lw) / 2, y0 + f.size))
        _HOOK_BUBBLES[key] = RisingBubbles(bw, bh, sizes=(18, max(30, int(bh * 0.5))), count=max(8, bw * bh // 8000),
                                           seed=sum(map(ord, text)), speed=3.0, fade=fade, behind=0.35, opacity=0.9, wobble=3)
    return _HOOK_BUBBLES[key]


def draw_overlay(img, ov, age, life_left, band_y=None):
    """Hook: big amber card centred high. Caption: dark pill near the top."""
    if not ov:
        return
    hook = ov.get('style') == 'hook'
    lines = wrap_lines(ov['text'])
    d = ImageDraw.Draw(img)
    size = 88 if hook else 62
    max_w = (SAFE_X1 - SAFE_X0) - (108 if hook else 80)
    while True:  # shrink long lines to fit inside the safe area
        f = font('ExtraBold', size)
        if size <= 40 or max(d.textlength(l, font=f) for l in lines) <= max_w:
            break
        size -= 4
    lh = int(f.size * 1.18)
    tw = max(d.textlength(l, font=f) for l in lines)
    pad_x, pad_y = (54, 40) if hook else (40, 26)
    bw, bh = tw + 2 * pad_x, lh * len(lines) + 2 * pad_y - int(f.size * 0.18)
    cx = (SAFE_X0 + SAFE_X1) / 2 + 40
    cy = (band_y if band_y is not None else H * (0.30 if hook else 0.155)) + bh / 2
    # pop in / fade out
    t_in = ease(age / 7)
    t_out = ease(life_left / 6) if life_left is not None else 1
    s = (0.86 + 0.14 * t_in)
    alpha = min(t_in, t_out)
    if alpha <= 0:
        return
    layer = Image.new('RGBA', (int(bw) + 80, int(bh) + 80), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    bg = AMBER + (255,) if hook else (17, 24, 39, 235)
    shadow = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((40, 48, 40 + bw, 48 + bh), radius=36, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    layer.alpha_composite(shadow)
    ld.rounded_rectangle((40, 40, 40 + bw, 40 + bh), radius=36, fill=bg)
    if hook:  # small bubbles rising inside the amber card, faint behind the words
        rb = hook_bubbles(int(bw), int(bh), ov['text'], lines, f, pad_x, pad_y, lh)
        inner = rb.render(age)
        m = Image.new('L', inner.size, 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, inner.width - 1, inner.height - 1), radius=36, fill=255)
        inner.putalpha(Image.fromarray(np.minimum(np.array(inner.getchannel('A')), np.array(m))))
        layer.alpha_composite(inner, (40, 40))
    color = (255, 255, 255, 255)
    for i, l in enumerate(lines):
        lw = ld.textlength(l, font=f)
        ld.text((40 + (bw - lw) / 2, 40 + pad_y + i * lh - int(f.size * 0.1)), l, font=f, fill=color)
    if s != 1:
        layer = layer.resize((int(layer.width * s), int(layer.height * s)), Image.LANCZOS)
    if alpha < 1:
        a = np.array(layer)
        a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        layer = Image.fromarray(a)
    x = int(cx - layer.width / 2)
    x = max(SAFE_X0 - 40, min(x, SAFE_X1 + 40 - layer.width))
    img.alpha_composite(layer, (x, int(cy - layer.height / 2)))


def draw_taps(img, taps):
    d = ImageDraw.Draw(img)
    for (x, y, age) in taps:
        t = age / 10
        r = 34 + 46 * ease(t)
        a = int(200 * (1 - t))
        if a <= 0:
            continue
        d.ellipse((x - r, y - r, x + r, y + r), outline=(17, 24, 39, a), width=7)
        if age < 7:
            d.ellipse((x - 30, y - 30, x + 30, y + 30), fill=(17, 24, 39, int(90 * (1 - age / 7))))


_END_BUBBLES = {}
_LOGOS = {}


def glass_logo(size):
    """The Suds glass with its amber square keyed out, so whatever is behind it shows through.

    assets/Suds.png is two flat colours (amber background, orange glass) plus
    antialiased edges between them; green separates them, so it sets the alpha.
    """
    if size not in _LOGOS:
        rgb = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'Suds.png')).convert('RGB')).astype(np.float32)
        alpha = np.clip((158 - rgb[..., 1]) / (158 - 84), 0, 1)
        out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
        out[..., :3] = (247, 84, 5)
        out[..., 3] = (alpha * 255).round().astype(np.uint8)
        _LOGOS[size] = Image.fromarray(out, 'RGBA').resize((size, size), Image.LANCZOS)
    return _LOGOS[size]


def end_bubbles(n, title, cta, url):
    """Bubbles rising through the end card; they fade behind the wordmark, title, button and URL (not the see-through logo)."""
    key = (n, title, cta, url)
    if key not in _END_BUBBLES:
        d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
        cx = W / 2 - 30
        def box(width, y0, y1):  # y ranges include the 40px slide-in
            return (cx - width / 2, y0, cx + width / 2, y1 + 40)
        # No box for the logo: it's see-through, so bubbles stay visible around and inside the glass.
        avoid = [box(d.textlength('Suds', font=font('Black', 120)), 730, 880)]
        lines = title.split('\n')
        avoid.append(box(max(d.textlength(l, font=font('Bold', 64)) for l in lines), 900, 900 + 80 * len(lines)))
        avoid.append(box(d.textlength(cta, font=font('ExtraBold', 54)) + 110, 1130, 1130 + 120))
        avoid.append(box(d.textlength(url, font=font('SemiBold', 44)), 1130 + 120 + 40, 1130 + 120 + 40 + 60))
        _END_BUBBLES[key] = RisingBubbles(W, H, sizes=(32, 175), count=30, seed=11, speed=11, fade=avoid)
    return _END_BUBBLES[key]


def end_card(i, n, title, cta, url):
    img = Image.new('RGBA', (W, H), AMBER + (255,))
    img.alpha_composite(end_bubbles(n, title, cta, url).render(i))
    d = ImageDraw.Draw(img)
    t = ease(i / 10)
    y_off = int(40 * (1 - t))
    img.alpha_composite(glass_logo(360), ((W - 360) // 2 - 30, 330 + y_off))
    f1 = font('Black', 120)
    word = 'Suds'
    d.text(((W - d.textlength(word, font=f1)) / 2 - 30, 730 + y_off), word, font=f1, fill=INK)
    f2 = font('Bold', 64)
    for k, line in enumerate(title.split('\n')):
        d.text(((W - d.textlength(line, font=f2)) / 2 - 30, 900 + k * 80 + y_off), line, font=f2, fill=INK)
    t2 = ease((i - 8) / 10)
    if t2 > 0:
        f3 = font('ExtraBold', 54)
        tw = d.textlength(cta, font=f3)
        bw, bh = tw + 110, 120
        x0, y0 = (W - bw) / 2 - 30, 1130 + int(30 * (1 - t2))
        d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), radius=60, fill=INK)
        d.text((x0 + 55, y0 + 28), cta, font=f3, fill=(255, 255, 255))
        f4 = font('SemiBold', 44)
        d.text(((W - d.textlength(url, font=f4)) / 2 - 30, y0 + bh + 40), url, font=f4, fill=INK)
    return img


def encode(frames_dir, wav, out, max_mb, duration):
    audio_k = 96
    base = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames_dir, '%05d.jpg'),
            '-i', wav, '-map', '0:v', '-map', '1:a', '-af', 'lowpass=f=11000', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
            '-preset', 'slow', '-c:a', 'aac', '-b:a', f'{audio_k}k', '-shortest', '-movflags', '+faststart']
    for crf in (23, 25, 27):
        subprocess.run(base + ['-crf', str(crf), out], check=True)
        if os.path.getsize(out) <= max_mb * 1e6:
            return f'crf {crf}'
    # two-pass to a bitrate that fits, audio budget taken out
    kbps = int(max_mb * 8e3 / duration * 0.97) - audio_k
    tmp = tempfile.mkdtemp()
    src = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames_dir, '%05d.jpg')]
    venc = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-preset', 'slow',
            '-b:v', f'{kbps}k', '-passlogfile', os.path.join(tmp, 'p')]
    subprocess.run(src + venc + ['-pass', '1', '-an', '-f', 'mp4', os.devnull], check=True)
    subprocess.run(src + ['-i', wav, '-map', '0:v', '-map', '1:a'] + venc +
                   ['-af', 'lowpass=f=11000', '-c:a', 'aac', '-b:a', f'{audio_k}k', '-shortest', '-movflags', '+faststart', '-pass', '2', out], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    return f'two-pass {kbps}k'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('capture'); ap.add_argument('out')
    ap.add_argument('--end-title', default='Track your drinks.\nKnow your limits.')
    ap.add_argument('--cta', default='Free on the App Store')
    ap.add_argument('--url', default='drink-with-suds.com')
    ap.add_argument('--max-mb', type=float, default=2.8)
    ap.add_argument('--keep', action='store_true', help='keep rendered frames next to the output')
    ap.add_argument('--music', default='random', help='music style (see music.STYLES) or random')
    ap.add_argument('--music-seed', type=int, default=None, help='seed for key/tempo/progression (default: random)')
    a = ap.parse_args()

    tl = json.load(open(os.path.join(a.capture, 'timeline.json')))
    frames = tl['frames']
    first = Image.open(os.path.join(a.capture, frames[0]['file']))
    scale = first.width / tl['viewport']['width']
    cams = smooth_cameras(frames)
    work = tempfile.mkdtemp(prefix='compose-')
    out_frames = os.path.join(work, 'f'); os.makedirs(out_frames)

    # overlay ages: frames since it appeared / until it changes
    ov_key = [json.dumps(f['overlay'], sort_keys=True) if f['overlay'] else None for f in frames]
    starts, ends = [], []
    for i in range(len(frames)):
        starts.append(i if i == 0 or ov_key[i] != ov_key[i - 1] else starts[-1])
    nxt = len(frames) + END_FRAMES  # last overlay fades into the end card
    for i in range(len(frames) - 1, -1, -1):
        if i < len(frames) - 1 and ov_key[i] != ov_key[i + 1]:
            nxt = i + 1
        ends.append(nxt)
    ends.reverse()

    # Captions go in whichever band stays clear of the focused element over
    # the caption's whole life (top band preferred).
    BANDS = [H * 0.12, H * 0.60, H * 0.40]
    band_for = {}
    def focus_rect(i):
        f = frames[i]
        if not f.get('focus'):
            return None
        (x0, y0, cw, ch), _ = crop_box(cams[i], tl, scale)
        b = f['focus']
        return ((b['x'] - x0) / cw * W, (b['y'] - y0) / ch * H, (b['x'] + b['w'] - x0) / cw * W, (b['y'] + b['h'] - y0) / ch * H)
    for i in range(len(frames)):
        if starts[i] != i or not frames[i]['overlay'] or frames[i]['overlay'].get('style') == 'hook':
            continue
        end = min(ends[i], len(frames))
        at = frames[i]['overlay'].get('at')
        if isinstance(at, (int, float)):          # explicit height, as a fraction of the frame
            band_for[i] = H * at
            continue
        if at == 'above-focus':
            # sit just above the focused element once the camera has settled
            j = min(end - 1, i + 15)
            r = focus_rect(j)
            if r:
                n_lines = frames[i]['overlay']['text'].count('\n') + 1
                bh = 73 * n_lines + 52
                y = r[1] - 36 - bh
                if y < H * 0.05:
                    y = r[3] + 36
                band_for[i] = min(y, SAFE_BOTTOM - bh)
                continue
        best = None
        for by in BANDS:
            top, bot = by - 10, by + 200
            hit = 0
            for j in range(i, end):
                r = focus_rect(j)
                if r and r[1] < bot and r[3] > top:
                    hit += 1
            if best is None or hit < best[0]:
                best = (hit, by)
        band_for[i] = best[1]

    taps, tap_times, last = [], [], None
    for i, f in enumerate(frames):
        src = Image.open(os.path.join(a.capture, f['file'])).convert('RGB')
        (x0, y0, cw, ch), box = crop_box(cams[i], tl, scale)
        img = src.resize((W, H), Image.LANCZOS, box=box).convert('RGBA')
        if f.get('tap'):
            taps.append([f['tap']['x'], f['tap']['y'], 0, f['scene']])
            tap_times.append(i / FPS)
        live = []
        for tp in taps:
            if tp[3] == f['scene'] and tp[2] < 11:
                px = (tp[0] - x0) / cw * W
                py = (tp[1] - y0) / ch * H
                live.append((px, py, tp[2]))
            tp[2] += 1
        draw_taps(img, live)
        left = ends[i] - i if ends[i] < len(frames) else None
        draw_overlay(img, f['overlay'], i - starts[i], left, band_for.get(starts[i]))
        last = img
        img.convert('RGB').save(os.path.join(out_frames, f'{i:05d}.jpg'), quality=94)
    n = len(frames)
    for k in range(END_FRAMES):
        card = end_card(k, END_FRAMES, a.end_title, a.cta, a.url)
        if k < FADE_FRAMES:
            card = Image.blend(last, card, ease((k + 1) / FADE_FRAMES))
        card.convert('RGB').save(os.path.join(out_frames, f'{n + k:05d}.jpg'), quality=94)
    total = n + END_FRAMES
    duration = total / FPS
    wav = os.path.join(work, 'music.wav')
    seed = a.music_seed if a.music_seed is not None else int(np.random.default_rng().integers(1, 2**31))
    sig = music.make(a.music, duration, tap_times, wav, seed, outro_at=n / FPS)
    json.dump(sig, open(os.path.splitext(a.out)[0] + '.music.json', 'w'))
    how = encode(out_frames, wav, a.out, a.max_mb, duration)
    size = os.path.getsize(a.out) / 1e6
    print(json.dumps({'out': a.out, 'seconds': round(duration, 2), 'frames': total, 'mb': round(size, 2), 'encode': how, 'music': sig}))
    if a.keep:
        shutil.copytree(out_frames, a.out + '.frames', dirs_exist_ok=True)
    shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
