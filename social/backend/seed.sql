-- Demo data for footage capture. Fictional people and places; no photos of
-- faces (avatars are plain initials rendered by the app). All times are
-- relative to now(), so every run's feed looks current. Deterministic:
-- setseed() makes the "random" history the same every run.
SET search_path = public, extensions;
SELECT setseed(0.42);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('00000000-0000-4000-a000-000000000001','jordan@example.com','{"username":"jordanr","display_name":"Jordan Reyes"}'),
 ('00000000-0000-4000-a000-000000000002','maya@example.com',  '{"username":"mayachen","display_name":"Maya Chen"}'),
 ('00000000-0000-4000-a000-000000000003','sam@example.com',   '{"username":"samokafor","display_name":"Sam Okafor"}'),
 ('00000000-0000-4000-a000-000000000004','priya@example.com', '{"username":"priyap","display_name":"Priya Patel"}'),
 ('00000000-0000-4000-a000-000000000005','luke@example.com',  '{"username":"lukeb","display_name":"Luke Brennan"}'),
 ('00000000-0000-4000-a000-000000000006','tess@example.com',  '{"username":"tessr","display_name":"Tess Romero"}');

UPDATE profiles SET onboarded = true, subscription_tier = 'premium',
  created_at = now() - interval '200 days';
UPDATE profiles SET bio = 'IPA person. Trying to hit my weekly goal (the low one).'
  WHERE username = 'jordanr';

INSERT INTO user_private_metrics (user_id, height, height_unit, weight, weight_unit, birthdate)
SELECT id, 70, 'in', 175, 'lb', date '1994-06-12' FROM profiles
ON CONFLICT (user_id) DO UPDATE SET birthdate = excluded.birthdate, height = excluded.height,
  height_unit = excluded.height_unit, weight = excluded.weight, weight_unit = excluded.weight_unit;

-- Everyone follows everyone.
INSERT INTO follows (follower_id, following_id, created_at)
SELECT a.id, b.id, now() - interval '150 days' FROM profiles a, profiles b WHERE a.id <> b.id;

INSERT INTO goals (user_id, weekly_limit) VALUES ('00000000-0000-4000-a000-000000000001', 8);

-- Places: fictional venues at real-looking coordinates across Denver neighborhoods
-- (mirrored in capture/lib.js so the geocoder stand-in agrees).
CREATE TEMP TABLE places(name text, lat numeric, lng numeric);
INSERT INTO places VALUES
 ('The Copper Tap', 39.7527, -104.9997),
 ('Larkspur Wine Bar', 39.7392, -104.9849),
 ('Half Moon Brewing', 39.7621, -104.981),
 ('Ridgeline Taproom', 39.685, -104.98),
 ('Juniper & Rye', 39.7469, -104.992),
 ('Sunset Rooftop', 39.7505, -105.0004),
 ('Mile High Cider House', 39.768, -104.973),
 ('Lantern Room', 39.7765, -105.0435),
 ('Bluebird Social', 39.7402, -104.961),
 ('Hollow Oak Pub', 39.711, -104.9875),
 ('Parkside Beer Garden', 39.747, -104.953),
 ('The Low Ceiling', 39.7745, -105.0055),
 ('Saltwater Oyster Bar', 39.7195, -104.9535),
 ('Second Story Lounge', 39.762, -105.011),
 ('Lakeview Patio', 39.75, -105.045),
 ('Gilded Fox', 39.733, -104.98),
 ('Brick & Barrel', 39.76, -104.987),
 ('Willow Wine Co.', 39.699, -104.961),
 ('Fieldhouse Taps', 39.756, -104.994),
 ('Night Owl Bar', 39.727, -104.999);

CREATE TEMP TABLE menu(drink_type text, drink_name text, brand text);
INSERT INTO menu VALUES
 ('beer','Hazy IPA','Half Moon'), ('beer','Pilsner','Copper Tap'), ('beer','Stout','Ridgeline'),
 ('wine','Pinot Noir',NULL), ('wine','Sauvignon Blanc',NULL), ('cocktail','Margarita',NULL),
 ('cocktail','Old Fashioned',NULL), ('cocktail','Espresso Martini',NULL), ('cider','Dry Apple Cider','Mile High'),
 ('seltzer','Black Cherry Seltzer',NULL), ('spirit','Mezcal, neat',NULL), ('mocktail','Ginger Nojito',NULL);

-- ~90 days of history for everyone: 0-3 drinks on roughly 40% of days, more on weekends.
INSERT INTO drink_logs (user_id, drink_type, drink_name, brand, quantity, location_name, location_lat, location_lng,
                        logged_at, created_at, rating)
SELECT p.id, m.drink_type, m.drink_name, m.brand, 1, pl.name, pl.lat, pl.lng, t, t, 6 + floor(random()*5)::int
FROM profiles p
CROSS JOIN generate_series(3, 92) AS d
CROSS JOIN LATERAL (SELECT CASE WHEN extract(dow FROM now() - d * interval '1 day') IN (5,6)
                               THEN floor(random()*4)::int ELSE (random() < 0.25)::int END AS n) k
CROSS JOIN LATERAL generate_series(1, k.n) AS i
CROSS JOIN LATERAL (SELECT date_trunc('day', now() - d * interval '1 day') + interval '18 hours'
                           + (i * 50 + floor(random()*30) + 0*k.n) * interval '1 minute' AS t) tt
CROSS JOIN LATERAL (SELECT * FROM menu OFFSET floor(random()*12)::int + 0*i LIMIT 1) m
CROSS JOIN LATERAL (SELECT * FROM places OFFSET floor(random()*20)::int + 0*i LIMIT 1) pl;

-- Recent, hand-written posts that make the top of the feed look alive.
INSERT INTO drink_logs (id, user_id, drink_type, drink_name, brand, quantity, location_name, location_lat, location_lng,
                        notes, rating, logged_at, created_at) VALUES
 ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000002','cocktail','Espresso Martini',NULL,1,
  'Juniper & Rye',39.7469,-104.9920,'Post-work reset ☕🍸',9, now()-interval '35 minutes', now()-interval '35 minutes'),
 ('00000000-0000-4000-b000-000000000002','00000000-0000-4000-a000-000000000003','beer','Hazy IPA','Half Moon',2,
  'Half Moon Brewing',39.7621,-104.9810,'New release is dangerously smooth',8, now()-interval '1 hour 20 minutes', now()-interval '1 hour 20 minutes'),
 ('00000000-0000-4000-b000-000000000003','00000000-0000-4000-a000-000000000004','wine','Pinot Noir',NULL,1,
  'Larkspur Wine Bar',39.7392,-104.9849,NULL,8, now()-interval '2 hours 40 minutes', now()-interval '2 hours 40 minutes'),
 ('00000000-0000-4000-b000-000000000004','00000000-0000-4000-a000-000000000006','mocktail','Ginger Nojito',NULL,1,
  'Sunset Rooftop',39.7505,-105.0004,'Sober October went so well I kept going',9, now()-interval '4 hours', now()-interval '4 hours'),
 ('00000000-0000-4000-b000-000000000005','00000000-0000-4000-a000-000000000005','cider','Dry Apple Cider','Mile High',1,
  'Mile High Cider House',39.7680,-104.9730,NULL,7, now()-interval '6 hours', now()-interval '6 hours');

-- A finished Night Out session (shows as one grouped card in the feed).
INSERT INTO sessions (id, user_id, title, started_at, ended_at, created_at) VALUES
 ('00000000-0000-4000-c000-000000000001','00000000-0000-4000-a000-000000000005','Trivia night',
  now()-interval '5 hours 30 minutes', now()-interval '2 hours', now()-interval '5 hours 30 minutes');
INSERT INTO drink_logs (id, user_id, session_id, drink_type, drink_name, quantity, location_name, location_lat, location_lng, logged_at, created_at)
SELECT ('00000000-0000-4000-b000-00000000010' || n)::uuid, '00000000-0000-4000-a000-000000000005',
       '00000000-0000-4000-c000-000000000001', t, nm, 1, 'Ridgeline Taproom', 39.7180, -104.9566,
       now() - interval '5 hours' + n * interval '40 minutes', now() - interval '5 hours' + n * interval '40 minutes'
FROM (VALUES (1,'beer','Pilsner'),(2,'beer','Stout'),(3,'cocktail','Margarita'),(4,'water','Water'),(5,'beer','Pilsner')) v(n,t,nm);

-- A shared Night Out from last night with friends tagged and a crowd photo.
INSERT INTO sessions (id, user_id, title, started_at, ended_at, created_at) VALUES
 ('00000000-0000-4000-c000-000000000002','00000000-0000-4000-a000-000000000003','Patio night',
  now()-interval '26 hours', now()-interval '21 hours', now()-interval '26 hours');
INSERT INTO drink_logs (id, user_id, session_id, drink_type, drink_name, brand, quantity, location_name, location_lat, location_lng,
                        notes, logged_at, created_at)
SELECT ('00000000-0000-4000-b000-00000000020' || n)::uuid, '00000000-0000-4000-a000-000000000003',
       '00000000-0000-4000-c000-000000000002', t, nm, br, 1, 'Sunset Rooftop', 39.7505, -105.0004, note,
       now() - interval '26 hours' + n * interval '55 minutes', now() - interval '26 hours' + n * interval '55 minutes'
FROM (VALUES (1,'beer','Pilsner','Copper Tap',NULL),(2,'beer','Hazy IPA','Half Moon','first round on @priyap'),
             (3,'cocktail','Margarita',NULL,NULL),(4,'water','Water',NULL,'hydration check')) v(n,t,nm,br,note);
INSERT INTO drink_tags (drink_log_id, user_id)
SELECT '00000000-0000-4000-b000-000000000202'::uuid, id FROM profiles WHERE username IN ('priyap','lukeb','mayachen');

-- Your own Night Out from last weekend: drinks over a few hours, photos, friends tagged.
INSERT INTO sessions (id, user_id, title, started_at, ended_at, created_at) VALUES
 ('00000000-0000-4000-c000-000000000003','00000000-0000-4000-a000-000000000001','Mia''s birthday',
  date_trunc('day', now()) - interval '9 days' + interval '19 hours 30 minutes',
  date_trunc('day', now()) - interval '9 days' + interval '24 hours 50 minutes',
  date_trunc('day', now()) - interval '9 days' + interval '19 hours 30 minutes');
INSERT INTO drink_logs (id, user_id, session_id, drink_type, drink_name, brand, quantity, location_name, location_lat, location_lng,
                        notes, rating, logged_at, created_at)
SELECT ('00000000-0000-4000-b000-00000000030' || n)::uuid, '00000000-0000-4000-a000-000000000001',
       '00000000-0000-4000-c000-000000000003', t, nm, br, 1, pl, la, ln, note, r,
       date_trunc('day', now()) - interval '9 days' + interval '19 hours 40 minutes' + mins * interval '1 minute',
       date_trunc('day', now()) - interval '9 days' + interval '19 hours 40 minutes' + mins * interval '1 minute'
FROM (VALUES
  (1,'cocktail','Margarita',NULL,'Juniper & Rye',39.7469,-104.9920,'birthday girl picked the spot',8,0),
  (2,'beer','Pilsner','Copper Tap','Juniper & Rye',39.7469,-104.9920,NULL,7,55),
  (3,'water','Water',NULL,'Juniper & Rye',39.7469,-104.9920,NULL,NULL,95),
  (4,'cocktail','Espresso Martini',NULL,'Sunset Rooftop',39.7505,-105.0004,'second wind',9,150),
  (5,'mocktail','Ginger Nojito',NULL,'Sunset Rooftop',39.7505,-105.0004,'pacing myself',8,215),
  (6,'beer','Hazy IPA','Half Moon','Half Moon Brewing',39.7621,-104.9810,'last round',8,265)
) v(n,t,nm,br,pl,la,ln,note,r,mins);
INSERT INTO drink_tags (drink_log_id, user_id)
SELECT ('00000000-0000-4000-b000-00000000030' || n)::uuid, p.id FROM generate_series(1, 6) n, profiles p
WHERE p.username IN ('mayachen', 'priyap') AND n IN (1, 4);

-- Photos on the posts. Each slot (social/media/slots.json) uses this run's picks if any
-- (social/media/pick.py), else these library defaults.
UPDATE drink_logs SET media = pg_temp.stock('clip-garnish') || pg_temp.slot('maya-espresso', 'espresso-martini-1') WHERE id = '00000000-0000-4000-b000-000000000001';
UPDATE drink_logs SET media = pg_temp.slot('sam-ipa', 'two-pints') WHERE id = '00000000-0000-4000-b000-000000000002';
UPDATE drink_logs SET media = pg_temp.slot('priya-wine', 'red-wine-pour', 'wine-glasses-hand') WHERE id = '00000000-0000-4000-b000-000000000003';
UPDATE drink_logs SET media = pg_temp.slot('tess-mocktail', 'mocktail-mint') WHERE id = '00000000-0000-4000-b000-000000000004';
UPDATE drink_logs SET media = pg_temp.slot('luke-cider', 'cider') WHERE id = '00000000-0000-4000-b000-000000000005';
UPDATE drink_logs SET media = pg_temp.slot('luke-trivia', 'beer-trio', 'bar-hands') WHERE id = '00000000-0000-4000-b000-000000000101';
UPDATE drink_logs SET media = pg_temp.slot('luke-margarita', 'margarita-1') WHERE id = '00000000-0000-4000-b000-000000000103';
UPDATE drink_logs SET media = pg_temp.slot('patio-night', 'string-lights-crowd', 'patio-crowd-night') WHERE id = '00000000-0000-4000-b000-000000000202';
UPDATE drink_logs SET media = pg_temp.slot('patio-margarita', 'margarita-night') WHERE id = '00000000-0000-4000-b000-000000000203';
UPDATE drink_logs SET media = pg_temp.slot('mia-cheers', 'cheers-patio', 'margarita-2') WHERE id = '00000000-0000-4000-b000-000000000301';
UPDATE drink_logs SET media = pg_temp.slot('mia-espresso', 'espresso-martini-2', 'rooftop-night') WHERE id = '00000000-0000-4000-b000-000000000304';
UPDATE drink_logs SET media = pg_temp.slot('mia-mocktail', 'mocktail-purple') WHERE id = '00000000-0000-4000-b000-000000000305';
UPDATE drink_logs SET media = pg_temp.slot('mia-ipa', 'flight-hand') WHERE id = '00000000-0000-4000-b000-000000000306';
-- About a quarter of the history gets a photo matching its drink type.
CREATE TEMP TABLE type_photos(drink_type text, names text[]);
INSERT INTO type_photos VALUES
 ('beer', ARRAY['pint-pale','beer-railing','beers-table','flight-hand','beer-garden-dusk']),
 ('wine', ARRAY['red-wine-1','red-wine-2','champagne']),
 ('cocktail', ARRAY['espresso-martini-2','margarita-2','margarita-strawberry','old-fashioned-1','old-fashioned-2','cocktail-coupe']),
 ('cider', ARRAY['cider']), ('mocktail', ARRAY['mocktail-purple','mocktail-lavender']),
 ('spirit', ARRAY['old-fashioned-2']), ('seltzer', ARRAY['bar-hands']);
UPDATE drink_logs l SET media = pg_temp.stock(tp.names[1 + floor(random() * array_length(tp.names, 1))::int])
FROM type_photos tp
WHERE tp.drink_type = l.drink_type AND l.media = '[]'::jsonb AND l.id::text NOT LIKE '00000000-%' AND random() < 0.25;

INSERT INTO drink_likes (drink_log_id, user_id)
SELECT l.id, p.id FROM drink_logs l JOIN profiles p ON p.id <> l.user_id
WHERE l.id::text LIKE '00000000-0000-4000-b000-%' AND random() < 0.7;

INSERT INTO drink_comments (drink_log_id, user_id, content, created_at) VALUES
 ('00000000-0000-4000-b000-000000000301','00000000-0000-4000-a000-000000000002','happy birthday mia!!', now()-interval '8 days'),
 ('00000000-0000-4000-b000-000000000304','00000000-0000-4000-a000-000000000004','that rooftop 😍', now()-interval '8 days'),
 ('00000000-0000-4000-b000-000000000202','00000000-0000-4000-a000-000000000004','best patio in town', now()-interval '22 hours'),
 ('00000000-0000-4000-b000-000000000202','00000000-0000-4000-a000-000000000005','same time next week?', now()-interval '21 hours'),
 ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000004','saving me a seat?', now()-interval '30 minutes'),
 ('00000000-0000-4000-b000-000000000002','00000000-0000-4000-a000-000000000005','omw', now()-interval '1 hour'),
 ('00000000-0000-4000-b000-000000000004','00000000-0000-4000-a000-000000000002','proud of you!!', now()-interval '3 hours');

-- Notifications produced by the seed's triggers would be noise.
DELETE FROM in_app_notifications;
SELECT refresh_drink_catalog();
