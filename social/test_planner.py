"""python3 -m unittest social/test_planner.py"""
import datetime as dt, json, os, subprocess, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import planner

SUBJ = ['log-a-drink', 'night-out', 'map', 'profile', 'feed']


def write(path, obj):
    with open(path, 'w') as f:
        json.dump(obj, f)


def post(date, type_, subject, hook):
    return {'date': date, 'type': type_, 'subject': subject, 'hook': hook}


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
        e = planner.check(self.music_history(), post('2026-11-10', 'reel', 'profile', 'Know your numbers'))
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


if __name__ == '__main__':
    unittest.main()
