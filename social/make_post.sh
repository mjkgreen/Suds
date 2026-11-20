#!/usr/bin/env bash
# Build one post, ready to upload.
#
#   social/make_post.sh <type: reel|still> <subject> <copy.json> <outDir> [music style]
#
# copy.json: {"hook": "...", "captions": ["...","...","..."], "headline": "..."}
#   reel  uses hook + captions; still uses headline.
# Music style: one from `planner.py suggest`'s music_styles (default: random).
# Each render gets a fresh key, tempo and progression; the track is recorded
# in reel.music.json for post.json's "music".
# Writes to <outDir>: the media (reel.mp4 or still.jpg) and review.jpg (frames
# pulled from the result, to look at before uploading). Starts the local stack
# if it isn't up. Reseeds first so every capture starts from the same state.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TYPE=$1 SUBJECT=$2 COPY=$3 OUT=$4 MUSIC=${5:-random}
[ -f "$ROOT/social/capture/subjects/$SUBJECT.js" ] || { echo "unknown subject $SUBJECT" >&2; exit 2; }
mkdir -p "$OUT"
curl -fs -o /dev/null http://localhost:8081 && curl -fs -o /dev/null http://127.0.0.1:3000/ || "$ROOT/social/setup.sh"
"$ROOT/social/backend/setup-db.sh" >/dev/null
CAP=$(mktemp -d)
node "$ROOT/social/capture/run.js" "$SUBJECT" "$TYPE" "$CAP" "$COPY"
if [ "$TYPE" = reel ]; then
  python3 "$ROOT/social/render/compose.py" "$CAP" "$OUT/reel.mp4" --max-mb 2.8 --music "$MUSIC"
  python3 "$ROOT/social/render/sheet.py" "$OUT/reel.mp4" "$OUT/review.jpg" 12
  ffmpeg -loglevel error -y -i "$OUT/reel.mp4" -lavfi showspectrumpic=s=800x300 "$OUT/audio.png"
  size=$(stat -c %s "$OUT/reel.mp4")
  [ "$size" -le 2800000 ] || { echo "reel is $size bytes, over the 2.8 MB Drive cap" >&2; exit 1; }
else
  python3 "$ROOT/social/render/still.py" "$CAP" "$OUT/still.jpg" --headline "$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['headline'])" "$COPY")"
  cp "$OUT/still.jpg" "$OUT/review.jpg"
fi
rm -rf "$CAP"
echo "built $TYPE/$SUBJECT -> $OUT"
