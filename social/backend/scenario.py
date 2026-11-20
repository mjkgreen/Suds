#!/usr/bin/env python3
"""Demo-data scenarios: a fresh cast, city, venues, nights out and drinks per post.

  scenario.py new <history.json> <out.json> [seed] [--event <id>]
                                                    pick a scenario that avoids recent posts';
                                                    with an event (events.py), the night started on
                                                    camera is the event's and its drinks are featured
  scenario.py sql [scenario.json]                    the seed SQL for it (setup-db.sh runs this)
  scenario.py json [scenario.json]                   print it (lib.js / pick.py read this)
  scenario.py summary [scenario.json]                the part recorded in post.json's "scenario"

With no scenario file (or no social/out/scenario.json), a fixed default scenario
is used, so the stack always comes up the same for development.

Everything here is fictional: names are random first + last name pairs, venues
are invented names at random spots inside real neighbourhoods, and avatars are
the app's initials (no photos of people). Rows use fixed role-based ids, so
capture scripts can navigate (e.g. c003 is always "your" night out).
"""
import datetime as dt, json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_FILE = os.path.join(HERE, '..', 'out', 'scenario.json')
AVOID_POSTS = 6  # cast, nights, venues and city of the last N posts are avoided

CITIES = {  # neighbourhood centres on land; venues land within ~600 m of one
    'Denver': [(39.7527, -104.9997), (39.7680, -104.9800), (39.7620, -105.0110), (39.7330, -104.9800), (39.7110, -104.9875)],
    'Austin': [(30.2672, -97.7431), (30.2620, -97.7220), (30.2490, -97.7500), (30.2590, -97.7390), (30.3070, -97.7280)],
    'Chicago': [(41.9088, -87.6796), (41.9234, -87.7083), (41.8830, -87.6500), (41.9484, -87.6553), (41.8559, -87.6560)],
    'Nashville': [(36.1610, -86.7770), (36.1750, -86.7500), (36.1520, -86.7890), (36.1250, -86.7890), (36.1800, -86.7900)],
    'Portland': [(45.5290, -122.6830), (45.5590, -122.6450), (45.5120, -122.6250), (45.5500, -122.6760), (45.5050, -122.6400)],
    'Toronto': [(43.6480, -79.4200), (43.6545, -79.4005), (43.6620, -79.3330), (43.6440, -79.4000), (43.6680, -79.4050)],
    'Philadelphia': [(39.9720, -75.1340), (39.9510, -75.1440), (39.9496, -75.1720), (39.9290, -75.1630), (39.9640, -75.1410)],
}
STREETS = ['Main Street', 'Oak Avenue', 'Market Street', 'Grand Avenue', '2nd Street', 'Elm Street', 'Park Avenue',
           'Water Street', 'King Street', 'Union Avenue', 'Bridge Street', 'Mill Street', 'Front Street']
FIRST = ['Alex', 'Maya', 'Sam', 'Priya', 'Luke', 'Tess', 'Jordan', 'Nina', 'Omar', 'Chloe', 'Dev', 'Hana', 'Marcus',
         'Isla', 'Theo', 'Zoe', 'Ravi', 'Lena', 'Mateo', 'Ava', 'Kai', 'Ruby', 'Ezra', 'Leah', 'Noah', 'Jade', 'Felix',
         'Amara', 'Owen', 'Sofia', 'Jonah', 'Mina', 'Caleb', 'Iris', 'Diego', 'Nora', 'Malik', 'Elise', 'Ben', 'Yara',
         'Cole', 'Freya', 'Andre', 'Lucy', 'Tomas', 'Maeve', 'Jun', 'Rosa', 'Grant', 'Esme']
LAST = ['Chen', 'Okafor', 'Patel', 'Brennan', 'Romero', 'Reyes', 'Kim', 'Novak', 'Haddad', 'Larsen', 'Moreau', 'Silva',
        'Nakamura', 'Walsh', 'Osei', 'Fischer', 'Duarte', 'Kowalski', 'Ahmed', 'Bianchi', 'Murphy', 'Tanaka', 'Mensah',
        'Lindqvist', 'Vargas', 'Price', 'Ibrahim', 'Sato', 'Keller', 'Byrne', 'Costa', 'Nguyen', 'Hughes', 'Rossi']
VENUE_ADJ = ['Copper', 'Golden', 'Hollow', 'Blue', 'Velvet', 'Lucky', 'Crooked', 'Silver', 'Wild', 'Little', 'Red',
             'Quiet', 'Lantern', 'Iron', 'Juniper', 'Salt', 'Night', 'Second', 'Paper', 'Green']
VENUE_NOUN = ['Fox', 'Oak', 'Moon', 'Anchor', 'Owl', 'Barrel', 'Heron', 'Lantern', 'Rye', 'Willow', 'Crane', 'Pine',
              'Harbor', 'Finch', 'Bramble', 'Ember', 'Thistle', 'Bell', 'Sparrow', 'Vine']
VENUE_KIND = ['Taproom', 'Brewing', 'Wine Bar', 'Cocktail Club', 'Social', 'Tavern', 'Lounge', 'Cider House',
              'Beer Garden', 'Rooftop', 'Pub', 'Bar']
# (type, name, brand or None, photo search words)
MENU = [
    ('beer', 'Hazy IPA', None, 'hazy ipa beer glass'), ('beer', 'Pilsner', None, 'pilsner beer glass'),
    ('beer', 'Stout', None, 'stout beer pint'), ('beer', 'Sour', None, 'sour beer glass'),
    ('beer', 'Lager', None, 'lager beer glass bar'), ('beer', 'Wheat Beer', None, 'wheat beer glass'),
    ('wine', 'Pinot Noir', None, 'red wine glass'), ('wine', 'Sauvignon Blanc', None, 'white wine glass'),
    ('wine', 'Rosé', None, 'rose wine glass'), ('wine', 'Prosecco', None, 'prosecco sparkling wine glass'),
    ('cocktail', 'Margarita', None, 'margarita cocktail'), ('cocktail', 'Espresso Martini', None, 'espresso martini'),
    ('cocktail', 'Old Fashioned', None, 'old fashioned cocktail'), ('cocktail', 'Negroni', None, 'negroni cocktail'),
    ('cocktail', 'Aperol Spritz', None, 'aperol spritz'), ('cocktail', 'Mojito', None, 'mojito cocktail'),
    ('cocktail', 'Paloma', None, 'paloma cocktail grapefruit'), ('cocktail', 'Moscow Mule', None, 'moscow mule copper mug'),
    ('cider', 'Dry Apple Cider', None, 'apple cider glass'), ('seltzer', 'Black Cherry Seltzer', None, 'hard seltzer glass'),
    ('spirit', 'Mezcal, neat', None, 'mezcal glass'), ('spirit', 'Bourbon', None, 'bourbon whiskey glass'),
    ('mocktail', 'Ginger Nojito', None, 'mocktail mint ginger'), ('mocktail', 'Virgin Paloma', None, 'mocktail grapefruit'),
]
TYPE_LABEL = {'beer': 'Beer', 'wine': 'Wine', 'cocktail': 'Cocktail', 'cider': 'Cider', 'spirit': 'Spirit',
              'seltzer': 'Seltzer', 'mocktail': 'Mocktail', 'water': 'Water'}
NIGHTS = ["{f}'s birthday", 'Friday with the crew', 'Trivia night', 'Game day', 'Karaoke night', "{f}'s going-away",
          'Wine Wednesday', 'Patio season', 'Brewery hop', 'Date night', 'Work drinks', 'Reunion night',
          'Saturday catch-up', 'Housewarming after', 'Playoff watch party', 'First warm night out', 'Concert pre-game',
          "{f}'s promotion", 'Book club (allegedly)', 'Rooftop sunset']
NOTES = {
    'beer': ['New release is dangerously smooth', 'crisp one to start', 'tap list was stacked', 'patio pint'],
    'wine': ['wine bar finally reopened', 'split a bottle, no regrets', 'the good glasses came out'],
    'cocktail': ['Post-work reset', 'bartender knew exactly what I wanted', 'best one in town, fight me', 'treat yourself'],
    'cider': ['dry, cold, perfect', 'cider szn'], 'seltzer': ['easy one'], 'spirit': ['slow sipper'],
    'mocktail': ['zero proof, full vibes', 'pacing myself tonight', 'Sober October went so well I kept going'],
}
COMMENTS = ['saving me a seat?', 'omw', 'proud of you!!', 'best patio in town', 'same time next week?', 'that looks unreal',
            'next round on me', 'need the name of this place', 'jealous', 'happy birthday!!', 'iconic']
BIOS = ['IPA person. Trying to hit my weekly goal (the low one).', 'Here for the patios.', 'Wine first, questions later.',
        'Cocktail nerd, mocktail convert.', 'Logging it so I remember it.', 'Brewery tourist.']
LIBRARY = {  # fallback photos per drink type (social/media/library)
    'beer': ['pint-pale', 'beer-railing', 'beers-table', 'flight-hand', 'beer-garden-dusk', 'two-pints', 'beer-trio'],
    'wine': ['red-wine-1', 'red-wine-2', 'red-wine-pour', 'wine-glasses-hand', 'champagne'],
    'cocktail': ['espresso-martini-1', 'espresso-martini-2', 'margarita-1', 'margarita-2', 'margarita-night',
                 'old-fashioned-1', 'old-fashioned-2', 'cocktail-coupe', 'margarita-strawberry'],
    'cider': ['cider'], 'seltzer': ['bar-hands'], 'spirit': ['old-fashioned-2'],
    'mocktail': ['mocktail-mint', 'mocktail-purple', 'mocktail-lavender'], 'water': ['bar-hands'],
    'crowd': ['cheers-patio', 'string-lights-crowd', 'patio-crowd-night', 'rooftop-night', 'bar-counter-night', 'bar-silhouettes'],
}
# Library photos that actually show a given drink (by name); anything else falls back to a
# neutral bar/crowd shot rather than a photo of the wrong drink.
BY_NAME = {
    'Espresso Martini': ['espresso-martini-1', 'espresso-martini-2'], 'Margarita': ['margarita-1', 'margarita-2', 'margarita-night'],
    'Old Fashioned': ['old-fashioned-1', 'old-fashioned-2'], 'Bourbon': ['old-fashioned-2'],
    'Pinot Noir': ['red-wine-1', 'red-wine-2', 'red-wine-pour'], 'Prosecco': ['champagne'],
    'Hazy IPA': ['pint-pale', 'two-pints'], 'Pilsner': ['pint-pale', 'beer-railing'], 'Lager': ['pint-pale', 'beer-railing'],
    'Wheat Beer': ['beer-railing'], 'Sour': ['beer-trio', 'flight-hand'], 'Stout': ['beers-table'],
    'Dry Apple Cider': ['cider'], 'Ginger Nojito': ['mocktail-mint'], 'Virgin Paloma': ['mocktail-lavender'],
    'Mojito': ['mocktail-mint'], 'Negroni': ['cocktail-coupe'],
}
NEUTRAL = ['bar-hands', 'bar-counter-night', 'bar-silhouettes', 'wine-glasses-hand', 'cheers-patio', 'patio-crowd-night']


def library_for(name, rng):
    return rng.choice(BY_NAME.get(name) or NEUTRAL)


U = lambda n: f'00000000-0000-4000-a000-{n:012d}'
D = lambda n: f'00000000-0000-4000-b000-{n:012d}'
S = lambda n: f'00000000-0000-4000-c000-{n:012d}'


def recent(history, key, n=AVOID_POSTS):
    out = set()
    for r in history[-n:]:
        v = (r.get('scenario') or {}).get(key)
        out.update(v if isinstance(v, list) else ([v] if v else []))
    return out


def new(history, seed=None, event=None):
    seed = seed if seed is not None else random.SystemRandom().randrange(1, 2**31)
    rng = random.Random(seed)
    used_people, used_nights = recent(history, 'cast'), recent(history, 'nights')
    used_venues, last_city = recent(history, 'venues'), recent(history, 'city', 1)
    city = rng.choice([c for c in CITIES if c not in last_city] or list(CITIES))
    firsts = [f for f in FIRST if not any(p.startswith(f + ' ') for p in used_people)] or FIRST
    rng.shuffle(firsts)
    people, lasts = [], rng.sample(LAST, 6)
    for f, last in zip(firsts[:6], lasts):
        handle = rng.choice([f.lower() + last[0].lower(), f.lower() + last.lower(), f.lower() + '.' + last.lower()[:4],
                             f.lower() + str(rng.randint(2, 99))])
        people.append({'name': f'{f} {last}', 'username': handle})
    venues, seen = [], set(used_venues)
    while len(venues) < 16:
        a, n, n2 = rng.choice(VENUE_ADJ), *rng.sample(VENUE_NOUN, 2)
        name = rng.choice([f'The {a} {n}', f'{a} {n} {rng.choice(VENUE_KIND)}', f'{n} & {n2}'])
        if name in seen or a == n:
            continue
        seen.add(name)
        clat, clng = rng.choice(CITIES[city])
        venues.append({'name': name, 'street': rng.choice(STREETS), 'lat': round(clat + rng.uniform(-.006, .006), 5),
                       'lng': round(clng + rng.uniform(-.007, .007), 5)})
    friend_first = lambda i: people[i]['name'].split()[0]
    titles = [t for t in NIGHTS if t.format(f='') not in {u.format(f='') for u in used_nights}] or NIGHTS
    rng.shuffle(titles)
    fmt = lambda t, i: t.format(f=friend_first(i))
    menu = list(MENU)
    ev_drinks = [m for m in menu if event and m[1] in event.get('drinks', [])]

    def drink(types=None):
        pool = [m for m in menu if types is None or m[0] in types]
        themed = [m for m in ev_drinks if m in pool]
        return rng.choice(themed if themed and rng.random() < 0.35 else pool)
    # featured feed posts by friends 1..5; the first is always a cocktail (it carries the video clip)
    posts = []
    for k, (fi, mins) in enumerate([(1, 35), (2, 80), (3, 160), (5, 240), (4, 360)]):
        for _ in range(20):   # a different drink on every featured post
            t, name, brand, q = drink(['cocktail']) if k == 0 else drink()
            if name not in {p['name'] for p in posts}:
                break
        posts.append({'id': D(k + 1), 'user': fi, 'type': t, 'name': name, 'brand': brand, 'qty': 2 if k == 1 else 1,
                      'venue': rng.randrange(len(venues)), 'minutes_ago': mins, 'rating': rng.randint(7, 10),
                      'note': rng.choice(NOTES[t]) if k == 0 or rng.random() < 0.7 else None, 'query': q})

    def night(sid, user, title, hours_ago, length_h, n, venue_ids, first_id, pace=False):
        ds = []
        for k in range(n):
            if k == n // 2 and n > 3:
                t, name, brand, q = ('water', 'Water', None, 'glass of water bar')
            elif pace and k == n - 2:
                t, name, brand, q = drink(['mocktail'])
            else:
                t, name, brand, q = drink()
            ds.append({'id': D(first_id + k), 'type': t, 'name': name, 'brand': brand, 'query': q,
                       'venue': venue_ids[min(k * len(venue_ids) // n, len(venue_ids) - 1)],
                       'offset_min': int(10 + k * (length_h * 60 - 20) / max(1, n - 1)),
                       'note': rng.choice(NOTES[t]) if t in NOTES and rng.random() < 0.4 else None})
        return {'id': sid, 'user': user, 'title': title, 'hours_ago': hours_ago, 'length_h': length_h, 'drinks': ds}

    vi = list(range(len(venues))); rng.shuffle(vi)
    friend_night = night(S(1), 4, fmt(titles[0], 2), 5.5, 3.5, 5, [vi[0]], 101)
    shared_night = night(S(2), 2, fmt(titles[1], 3), 26, 5, 4, [vi[1]], 201)
    your_night = night(S(3), 0, fmt(titles[2], rng.randint(1, 5)), 9 * 24 + 1.5, 5.3, 6, [vi[2], vi[3], vi[4]], 301, pace=True)
    start_title = event['night'] if event else fmt(titles[3], rng.randint(1, 5))
    lt, ln, _, _ = drink(['cocktail', 'wine', 'cider'])
    log = {'type': lt, 'type_label': TYPE_LABEL[lt], 'name': ln, 'prefix': ln[:4], 'venue': vi[5]}
    scen = {
        'seed': seed, 'city': city, 'people': people, 'venues': venues, 'menu': [list(m) for m in menu],
        'you_bio': rng.choice(BIOS), 'weekly_limit': rng.choice([6, 7, 8, 10, 12]),
        'posts': posts, 'nights': {'friend': friend_night, 'shared': shared_night, 'yours': your_night},
        'start_title': start_title, 'log': log, 'event': event['id'] if event else None,
        'comments': rng.sample(COMMENTS, 6), 'your_comment': rng.choice(['save me a seat!', 'on my way', 'cheers to that!', 'love this spot']),
    }
    scen['slots'] = slots(scen, rng)
    return scen


def slots(sc, rng):
    """Photo slots (see media/pick.py): which seeded drinks show photos, and in which subjects."""
    out, n = [], sc['nights']
    def add(slot, d, subjects, count, extra='', crowd=False, video=False):
        defaults = [library_for(d['name'], rng)] + (rng.sample(LIBRARY['crowd'], 1) if crowd else [])
        out.append({'slot': slot, 'post': d['id'], 'shows': f"{d['name']}{extra}", 'query': d['query'],
                    'subjects': subjects, 'count': count, 'defaults': defaults[:count], 'video': video})
    p = sc['posts']
    add('feed-1', p[0], ['feed', 'log-a-drink', 'night-out'], 1, ' (shown as a short slow-pan video)', video=True)
    add('feed-2', p[1], ['feed'], 1)
    add('feed-3', p[2], ['feed'], 2, ', with friends', crowd=True)
    add('feed-4', p[3], ['feed'], 1)
    add('feed-5', p[4], ['feed'], 1)
    add('friend-night-1', n['friend']['drinks'][0], ['feed', 'map'], 2, f" on {n['friend']['title']}", crowd=True)
    add('shared-night-1', n['shared']['drinks'][1], ['feed', 'map'], 2, f" on {n['shared']['title']}, a busy night out with friends", crowd=True)
    for k, d in enumerate(n['yours']['drinks']):
        if d['type'] != 'water':
            add(f'your-night-{k + 1}', d, ['night-out', 'map'], 2 if k == 0 else 1,
                f" on {n['yours']['title']}" + (', friends cheersing' if k == 0 else ''), crowd=(k == 0))
    return out


def q(v):
    return 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"


def sql(sc):
    P, V = sc['people'], sc['venues']
    o = ['SET search_path = public, extensions;', f'SELECT setseed({(sc["seed"] % 1000) / 1000.0});']
    o.append('INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ' + ',\n'.join(
        f"('{U(i + 1)}', '{p['username']}@example.com', {q(json.dumps({'username': p['username'], 'display_name': p['name']}))})"
        for i, p in enumerate(P)) + ';')
    o.append("UPDATE profiles SET onboarded = true, subscription_tier = 'premium', created_at = now() - interval '200 days';")
    o.append(f"UPDATE profiles SET bio = {q(sc['you_bio'])} WHERE id = '{U(1)}';")
    o.append("""INSERT INTO user_private_metrics (user_id, height, height_unit, weight, weight_unit, birthdate)
SELECT id, 70, 'in', 175, 'lb', date '1994-06-12' FROM profiles
ON CONFLICT (user_id) DO UPDATE SET birthdate = excluded.birthdate, height = excluded.height,
  height_unit = excluded.height_unit, weight = excluded.weight, weight_unit = excluded.weight_unit;""")
    o.append("INSERT INTO follows (follower_id, following_id, created_at) SELECT a.id, b.id, now() - interval '150 days' FROM profiles a, profiles b WHERE a.id <> b.id;")
    o.append(f"INSERT INTO goals (user_id, weekly_limit) VALUES ('{U(1)}', {sc['weekly_limit']});")
    o.append('CREATE TEMP TABLE places(name text, lat numeric, lng numeric);')
    o.append('INSERT INTO places VALUES ' + ', '.join(f"({q(v['name'])}, {v['lat']}, {v['lng']})" for v in V) + ';')
    o.append('CREATE TEMP TABLE menu(drink_type text, drink_name text, brand text);')
    o.append('INSERT INTO menu VALUES ' + ', '.join(f"({q(m[0])}, {q(m[1])}, {q(m[2])})" for m in sc['menu']) + ';')
    o.append(f"""-- ~90 days of history for everyone
INSERT INTO drink_logs (user_id, drink_type, drink_name, brand, quantity, location_name, location_lat, location_lng, logged_at, created_at, rating)
SELECT p.id, m.drink_type, m.drink_name, m.brand, 1, pl.name, pl.lat, pl.lng, t, t, 6 + floor(random()*5)::int
FROM profiles p
CROSS JOIN generate_series(3, 92) AS d
CROSS JOIN LATERAL (SELECT CASE WHEN extract(dow FROM now() - d * interval '1 day') IN (5,6)
                               THEN floor(random()*4)::int ELSE (random() < 0.25)::int END AS n) k
CROSS JOIN LATERAL generate_series(1, k.n) AS i
CROSS JOIN LATERAL (SELECT date_trunc('day', now() - d * interval '1 day') + interval '18 hours'
                           + (i * 50 + floor(random()*30) + 0*k.n) * interval '1 minute' AS t) tt
CROSS JOIN LATERAL (SELECT * FROM menu OFFSET floor(random()*{len(sc['menu'])})::int + 0*i LIMIT 1) m
CROSS JOIN LATERAL (SELECT * FROM places OFFSET floor(random()*{len(V)})::int + 0*i LIMIT 1) pl;""")
    def log_row(d, user, when_sql, session=None):
        v = V[d['venue']]
        return (f"('{d['id']}', '{U(user + 1)}', {q(session)}, {q(d['type'])}, {q(d['name'])}, {q(d.get('brand'))}, {d.get('qty', 1)}, "
                f"{q(v['name'])}, {v['lat']}, {v['lng']}, {q(d.get('note'))}, {d.get('rating') or 'NULL'}, {when_sql}, {when_sql})")
    cols = '(id, user_id, session_id, drink_type, drink_name, brand, quantity, location_name, location_lat, location_lng, notes, rating, logged_at, created_at)'
    o.append(f'INSERT INTO drink_logs {cols} VALUES ' + ',\n'.join(
        log_row(p, p['user'], f"now() - interval '{p['minutes_ago']} minutes'") for p in sc['posts']) + ';')
    for key, n in sc['nights'].items():
        start = f"now() - interval '{int(n['hours_ago'] * 60)} minutes'"
        o.append(f"INSERT INTO sessions (id, user_id, title, started_at, ended_at, created_at) VALUES ('{n['id']}', '{U(n['user'] + 1)}', "
                 f"{q(n['title'])}, {start}, {start} + interval '{int(n['length_h'] * 60)} minutes', {start});")
        o.append(f'INSERT INTO drink_logs {cols} VALUES ' + ',\n'.join(
            log_row(d, n['user'], f"{start} + interval '{d['offset_min']} minutes'", n['id']) for d in n['drinks']) + ';')
    # tags: the shared night's 2nd drink and the first two of yours
    tag = lambda did, users: o.append('INSERT INTO drink_tags (drink_log_id, user_id) VALUES ' + ', '.join(f"('{did}', '{U(u + 1)}')" for u in users) + ';')
    tag(sc['nights']['shared']['drinks'][1]['id'], [0, 3, 4])
    tag(sc['nights']['yours']['drinks'][0]['id'], [1, 3])
    # media: slots (this run's picks, else library defaults)
    for s in sc['slots']:
        o.append(f"UPDATE drink_logs SET media = pg_temp.slot({q(s['slot'])}, {', '.join(q(x) for x in s['defaults'])}) WHERE id = '{s['post']}';")
    o.append('CREATE TEMP TABLE name_photos(drink_name text, names text[]);')
    o.append('INSERT INTO name_photos VALUES ' + ', '.join(f"({q(n)}, ARRAY[{', '.join(q(x) for x in v)}])" for n, v in BY_NAME.items()) + ';')
    o.append("""UPDATE drink_logs l SET media = pg_temp.stock(np.names[1 + floor(random() * array_length(np.names, 1))::int])
FROM name_photos np WHERE np.drink_name = l.drink_name AND l.media = '[]'::jsonb AND l.id::text NOT LIKE '00000000-%' AND random() < 0.25;""")
    o.append("""INSERT INTO drink_likes (drink_log_id, user_id) SELECT l.id, p.id FROM drink_logs l JOIN profiles p ON p.id <> l.user_id
WHERE l.id::text LIKE '00000000-0000-4000-b000-%' AND random() < 0.7;""")
    c = sc['comments']
    targets = [(sc['posts'][0]['id'], 4, 30), (sc['posts'][1]['id'], 5, 60), (sc['posts'][3]['id'], 2, 180),
               (sc['nights']['shared']['drinks'][1]['id'], 4, 22 * 60), (sc['nights']['shared']['drinks'][1]['id'], 5, 21 * 60),
               (sc['nights']['yours']['drinks'][0]['id'], 2, 8 * 24 * 60)]
    o.append('INSERT INTO drink_comments (drink_log_id, user_id, content, created_at) VALUES ' + ', '.join(
        f"('{did}', '{U(u)}', {q(c[k])}, now() - interval '{m} minutes')" for k, (did, u, m) in enumerate(targets)) + ';')
    o.append('DELETE FROM in_app_notifications;')
    o.append('SELECT refresh_drink_catalog();')
    return '\n'.join(o)


def summary(sc):
    return {'seed': sc['seed'], 'city': sc['city'], 'cast': [p['name'] for p in sc['people']],
            'you': sc['people'][0]['name'], 'nights': [n['title'] for n in sc['nights'].values()] + [sc['start_title']],
            'venues': [v['name'] for v in sc['venues']], 'event': sc.get('event')}


def load(path=None):
    path = path or DEFAULT_FILE
    if os.path.exists(path):
        return json.load(open(path))
    return new([], seed=1)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(2)
    if a[0] == 'new':
        ev = None
        if '--event' in a:
            i = a.index('--event'); ev_id = a[i + 1]; del a[i:i + 2]
            sys.path.insert(0, os.path.join(HERE, '..'))
            import events
            ev = events.BY_ID[ev_id]
        h = json.load(open(a[1])) if os.path.exists(a[1]) and os.path.getsize(a[1]) else []
        sc = new(h, int(a[3]) if len(a) > 3 else None, ev)
        json.dump(sc, open(a[2], 'w'), indent=1, ensure_ascii=False)
        print(json.dumps(summary(sc), ensure_ascii=False))
    elif a[0] == 'sql':
        print(sql(load(a[1] if len(a) > 1 else None)))
    elif a[0] == 'json':
        print(json.dumps(load(a[1] if len(a) > 1 else None), ensure_ascii=False))
    elif a[0] == 'summary':
        print(json.dumps(summary(load(a[1] if len(a) > 1 else None)), ensure_ascii=False))
    else:
        print(__doc__); sys.exit(2)
