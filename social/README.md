# Social posts

Makes Instagram/TikTok posts for Suds from **real app footage**, and puts them
in Google Drive ("Suds social content") for posting by hand. A scheduled task
runs it 4 days a week by following [`TASK.md`](TASK.md).

## How it works

1. `setup.sh` builds a throwaway local backend: Postgres with every migration
   in `supabase/migrations`, plus generated demo data (`backend/scenario.py`), PostgREST,
   and a gateway (`backend/gateway.js`) standing in for Supabase auth and
   storage. It also starts the Expo web app pointed at that backend. Nothing
   touches production.
2. `capture/run.js <subject> reel|still` drives the real app with Playwright on a
   fake clock, one frame at a time, so pacing is exact (`capture/recorder.js`).
3. `render/compose.py` adds an eased camera, touch rings, the hook and
   captions, an end card and an original music bed. The result is
   1080×1920, ≤ 2.8 MB. `render/still.py` makes 1080×1350 feed stills.
   Music comes from `render/music.py`: six original synthesized styles (lofi,
   house, disco-funk, tropical, synthpop, acoustic). Every render randomizes key,
   tempo, chord progression and patterns, so tracks never repeat. Nothing is licensed.
4. `planner.py` decides what's due and refuses repeats. Its `check` must say
   `OK` before anything is uploaded.

`make_post.sh <type> <subject> <copy.json> <outDir>` runs steps 1–3 in one go.

## Subjects

`capture/subjects/*.js`: `log-a-drink`, `night-out`, `map`, `profile`, `feed`.
Each one has a reel, a still, default words and an `about` line. To add a
subject, add a file there and list it in `plan.json`.

## Fresh demo data per post

`backend/scenario.py new` invents a scenario for each post: city (7 to choose from),
a cast of six people, 16 fictional venues, three nights out, featured feed posts, the
drink logged on camera, and the photo slots. It avoids anything the last 6 posts used,
and the planner refuses a post that reuses people, nights, venues, its seed, the
previous post's city, or any earlier photo. The video on the feed's first post is a
slow push-in made from that post's picked photo.

## Events

`events.py` lists ~22 drink-relevant dates (US and Canada: Friendsgiving, St. Patrick's,
Super Bowl, Canada Day, Fourth of July, Sober October, New Year's Eve…) with date rules.
Each event claims the last free posting day (plan.json `post_days`) on or before it,
and the planner offers it that day. The scenario then makes the night started on
camera the event's and features its drinks. Each event is posted once a year.
`python3 social/events.py 2026-11-21` shows what's due and coming up.

## Photos per post

Seeded posts have photo **slots** (from the scenario): which post, what drink, which
subjects show it. Each run fetches fresh Unsplash photos for just the slots its
subject shows, matched to the drink and the day's angle, and reviews them before use
(`media/pick.py slots|fetch|use`). Picks live in `social/out/media/` for that run
only. Slots that aren't refilled use the library defaults.

## Demo data and media

- People and venues are fictional (random first + last names; invented venue names at
  random spots in real neighbourhoods). Times are relative to each run, and the
  browser is always set to ~9 pm.
- Fallback drink photos come from Unsplash (`media/library`, credits in `credits.json`,
  no clearly visible faces). `media/unsplash.py` adds more; it needs the environment's Unsplash
  network secret.

## Common commands

```bash
social/setup.sh                                   # start + verify the stack
python3 -m unittest social/test_planner.py        # planner rules
node social/capture/peek.js /feed shot.png        # quick screenshot
```
