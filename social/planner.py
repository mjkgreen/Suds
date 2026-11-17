#!/usr/bin/env python3
"""No-repeats planner for Suds social posts.

  planner.py suggest <history>             what to post today
  planner.py check   <history> <post.json> must print OK before any upload

<history> is a JSON array of earlier post.json records, or a directory that
holds them (searched recursively for post.json). Each record looks like:
  {"date": "2026-11-17", "type": "reel", "subject": "log-a-drink",
   "hook": "Your night out, logged in 5 seconds", ...}

Rules (check refuses with exit 1 and prints why):
  1. one post per date
  2. never the same type twice in a row
  3. a type+subject pair can't repeat until every ready subject of that type
     has been used since its last use (a "cycle")
  4. the same subject (any type) not within SUBJECT_GAP_DAYS days
  5. a hook may not share 3+ meaningful words with any earlier hook
"""
import datetime as dt
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = json.load(open(os.path.join(HERE, 'plan.json')))
SUBJECT_GAP_DAYS = CONFIG.get('subject_gap_days', 6)
HOOK_WORD_LIMIT = 3

STOPWORDS = set('''a an and are as at be but by can do does for from get got has have how i if in
into is it its just me my no not of on or our out so than that the their them then there these
this to too up us was we what when where which who why will with you your yours i'm it's you're
all any every more most much one ones very via vs'''.split())


def load_history(path):
    if os.path.isdir(path):
        recs = []
        for d, _, files in os.walk(path):
            if 'post.json' in files:
                with open(os.path.join(d, 'post.json')) as f:
                    recs.append(json.load(f))
    elif os.path.exists(path):
        recs = json.load(open(path))
    else:
        recs = []
    return sorted(recs, key=lambda r: (r['date'], r.get('created_at', '')))


def words(hook):
    out = set()
    for w in re.findall(r"[a-z0-9']+", hook.lower()):
        w = w.strip("'")
        if len(w) < 3 or w in STOPWORDS:
            continue
        if w.endswith('ies') and len(w) > 4:
            w = w[:-3] + 'y'
        elif w.endswith('s') and not w.endswith('ss') and len(w) > 3:
            w = w[:-1]
        out.add(w)
    return out


def ready_subjects(ptype):
    return [s['id'] for s in CONFIG['subjects'] if s.get('ready') and ptype in s['types']]


def used_in_cycle(history, ptype):
    """Subjects of this type used since the type's cycle last completed."""
    pool = set(ready_subjects(ptype))
    used = set()
    for r in history:
        if r['type'] != ptype:
            continue
        if r['subject'] in pool:
            used.add(r['subject'])
        if pool and used >= pool:
            used = set()  # cycle complete; start a new one
    return used


def days_since_subject(history, subject, today):
    last = [r['date'] for r in history if r['subject'] == subject]
    if not last:
        return None
    return (today - dt.date.fromisoformat(max(last))).days


def check(history, post):
    errs = []
    today = dt.date.fromisoformat(post['date'])
    for k in ('date', 'type', 'subject', 'hook'):
        if not post.get(k):
            errs.append(f'post.json is missing "{k}"')
    if errs:
        return errs
    if post['type'] not in CONFIG['types']:
        errs.append(f'unknown type {post["type"]!r}')
    if post['subject'] not in {s['id'] for s in CONFIG['subjects']}:
        errs.append(f'unknown subject {post["subject"]!r}')
    if any(r['date'] == post['date'] for r in history):
        errs.append(f'already posted on {post["date"]}')
    earlier = [r for r in history if r['date'] < post['date']]
    if earlier and earlier[-1]['type'] == post['type']:
        errs.append(f'same type as the previous post ({post["type"]}, {earlier[-1]["date"]})')
    if post['subject'] in used_in_cycle(history, post['type']):
        left = sorted(set(ready_subjects(post['type'])) - used_in_cycle(history, post['type']))
        errs.append(f'{post["type"]} + {post["subject"]} already used this cycle; unused: {", ".join(left) or "none"}')
    gap = days_since_subject(history, post['subject'], today)
    if gap is not None and gap < SUBJECT_GAP_DAYS:
        errs.append(f'subject {post["subject"]!r} was used {gap} day(s) ago (minimum gap {SUBJECT_GAP_DAYS})')
    mine = words(post['hook'])
    for r in history:
        shared = mine & words(r.get('hook', ''))
        if len(shared) >= HOOK_WORD_LIMIT:
            errs.append(f'hook shares {len(shared)} words ({", ".join(sorted(shared))}) with {r["date"]}: {r["hook"]!r}')
    return errs


def suggest(history, today):
    counts = {t: sum(1 for r in history if r['type'] == t) for t in CONFIG['types']}
    total = sum(counts.values()) + 1
    last_type = history[-1]['type'] if history else None
    order = sorted(CONFIG['types'], key=lambda t: -(CONFIG['types'][t]['share'] * total - counts[t]))
    plan = []
    for t in order:
        if t == last_type or not ready_subjects(t):
            continue
        used = used_in_cycle(history, t)
        options = []
        for s in ready_subjects(t):
            gap = days_since_subject(history, s, today)
            if s in used or (gap is not None and gap < SUBJECT_GAP_DAYS):
                continue
            options.append((-(gap if gap is not None else 10 ** 6), s))
        plan.append({'type': t, 'behind_by': round(CONFIG['types'][t]['share'] * total - counts[t], 2),
                     'subjects': [s for _, s in sorted(options)]})
    posted_today = any(r['date'] == today.isoformat() for r in history)
    recent_hooks = [r['hook'] for r in history[-12:]]
    return {'date': today.isoformat(), 'already_posted_today': posted_today,
            'plan': [p for p in plan if p['subjects']], 'recent_hooks': recent_hooks}


def main(argv):
    if len(argv) < 2 or argv[0] not in ('suggest', 'check'):
        print(__doc__)
        return 2
    history = load_history(argv[1])
    if argv[0] == 'suggest':
        today = dt.date.fromisoformat(argv[2]) if len(argv) > 2 else dt.date.today()
        print(json.dumps(suggest(history, today), indent=2))
        return 0
    post = json.load(open(argv[2]))
    errs = check(history, post)
    if errs:
        print('REFUSED')
        for e in errs:
            print(' - ' + e)
        return 1
    print('OK')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
