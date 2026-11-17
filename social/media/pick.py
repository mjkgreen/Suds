#!/usr/bin/env python3
"""Pick fresh photos for one post, matched to what its footage shows.

  pick.py slots <subject>                     the photo slots this subject's footage shows
  pick.py fetch <slot> "<query>" [n=6]        download candidates + a contact sheet to look at
  pick.py use <slot> <photo id> [<id> ...]    use these candidates for the slot (in order)
  pick.py clear                               forget this run's picks (back to library defaults)

Candidates and picks live in social/out/media/ (git-ignored). The seed reads
social/out/media/picks.json the next time the database is rebuilt, which
make_post.sh does. Unsplash needs the environment's network secret for
api.unsplash.com. If fetching fails, skip it: the library defaults are used.

Pick only photos that match the slot's drink and setting, with no clearly
visible faces, no readable brand logos, and nothing that looks like underage drinking.
Hands, crowds from behind or far away, and silhouettes are fine.
"""
import json, os, shutil, sys, urllib.parse, urllib.request
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out', 'media')
CAND, RUN = os.path.join(OUT, 'cand'), os.path.join(OUT, 'run')
PICKS = os.path.join(OUT, 'picks.json')
BASE = 'http://127.0.0.1:54321/storage/v1/object/public/drink-media/run/'
SLOTS = {s['slot']: s for s in json.load(open(os.path.join(HERE, 'slots.json')))['slots']}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Accept-Version': 'v1'}), timeout=30) as r:
        return r.read()


def fit45(path):
    """Centre-crop to the app's 4:5 media frame at 1080x1350."""
    im = Image.open(path).convert('RGB'); w, h = im.size
    tw, th = (w, int(w * 5 / 4)) if h / w > 1.25 else (int(h * 4 / 5), h)
    x, y = (w - tw) // 2, (h - th) // 2
    im.crop((x, y, x + tw, y + th)).resize((1080, 1350), Image.LANCZOS).save(path, quality=84)


def cmd_slots(subject):
    rows = [s for s in SLOTS.values() if subject in s['subjects']]
    print(json.dumps([{k: s[k] for k in ('slot', 'shows', 'query', 'count')} for s in rows], indent=1))


def cmd_fetch(slot, query, n=6):
    if slot not in SLOTS:
        sys.exit(f'unknown slot {slot}')
    d = os.path.join(CAND, slot); os.makedirs(d, exist_ok=True)
    q = urllib.parse.urlencode({'query': query, 'per_page': n, 'orientation': 'portrait', 'content_filter': 'high'})
    res = json.loads(get(f'https://api.unsplash.com/search/photos?{q}'))['results']
    sheet = Image.new('RGB', (len(res) * 250 or 250, 370), 'white'); dr = ImageDraw.Draw(sheet)
    for i, r in enumerate(res):
        meta = {'id': r['id'], 'query': query, 'description': r.get('alt_description'),
                'photographer': r['user']['name'], 'photographer_url': r['user']['links']['html'],
                'photo_url': r['links']['html'], 'download_location': r['links']['download_location'],
                'license': 'Unsplash License (https://unsplash.com/license)'}
        json.dump(meta, open(os.path.join(d, r['id'] + '.json'), 'w'), indent=1)
        p = os.path.join(d, r['id'] + '.jpg')
        open(p, 'wb').write(get(r['urls']['raw'] + '&w=1080&q=82&fm=jpg&fit=max'))
        fit45(p)
        im = Image.open(p); im.thumbnail((240, 300)); sheet.paste(im, (i * 250, 0)); dr.text((i * 250 + 4, 310), r['id'], fill='black')
    sp = os.path.join(d, 'sheet.jpg'); sheet.save(sp)
    print(json.dumps({'slot': slot, 'candidates': [r['id'] for r in res], 'sheet': os.path.abspath(sp)}))


def cmd_use(slot, ids):
    os.makedirs(RUN, exist_ok=True)
    picks = json.load(open(PICKS)) if os.path.exists(PICKS) else {}
    credits_p = os.path.join(OUT, 'credits.json')
    credits = json.load(open(credits_p)) if os.path.exists(credits_p) else {}
    items = []
    for pid in ids:
        src = os.path.join(CAND, slot, pid)
        meta = json.load(open(src + '.json'))
        try:
            get(meta.pop('download_location'))  # Unsplash API guideline: register the download
        except Exception:
            pass
        name = f'{slot}-{pid}.jpg'
        shutil.copy(src + '.jpg', os.path.join(RUN, name))
        items.append({'url': BASE + name, 'type': 'image', 'width': 1080, 'height': 1350})
        credits[name] = meta
    picks[slot] = items
    json.dump(picks, open(PICKS, 'w'), indent=1)
    json.dump(credits, open(credits_p, 'w'), indent=1)
    print(f'{slot}: {len(items)} photo(s) picked')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(2)
    if a[0] == 'slots': cmd_slots(a[1])
    elif a[0] == 'fetch': cmd_fetch(a[1], a[2], int(a[3]) if len(a) > 3 else 6)
    elif a[0] == 'use': cmd_use(a[1], a[2:])
    elif a[0] == 'clear': shutil.rmtree(OUT, ignore_errors=True); print('cleared')
    else: print(__doc__); sys.exit(2)
