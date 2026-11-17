#!/usr/bin/env python3
"""Contact sheet of a video for review: sheet.py <video> <out.jpg> [n=12]"""
import subprocess, sys, json, tempfile, os
from PIL import Image, ImageDraw
v, out = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
dur = float(json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', v]))['format']['duration'])
tmp = tempfile.mkdtemp()
cols = 6; rows = (n + cols - 1) // cols
c = Image.new('RGB', (cols * 280, rows * 500), 'white'); d = ImageDraw.Draw(c)
for i in range(n):
    t = (i + 0.5) * dur / n
    f = os.path.join(tmp, f'{i}.png')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', v, '-frames:v', '1', '-vf', 'scale=270:480', f], check=True)
    x, y = (i % cols) * 280, (i // cols) * 500
    c.paste(Image.open(f), (x, y)); d.text((x + 5, y + 483), f'{t:.1f}s', fill='black')
c.save(out)
