#!/usr/bin/env python3
"""Build the stock-photo library used as drink photos in the demo seed.

  unsplash.py search <out_dir> "<query>" [n]   download n candidates + a contact sheet to review
  unsplash.py keep <cand_dir> <id> <name>       copy a reviewed candidate into the library

The key is injected by the environment's network secret (Authorization:
Client-ID ...), so nothing here holds a credential. Photos are used under the
Unsplash License (free for commercial use); credits.json records each one.
Only keep photos with no recognisable people.
"""
import json, os, shutil, sys, urllib.parse, urllib.request
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, 'library')
API = 'https://api.unsplash.com'


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Accept-Version': 'v1'}), timeout=30) as r:
        return r.read()


def search(out, query, n=6):
    os.makedirs(out, exist_ok=True)
    q = urllib.parse.urlencode({'query': query, 'per_page': n, 'orientation': 'portrait', 'content_filter': 'high'})
    res = json.loads(get(f'{API}/search/photos?{q}'))['results']
    thumbs = []
    for r in res:
        meta = {'id': r['id'], 'query': query, 'description': r.get('alt_description'),
                'photographer': r['user']['name'], 'photographer_url': r['user']['links']['html'],
                'photo_url': r['links']['html'], 'download_location': r['links']['download_location'],
                'raw': r['urls']['raw'], 'license': 'Unsplash License (https://unsplash.com/license)'}
        json.dump(meta, open(os.path.join(out, r['id'] + '.json'), 'w'), indent=1)
        p = os.path.join(out, r['id'] + '.jpg')
        open(p, 'wb').write(get(r['urls']['raw'] + '&w=1080&q=82&fm=jpg&fit=max'))
        thumbs.append((r['id'], p))
    sheet = Image.new('RGB', (6 * 250, 360), 'white')
    d = ImageDraw.Draw(sheet)
    for i, (pid, p) in enumerate(thumbs[:6]):
        im = Image.open(p); im.thumbnail((240, 330)); sheet.paste(im, (i * 250, 0)); d.text((i * 250 + 4, 340), pid, fill='black')
    sheet.save(os.path.join(out, 'sheet-' + query.replace(' ', '_') + '.jpg'))
    print(json.dumps([t[0] for t in thumbs]))


def keep(cand, pid, name):
    os.makedirs(LIB, exist_ok=True)
    meta = json.load(open(os.path.join(cand, pid + '.json')))
    get(meta['download_location'])  # Unsplash API guideline: register the download
    shutil.copy(os.path.join(cand, pid + '.jpg'), os.path.join(LIB, name + '.jpg'))
    credits_path = os.path.join(LIB, 'credits.json')
    credits = json.load(open(credits_path)) if os.path.exists(credits_path) else {}
    meta.pop('download_location'); meta.pop('raw')
    credits[name + '.jpg'] = meta
    json.dump(credits, open(credits_path, 'w'), indent=1, sort_keys=True)
    print('kept', name)


if __name__ == '__main__':
    if sys.argv[1] == 'search':
        search(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 6)
    else:
        keep(sys.argv[2], sys.argv[3], sys.argv[4])
