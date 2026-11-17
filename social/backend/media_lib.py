#!/usr/bin/env python3
"""Emit SQL for the seed's media helpers:
  pg_temp.stock(names...)        library photos (social/media/library)
  pg_temp.slot(slot, names...)   this run's picks for a slot (social/out/media/picks.json,
                                 written by social/media/pick.py), else the given library photos
"""
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
PICKS = os.environ.get('SUDS_MEDIA_PICKS') or os.path.join(LIB, '..', '..', 'out', 'media', 'picks.json')
picks = json.load(open(PICKS)) if os.path.exists(PICKS) else {}
print('CREATE TEMP TABLE slot_picks(slot text PRIMARY KEY, media jsonb);')
for slot, items in picks.items():
    print("INSERT INTO slot_picks VALUES ('%s', '%s'::jsonb);" % (slot, json.dumps(items).replace("'", "''")))
print("CREATE FUNCTION pg_temp.stock(VARIADIC names text[]) RETURNS jsonb LANGUAGE sql AS $$"
      " SELECT coalesce(jsonb_agg(s.media ORDER BY array_position(names, s.name)), '[]'::jsonb) FROM stock_lib s WHERE s.name = ANY(names) $$;")
print("CREATE FUNCTION pg_temp.slot(slot_name text, VARIADIC names text[]) RETURNS jsonb LANGUAGE sql AS $$"
      " SELECT coalesce((SELECT media FROM slot_picks WHERE slot = slot_name), pg_temp.stock(VARIADIC names)) $$;")
