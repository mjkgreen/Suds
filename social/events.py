#!/usr/bin/env python3
"""Calendar of events worth a themed post, and which posting day should carry each.

  events.py [YYYY-MM-DD]     what's due on that day (default today) and what's coming up

An event is "due" from its posting day (the last free posting day on or before it (posting days come
from plan.json's post_days, e.g. Wed–Sat; events claim days in date order) through
the event day itself, unless
it was already posted this year. So an event on a Sunday is posted the Saturday
before, and one on a Thursday is posted that Thursday.

Each event says what the post should lean into (`angle`), the night-out title
the scenario uses on camera (`night`), drinks to feature, the subjects that suit
it best, and a tone note. Kept responsible on purpose: no "blackout Wednesday",
no drinking games, and the big drinking days get a pace-yourself / ride-home angle.
"""
import datetime as dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WINDOW_DAYS = 6  # how far before the event a post can still carry it


def nth_weekday(year, month, weekday, n):
    """n-th (1-based; -1 = last) `weekday` (Mon=0) of a month."""
    if n > 0:
        d = dt.date(year, month, 1)
        d += dt.timedelta(days=(weekday - d.weekday()) % 7)
        return d + dt.timedelta(weeks=n - 1)
    nxt = dt.date(year + (month == 12), month % 12 + 1, 1)
    d = nxt - dt.timedelta(days=1)
    return d - dt.timedelta(days=(d.weekday() - weekday) % 7)


def easter(year):
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return dt.date(year, month, day)


MON, TUE, WED, THU, FRI, SAT, SUN = range(7)
fixed = lambda m, d: (lambda y: dt.date(y, m, d))
nth = lambda m, wd, n: (lambda y: nth_weekday(y, m, wd, n))

EVENTS = [
    dict(id='dry-january', name='Dry January', date=fixed(1, 2), night='Mocktail night',
         drinks=['Ginger Nojito', 'Virgin Paloma'], subjects=['profile', 'log-a-drink'],
         angle='Starting Dry January (or a lighter one): sober streaks, weekly limits, logging mocktails too.',
         tone='Supportive, zero pressure. Celebrate the streak, not the drinks.'),
    dict(id='super-bowl', name='Super Bowl', date=nth(2, SUN, 2), night='Super Bowl watch party',
         drinks=['Lager', 'Black Cherry Seltzer', 'Hazy IPA'], subjects=['night-out', 'feed', 'map'],
         angle='Watch party with the crew: who is where, every round in one night.', tone='Fun; mention planning a ride home.'),
    dict(id='valentines', name="Valentine's Day", date=fixed(2, 14), night='Date night',
         drinks=['Espresso Martini', 'Rosé', 'Prosecco'], subjects=['night-out', 'feed'],
         angle="Date night or Galentine's: the spots, the drinks, the night in one place.", tone='Warm, inclusive of friends too.'),
    dict(id='mardi-gras', name='Mardi Gras', date=lambda y: easter(y) - dt.timedelta(days=47), night='Mardi Gras',
         drinks=['Hazy IPA', 'Margarita'], subjects=['feed', 'night-out'],
         angle='Mardi Gras night out with friends.', tone='Festive; keep it about the people.'),
    dict(id='st-patricks', name="St. Patrick's Day", date=fixed(3, 17), night="St. Patrick's Day",
         drinks=['Stout', 'Lager'], subjects=['night-out', 'profile'],
         angle="St. Patrick's Day: one of the biggest nights of the year, so track your pace and your crew.",
         tone='Celebrate, but lead with pacing, water and getting home safe.'),
    dict(id='beer-day', name='National Beer Day', date=fixed(4, 7), night='Brewery hop',
         drinks=['Hazy IPA', 'Sour', 'Pilsner', 'Wheat Beer'], subjects=['map', 'log-a-drink', 'feed'],
         angle='National Beer Day: every brewery you have been to, on one map.', tone='Light, craft-beer curious.'),
    dict(id='patio-season', name='Patio season (Memorial Day weekend)', date=nth(5, MON, -1), night='Patio season opener',
         drinks=['Aperol Spritz', 'Pilsner', 'Rosé'], subjects=['map', 'night-out'],
         angle='Patio season is open: find where your friends are sitting outside.', tone='Sunny, social.'),
    dict(id='wine-day', name='National Wine Day', date=fixed(5, 25), night='Wine night',
         drinks=['Pinot Noir', 'Sauvignon Blanc', 'Rosé'], subjects=['log-a-drink', 'feed', 'profile'],
         angle='National Wine Day: log the bottle you split, see your top drinks.', tone='Relaxed.'),
    dict(id='solstice', name='Longest day of the year', date=fixed(6, 21), night='Longest day rooftop',
         drinks=['Aperol Spritz', 'Paloma'], subjects=['night-out', 'map'],
         angle='The longest day: a rooftop sunset night out.', tone='Golden-hour, social.'),
    dict(id='canada-day', name='Canada Day', date=fixed(7, 1), night='Canada Day',
         drinks=['Lager', 'Black Cherry Seltzer'], subjects=['night-out', 'map', 'feed'],
         angle='Canada Day with the crew: every stop, every round, one night.', tone='Festive; mention a ride home.'),
    dict(id='fourth-of-july', name='Fourth of July', date=fixed(7, 4), night='Fourth of July',
         drinks=['Lager', 'Black Cherry Seltzer', 'Margarita'], subjects=['night-out', 'map', 'feed'],
         angle='Fourth of July: the cookout, the rooftop, the fireworks, all in one night out.', tone='Festive; mention a ride home.'),
    dict(id='tequila-day', name='National Tequila Day', date=fixed(7, 24), night='Taco Tuesday-ish',
         drinks=['Margarita', 'Paloma', 'Mezcal, neat'], subjects=['log-a-drink', 'feed'],
         angle='National Tequila Day: log your margarita in seconds.', tone='Playful.'),
    dict(id='ipa-day', name='IPA Day', date=nth(8, THU, 1), night='IPA Day',
         drinks=['Hazy IPA'], subjects=['log-a-drink', 'profile'],
         angle='IPA Day: what is your top drink, really?', tone='Craft-beer nerdy.'),
    dict(id='labor-day', name='Labor Day weekend', date=nth(9, MON, 1), night='Last patio weekend',
         drinks=['Pilsner', 'Aperol Spritz'], subjects=['map', 'night-out'],
         angle="Summer's last long weekend: the map of every patio you hit.", tone='Nostalgic, social.'),
    dict(id='oktoberfest', name='Oktoberfest', date=nth(9, SAT, 3), night='Oktoberfest',
         drinks=['Wheat Beer', 'Lager'], subjects=['night-out', 'feed'],
         angle='Oktoberfest with friends: every stein, every stop.', tone='Festive; pace yourself.'),
    dict(id='sober-october', name='Sober October', date=fixed(10, 1), night='Zero-proof night',
         drinks=['Ginger Nojito', 'Virgin Paloma'], subjects=['profile', 'log-a-drink'],
         angle='Sober October: track the streak, log the mocktails, still see your friends.', tone='Supportive.'),
    dict(id='thanksgiving-ca', name='Thanksgiving (Canada)', date=nth(10, MON, 2), night='Thanksgiving weekend',
         drinks=['Pinot Noir', 'Dry Apple Cider'], subjects=['feed', 'night-out'],
         angle='Thanksgiving weekend: catching up with everyone you missed.', tone='Warm.'),
    dict(id='halloween', name='Halloween', date=fixed(10, 31), night='Halloween party',
         drinks=['Espresso Martini', 'Old Fashioned', 'Dry Apple Cider'], subjects=['night-out', 'feed'],
         angle='Halloween night out: costumes, crawl, and every stop on the map.', tone='Spooky-fun; mention a ride home.'),
    dict(id='friendsgiving', name='Friendsgiving', date=lambda y: nth_weekday(y, 11, THU, 4) - dt.timedelta(days=5),
         night='Friendsgiving', drinks=['Pinot Noir', 'Dry Apple Cider', 'Old Fashioned'], subjects=['night-out', 'feed'],
         angle='Friendsgiving: the people, the toasts, the whole night in one place.', tone='Warm, grateful.'),
    dict(id='thanksgiving-us', name='Thanksgiving (US)', date=nth(11, THU, 4), night='Hometown reunion',
         drinks=['Pilsner', 'Old Fashioned'], subjects=['map', 'feed'],
         angle='Home for Thanksgiving: catching up with hometown friends at the old spots.',
         tone='Nostalgic. Never the "blackout Wednesday" angle.'),
    dict(id='holiday-parties', name='Holiday party season', date=fixed(12, 12), night='Holiday party',
         drinks=['Prosecco', 'Old Fashioned', 'Espresso Martini'], subjects=['night-out', 'profile'],
         angle='Holiday party season: every party, one weekly limit.', tone='Festive with a know-your-limits angle.'),
    dict(id='new-years-eve', name="New Year's Eve", date=fixed(12, 31), night="New Year's Eve",
         drinks=['Prosecco', 'Espresso Martini'], subjects=['night-out', 'feed', 'profile'],
         angle="New Year's Eve: your year in drinks, and tonight's plan with the crew.",
         tone='Celebratory; lead with plans and a safe ride home.'),
]
BY_ID = {e['id']: e for e in EVENTS}


def post_days():
    with open(os.path.join(HERE, 'plan.json')) as f:
        return set(json.load(f).get('post_days', [3, 4, 5, 6]))  # ISO weekdays, Wed–Sat


def occurrence(ev, year):
    return ev['date'](year)


def best_day(event_date, days):
    """The last posting day on or before the event, within the window."""
    for back in range(0, WINDOW_DAYS + 1):
        d = event_date - dt.timedelta(days=back)
        if d.isoweekday() in days:
            return d
    return event_date


def schedule(year, days):
    """Assign each event of a year its own posting day: the latest free posting day on or
    before it (within the window), so two events on one weekend don't fight over a day."""
    taken, out = set(), {}
    for ev in sorted(EVENTS, key=lambda e: occurrence(e, year)):
        d = occurrence(ev, year)
        free = [d - dt.timedelta(days=b) for b in range(WINDOW_DAYS + 1)
                if (d - dt.timedelta(days=b)).isoweekday() in days and d - dt.timedelta(days=b) not in taken]
        b = free[0] if free else best_day(d, days)
        taken.add(b)
        out[ev['id']] = (d, b)
    return out


def posted(history, ev_id, year):
    return any(r.get('event') == ev_id and r.get('date', '')[:4] == str(year) for r in history)


def public(ev, d, best):
    out = {k: v for k, v in ev.items() if k != 'date'}
    out.update(date=d.isoformat(), post_on=best.isoformat())
    return out


def due(today, history=(), days=None):
    """Events this post should carry (soonest first), and the next ones coming up."""
    days = days or post_days()
    now, soon = [], []
    plans = {y: schedule(y, days) for y in (today.year, today.year + 1)}
    for ev in EVENTS:
        for y in (today.year, today.year + 1):
            d, b = plans[y][ev['id']]
            if posted(history, ev['id'], y):
                continue
            if b <= today <= d:
                now.append((d, public(ev, d, b)))
            elif today < b <= today + dt.timedelta(days=21):
                soon.append((d, public(ev, d, b)))
    now.sort(key=lambda x: (x[1]['post_on'] != today.isoformat(), x[0])); soon.sort(key=lambda x: x[0])
    return [e for _, e in now], [{'id': e['id'], 'name': e['name'], 'date': e['date'], 'post_on': e['post_on']} for _, e in soon]


def window_ok(ev_id, post_date, days=None):
    """Is a post on `post_date` allowed to carry this event?"""
    ev = BY_ID.get(ev_id)
    if not ev:
        return False
    days = days or post_days()
    for y in (post_date.year, post_date.year + 1):
        d, b = schedule(y, days)[ev_id]
        if b <= post_date <= d:
            return True
    return False


if __name__ == '__main__':
    today = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date.today()
    now, soon = due(today)
    print(json.dumps({'due': now, 'coming_up': soon}, indent=1))
