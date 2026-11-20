"""python3 -m unittest social/test_planner.py"""
import datetime as dt, json, os, subprocess, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import planner

SUBJ = ['log-a-drink', 'night-out', 'map', 'profile', 'feed']


def write(path, obj):
    with open(path, 'w') as f:
        json.dump(obj, f)


_seed = [0]


def scen(city=None, cast=None, nights=None, venues=None):
    _seed[0] += 1
    return {'seed': _seed[0], 'city': city or f'City{_seed[0]}', 'cast': cast or [f'P{_seed[0]}a X', f'P{_seed[0]}b Y'],
            'nights': nights or [f'Night {_seed[0]}'], 'venues': venues or [f'Venue {_seed[0]}']}


def post(date, type_, subject, hook, **sc):
    p = {'date': date, 'type': type_, 'subject': subject, 'hook': hook, 'scenario': scen(**sc)}
    if type_ == 'reel':
        p['music'] = {'style': f'style{_seed[0]}', 'key': 'C major', 'bpm': 100, 'progression': _seed[0]}
    return p


class PlannerRules(unittest.TestCase):
    def setUp(self):
        self.h = [post('2026-11-01', 'reel', 'log-a-drink', 'Your night out, logged in 5 seconds'),
                  post('2026-11-02', 'still', 'map', 'Every spot on one map'),
                  post('2026-11-03', 'reel', 'night-out', 'One tap starts the party')]

    def errs(self, p):
        return planner.check(self.h, p)

    def test_ok(self):
        self.assertEqual(self.errs(post('2026-11-10', 'still', 'profile', 'Know your numbers')), [])

    def music_history(self):
        h = [post('2026-11-01', 'reel', 'log-a-drink', 'alpha one'), post('2026-11-02', 'still', 'map', 'beta two'),
             post('2026-11-03', 'reel', 'night-out', 'gamma three'), post('2026-11-04', 'still', 'feed', 'delta four')]
        h[0]['music'] = {'style': 'house', 'key': 'A minor', 'bpm': 120, 'progression': 1}
        h[2]['music'] = {'style': 'lofi', 'key': 'C major', 'bpm': 85, 'progression': 0}
        return h

    def test_reel_needs_music(self):
        p = post('2026-11-10', 'reel', 'profile', 'Know your numbers'); p.pop('music')
        e = planner.check(self.music_history(), p)
        self.assertTrue(any('no "music"' in x for x in e), e)

    def test_music_style_gap(self):
        p = post('2026-11-10', 'reel', 'profile', 'Know your numbers')
        p['music'] = {'style': 'house', 'key': 'D minor', 'bpm': 122, 'progression': 3}
        e = planner.check(self.music_history(), p)
        self.assertTrue(any('last 2 reels' in x for x in e), e)
        p['music']['style'] = 'tropical'
        self.assertEqual(planner.check(self.music_history(), p), [])

    def test_exact_track_never_repeats(self):
        h = self.music_history() + [post('2026-11-06', 'reel', 'feed', 'eps five'), post('2026-11-07', 'still', 'map', 'zeta six'),
                                     post('2026-11-08', 'reel', 'map', 'eta seven')]
        h[4]['music'] = {'style': 'acoustic', 'key': 'E major', 'bpm': 90, 'progression': 2}
        h[6]['music'] = {'style': 'synthpop', 'key': 'E major', 'bpm': 104, 'progression': 2}
        p = post('2026-11-10', 'reel', 'profile', 'Know your numbers')
        p['music'] = {'style': 'house', 'key': 'A minor', 'bpm': 120, 'progression': 1}
        e = planner.check(h, p)
        self.assertTrue(any('exact music track' in x for x in e), e)

    def test_suggest_music(self):
        s = planner.suggest(self.music_history(), dt.date(2026, 11, 10))
        self.assertNotIn('house', s['music_styles']); self.assertNotIn('lofi', s['music_styles'])
        self.assertEqual(len(s['music_styles']), 4)

    def test_one_per_date(self):
        self.assertTrue(any('already posted' in e for e in self.errs(post('2026-11-03', 'still', 'profile', 'Fresh words here'))))

    def test_type_twice_in_a_row(self):
        self.assertTrue(any('same type' in e for e in self.errs(post('2026-11-10', 'reel', 'profile', 'Know your numbers'))))

    def test_type_subject_cycle(self):
        e = self.errs(post('2026-11-20', 'still', 'map', 'Brand new angle entirely')) + \
            self.errs(post('2026-11-20', 'reel', 'log-a-drink', 'Brand new angle entirely'))
        self.assertTrue(any('this cycle' in x for x in e), e)

    def test_cycle_resets_when_all_used(self):
        h, d = [], dt.date(2026, 10, 1)
        for i, s in enumerate(SUBJ):
            h.append(post((d + dt.timedelta(days=2 * i)).isoformat(), 'reel', s, f'hook{i} alpha{i} beta{i}'))
            h.append(post((d + dt.timedelta(days=2 * i + 1)).isoformat(), 'still', 'feed', f'still{i} gamma{i} delta{i}'))
        p = post('2026-11-30', 'reel', 'log-a-drink', 'Totally fresh hook text')
        self.assertFalse(any('this cycle' in x for x in planner.check(h, p)))

    def test_subject_gap(self):
        e = self.errs(post('2026-11-05', 'still', 'night-out', 'Brand new angle entirely'))
        self.assertTrue(any('day(s) ago' in x for x in e), e)

    def test_hook_overlap(self):
        e = self.errs(post('2026-11-10', 'still', 'profile', 'Logged your night out in seconds'))
        self.assertTrue(any('hook shares' in x for x in e), e)

    def test_hook_two_words_is_fine(self):
        self.assertEqual(self.errs(post('2026-11-10', 'still', 'profile', 'Your night, your numbers')), [])

    def test_suggest(self):
        s = planner.suggest(self.h, dt.date(2026, 11, 10))
        self.assertEqual(s['plan'][0]['type'], 'still')
        self.assertNotIn('map', s['plan'][0]['subjects'])

    def test_cli_and_directory_history(self):
        with tempfile.TemporaryDirectory() as d:
            for r in self.h:
                os.makedirs(os.path.join(d, r['date']))
                write(os.path.join(d, r['date'], 'post.json'), r)
            pj = os.path.join(d, 'new.json')
            write(pj, post('2026-11-10', 'still', 'profile', 'Know your numbers'))
            out = subprocess.run([sys.executable, planner.__file__, 'check', d, pj], capture_output=True, text=True)
            self.assertEqual(out.stdout.strip(), 'OK')
            write(pj, post('2026-11-03', 'reel', 'night-out', 'x'))
            out = subprocess.run([sys.executable, planner.__file__, 'check', d, pj], capture_output=True, text=True)
            self.assertEqual(out.returncode, 1)
            self.assertTrue(out.stdout.startswith('REFUSED'))


class ScenarioRules(unittest.TestCase):
    def setUp(self):
        self.h = [post('2026-11-01', 'reel', 'feed', 'alpha one', city='Austin', cast=['Maya Chen', 'Theo Kim'],
                       nights=["Rosa's birthday", 'Trivia night'], venues=['The Blue Fox']),
                  post('2026-11-02', 'still', 'map', 'beta two', city='Denver')]
        self.h[0]['photos'] = ['https://unsplash.com/photos/abc']

    def test_needs_scenario(self):
        p = post('2026-11-10', 'reel', 'profile', 'Know your numbers'); p.pop('scenario')
        self.assertTrue(any('no "scenario"' in x for x in planner.check(self.h, p)))

    def test_same_city_as_previous(self):
        e = planner.check(self.h, post('2026-11-10', 'reel', 'profile', 'Know your numbers', city='Denver'))
        self.assertTrue(any('same city' in x for x in e), e)

    def test_people_nights_venues_not_reused(self):
        p = post('2026-11-10', 'reel', 'profile', 'Know your numbers', city='Chicago', cast=['Maya Novak'],
                 nights=["Ezra's birthday"], venues=['The Blue Fox'])
        e = ' | '.join(planner.check(self.h, p))
        self.assertIn('people reused', e); self.assertIn('nights out reused', e); self.assertIn('venues reused', e)

    def test_photos_never_reused(self):
        p = post('2026-11-10', 'reel', 'profile', 'Know your numbers', city='Chicago')
        p['photos'] = ['https://unsplash.com/photos/abc']
        self.assertTrue(any('photos used' in x for x in planner.check(self.h, p)))

    def test_fresh_scenario_ok(self):
        self.assertEqual(planner.check(self.h, post('2026-11-10', 'reel', 'profile', 'Know your numbers', city='Chicago')), [])


import events


class EventRules(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(events.occurrence(events.BY_ID['thanksgiving-us'], 2026), dt.date(2026, 11, 26))
        self.assertEqual(events.occurrence(events.BY_ID['thanksgiving-ca'], 2026), dt.date(2026, 10, 12))
        self.assertEqual(events.occurrence(events.BY_ID['mardi-gras'], 2027), dt.date(2027, 2, 9))
        self.assertEqual(events.occurrence(events.BY_ID['super-bowl'], 2027), dt.date(2027, 2, 14))

    def test_sunday_event_posts_on_saturday(self):
        days = {3, 4, 5, 6}
        now, _ = events.due(dt.date(2027, 2, 13), [], days)
        self.assertEqual(now[0]['id'], 'super-bowl')

    def test_two_events_one_weekend_get_different_days(self):
        days = {3, 4, 5, 6}
        s = events.schedule(2027, days)
        self.assertNotEqual(s['super-bowl'][1], s['valentines'][1])
        self.assertEqual(len({b for _, b in s.values()}), len(s))

    def test_not_due_outside_window(self):
        self.assertEqual(events.due(dt.date(2026, 11, 20), [], {3, 4, 5, 6})[0], [])

    def test_once_a_year(self):
        h = [dict(post('2026-11-21', 'reel', 'night-out', 'friends first'), event='friendsgiving')]
        self.assertEqual([e['id'] for e in events.due(dt.date(2026, 11, 21), h, {3, 4, 5, 6})[0]], [])
        p = post('2026-11-22', 'still', 'feed', 'grateful crew'); p['event'] = 'friendsgiving'
        e = ' | '.join(planner.check(h, p))
        self.assertTrue('already posted this year' in e or 'not due' in e, e)

    def test_event_outside_window_refused(self):
        p = post('2026-11-20', 'still', 'feed', 'grateful crew'); p['event'] = 'thanksgiving-us'
        self.assertTrue(any('not due' in x for x in planner.check([], p)))

    def test_event_in_window_ok(self):
        p = post('2026-11-26', 'still', 'feed', 'hometown spots'); p['event'] = 'thanksgiving-us'
        self.assertEqual(planner.check([], p), [])


if __name__ == '__main__':
    unittest.main()
