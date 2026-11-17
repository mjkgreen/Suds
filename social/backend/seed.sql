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

-- Places (fictional names, real-looking coordinates around Denver).
CREATE TEMP TABLE places(name text, lat numeric, lng numeric);
INSERT INTO places VALUES
 ('The Copper Tap', 39.7527, -104.9997), ('Larkspur Wine Bar', 39.7392, -104.9849),
 ('Half Moon Brewing', 39.7621, -104.9810), ('Ridgeline Taproom', 39.7180, -104.9566),
 ('Juniper & Rye', 39.7469, -104.9920), ('Sunset Rooftop', 39.7505, -105.0004),
 ('Mile High Cider House', 39.7680, -104.9730);

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
CROSS JOIN LATERAL (SELECT * FROM places OFFSET floor(random()*7)::int + 0*i LIMIT 1) pl;

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

INSERT INTO drink_likes (drink_log_id, user_id)
SELECT l.id, p.id FROM drink_logs l JOIN profiles p ON p.id <> l.user_id
WHERE l.id::text LIKE '00000000-0000-4000-b000-%' AND random() < 0.7;

INSERT INTO drink_comments (drink_log_id, user_id, content, created_at) VALUES
 ('00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000004','saving me a seat?', now()-interval '30 minutes'),
 ('00000000-0000-4000-b000-000000000002','00000000-0000-4000-a000-000000000005','omw', now()-interval '1 hour'),
 ('00000000-0000-4000-b000-000000000004','00000000-0000-4000-a000-000000000002','proud of you!!', now()-interval '3 hours');

-- Notifications produced by the seed's triggers would be noise.
DELETE FROM in_app_notifications;
SELECT refresh_drink_catalog();
