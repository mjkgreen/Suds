# Social posts

Makes Instagram/TikTok posts for Suds from **real app footage**, and puts them
in Google Drive ("Suds social content") for posting by hand. A scheduled task
runs it 4 days a week by following [`TASK.md`](TASK.md).

## How it works

1. `setup.sh` builds a throwaway local backend: Postgres with every migration
   in `supabase/migrations`, plus a demo seed (`backend/seed.sql`), PostgREST,
   and a gateway (`backend/gateway.js`) standing in for Supabase auth and
   storage. It also starts the Expo web app pointed at that backend. Nothing
   touches production.
2. `capture/run.js <subject> reel|still` drives the real app with Playwright on a
   fake clock, one frame at a time, so pacing is exact (`capture/recorder.js`).
3. `render/compose.py` adds an eased camera, touch rings, the hook and
   captions, an end card and an original music bed. The result is
   1080×1920, ≤ 2.8 MB. `render/still.py` makes 1080×1350 feed stills.
4. `planner.py` decides what's due and refuses repeats. Its `check` must say
   `OK` before anything is uploaded.

`make_post.sh <type> <subject> <copy.json> <outDir>` runs steps 1–3 in one go.

## Subjects

`capture/subjects/*.js`: `log-a-drink`, `night-out`, `map`, `profile`, `feed`.
Each one has a reel, a still, default words and an `about` line. To add a
subject, add a file there and list it in `plan.json`.

## Demo data and media

- People and venues are fictional. Times are relative to each run, and the
  browser is always set to ~9 pm.
- Drink photos come from Unsplash (`media/library`, credits in `credits.json`,
  no clearly visible faces). `clip-garnish.mp4` is a slow pan over one of those
  photos. `media/unsplash.py` adds more; it needs the environment's Unsplash
  network secret.

## Common commands

```bash
social/setup.sh                                   # start + verify the stack
python3 -m unittest social/test_planner.py        # planner rules
node social/capture/peek.js /feed shot.png        # quick screenshot
```
