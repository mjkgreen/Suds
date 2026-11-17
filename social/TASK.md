# Daily social post: scheduled-task instructions

You are making one social media post for **Suds** (a social drink-logging app)
and putting it in Google Drive for the owner to post by hand. Work in the
repository checkout (`mjkgreen/Suds`, branch `main`). Everything you need is in
`social/`. Follow these steps in order. Do not skip the checks.

## Hard rules

- **Google Drive:** work only inside the folder **`1TmMBt8ficDoLdEGHsZZ8VxAP0FU0g421`**
  ("Suds social content"). Create a new subfolder there and new files inside
  that subfolder. **Never** delete, trash, move, rename, share, change
  permissions on, or update any file. Never search, list or open anything
  outside that folder.
- **Footage is real:** every frame comes from the real app via
  `social/make_post.sh`. Never mock up, draw, or AI-generate app screens or people.
- **No production data:** the app runs against a local demo backend. Don't use
  the `EXPO_PUBLIC_SUPABASE_*`, `SUPABASE_*` or `SUDS_TEST_*` variables, and
  don't contact `*.supabase.co`.
- **The planner decides what's allowed.** `planner.py check` must print `OK` for the
  exact `post.json` you upload. Never edit `social/plan.json` or `social/planner.py`,
  and never work around a refusal.
- **Tone:** fun and social, never pushing heavy drinking. No "get wasted", no
  drinking games, nothing aimed at under-21s. Never suggest the BAC estimate
  means someone is safe to drive.
- Don't commit, push or open pull requests. If something is broken, stop and
  report it. Don't upload a bad post.

## Steps

1. **Start the stack.** `cd` into the repo and run `social/setup.sh`. It must end
   with `stack ready`. If it fails, stop and report the last lines of its output.

2. **Collect the history.** In Drive, search
   `'1TmMBt8ficDoLdEGHsZZ8VxAP0FU0g421' in ancestors and title = 'post.json'`
   (follow `nextPageToken` until the results run out). Download every result. Each
   download is saved to a local file whose path the tool returns. Combine them all into
   one JSON array in `social/out/history.json`. With no results, write `[]`.
   (`social/out/` is git-ignored scratch space inside the repo; `rm -rf social/out` first,
   then `mkdir -p social/out`.)

3. **Plan.** Run `python3 social/planner.py suggest social/out/history.json`.
   - If `already_posted_today` is true, stop: report "already posted today" with the folder link.
   - Take the first entry in `plan` (its `type`), and pick its first subject
     unless a later one clearly has a fresher angle given `recent_hooks`.

4. **Write the words.** Read `social/capture/subjects/<subject>.js`: its
   `about` says what the subject shows, and `defaults` shows the shape.
   Write `social/out/copy.json` with fresh words:
   - `hook`: 3–8 words, at most 3 short lines (use `\n`), shown big in the first
     3 seconds. Give it a new angle, and don't reuse 3+ meaningful words from any line in `recent_hooks`.
   - `captions`: 3 short on-screen lines (2–5 words each) for the reel's later
     scenes, in the same order as the defaults' scenes.
   - `headline`: for a still: 2–6 words, on 2 lines.

4b. **Pick photos that match this post.** Run `python3 social/media/pick.py slots <subject>`.
   It lists the photo slots this subject's footage shows: which seeded post, what
   drink and setting (`shows`), a starting `query`, and how many photos (`count`).
   For each slot:
   - `python3 social/media/pick.py fetch <slot> "<query>"`. Tune the query to the slot's
     drink and to today's angle (e.g. "espresso martini bar night"). If it returns no
     candidates, try a broader query (e.g. just the drink's name).
   - Open the printed contact `sheet` and choose photos that match the drink and setting,
     with **no clearly visible faces, no readable brand logos or labels, and nobody who
     looks under 21**. Hands, crowds from behind or far away, and silhouettes are good:
     they show the social side.
   - `python3 social/media/pick.py use <slot> <id> [<id> ...]` with `count` ids, best first.
   If Unsplash fails or nothing suitable turns up, skip that slot. Its library photo
   is used instead. Picks apply when the post is rendered in step 6.

5. **Draft the record and check it.** Write `social/out/post.json`:
   ```json
   {"date": "<today, YYYY-MM-DD>", "type": "<reel|still>", "subject": "<subject>",
    "hook": "<the hook for a reel, the headline for a still, on one line>",
    "caption": "<the caption from step 7>", "created_at": "<ISO timestamp>"}
   ```
   Run `python3 social/planner.py check social/out/history.json social/out/post.json`.
   If it prints `REFUSED`, fix what it names (usually reword the hook) and check
   again. Make at most 3 attempts. If it still refuses, stop and report why.

6. **Render.** `social/make_post.sh <type> <subject> social/out/copy.json social/out/post`.
   The output is `reel.mp4` (1080×1920, ≤ 2.8 MB) or `still.jpg` (1080×1350), plus `review.jpg`.

7. **Look at it before uploading.** Open `social/out/post/review.jpg` (and
   `audio.png` for a reel) and check:
   - the hook and captions are fully on screen, not cut off, and not covering the thing they describe
   - every app screen has loaded (no blank screens, spinners, error messages or "Couldn't load")
   - a reel ends on the orange Suds end card, and the audio spectrogram isn't empty
   If something is wrong, fix the words or re-render once. If it's still wrong, stop and report.

   Also check that the photos in the footage match their drinks and pass the rules in step 4b.
   Then write `social/out/post/caption.txt`:
   - 1–3 short lines in the same voice as the hook, then `Free on the App Store, link in bio.`
   - a blank line, then 5–8 hashtags (mix broad and niche, e.g. #nightout #cocktails #drinktracker)
   - for a reel, a last line: `TikTok: post as a draft and add a trending sound.`
   Put the same caption text (without the TikTok line) into `post.json`'s `caption`,
   and run the check from step 5 once more (it must still print `OK`).

8. **Upload** to Drive, in this order:
   1. Create a folder titled `<date> <type> — <subject>` (e.g. `2026-11-18 reel — night-out`),
      with mimeType `application/vnd.google-apps.folder`, parent `1TmMBt8ficDoLdEGHsZZ8VxAP0FU0g421`.
   2. Inside it, upload the media (`reel.mp4` as `video/mp4`, or `still.jpg` as `image/jpeg`)
      and `caption.txt` as `text/plain`, all with `disableConversionToGoogleType: true`.
      Upload each file by reference: `base64Content` = `sha256:<hex>:<absolute path>`, where
      the hex comes from `sha256sum` and the path is absolute and inside the repo
      (e.g. `/…/Suds/social/out/post/reel.mp4`). References to files outside the repo are refused.
   3. Add `"drive_folder_id": "<new folder id>"` and `"photos"` (the `photo_url` values from
      `social/out/media/credits.json`, or `[]`) to `post.json`, and upload it **last** as
      `application/json` (no conversion). It is the history record, so a post without
      it doesn't count, and one with it must be complete.

9. **Report** in a few lines: the type and subject, the hook, the caption, and
   the folder link `https://drive.google.com/drive/folders/<new folder id>`, to open on a phone.
