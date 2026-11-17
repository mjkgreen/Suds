#!/usr/bin/env python3
"""Emit SQL defining stock_media(name) -> DrinkMedia jsonb for the seed, from social/media/library."""
import os, subprocess, json
from PIL import Image
LIB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media', 'library')
BASE = 'http://127.0.0.1:54321/storage/v1/object/public/drink-media/stock/'
rows = []
for f in sorted(os.listdir(LIB)):
    name, ext = os.path.splitext(f)
    if ext == '.jpg' and not name.endswith('-poster'):
        w, h = Image.open(os.path.join(LIB, f)).size
        rows.append((name, {'url': BASE + f, 'type': 'image', 'width': w, 'height': h}))
    elif ext == '.mp4':
        out = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
              'stream=width,height:format=duration', '-of', 'json', os.path.join(LIB, f)]))
        st = out['streams'][0]
        rows.append((name, {'url': BASE + f, 'type': 'video', 'width': st['width'], 'height': st['height'],
                            'poster_url': BASE + name + '-poster.jpg', 'duration': round(float(out['format']['duration']), 1)}))
print('CREATE TEMP TABLE stock_lib(name text PRIMARY KEY, media jsonb);')
for n, m in rows:
    print("INSERT INTO stock_lib VALUES ('%s', '%s'::jsonb);" % (n, json.dumps(m)))
print("CREATE FUNCTION pg_temp.stock(VARIADIC names text[]) RETURNS jsonb LANGUAGE sql AS $$"
      " SELECT coalesce(jsonb_agg(s.media ORDER BY array_position(names, s.name)), '[]'::jsonb) FROM stock_lib s WHERE s.name = ANY(names) $$;")
