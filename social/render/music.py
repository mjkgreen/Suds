#!/usr/bin/env python3
"""Original background music for reels, synthesized fresh for every post.

Nothing licensed or sampled: every sound is generated here. Each render picks a
style (or is told one), then a random key, tempo, chord progression and drum
pattern from a seed, so no two posts share a track.

  python3 music.py <style|random> <seconds> <out.wav> [seed]   # try one out
  music.STYLES                                                 # style names

make(style, duration, taps_s, out_wav, seed, outro_at) -> signature dict
  (style, key, mode, bpm, progression, seed), recorded in post.json so the
  planner can keep the music from repeating.
"""
import json, sys, wave
import numpy as np

SR = 44100
NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
# Chord progressions as scale degrees (0-based) for each mode.
PROGRESSIONS = {
    'major': [[0, 4, 5, 3], [0, 5, 3, 4], [3, 4, 0, 5], [0, 3, 4, 3], [5, 3, 0, 4], [0, 2, 3, 4]],
    'minor': [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [5, 6, 0, 0], [0, 3, 6, 2], [0, 4, 5, 3]],
}
SCALES = {'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10]}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# ---------- instruments ----------

def env(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    """ADSR envelope of n samples; `hold` = seconds before release (default: n - r)."""
    t = np.arange(n) / SR
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > hold
    e[rel] *= np.exp(-(t[rel] - hold) / max(r / 4, 1e-4))
    return e


def osc(f, n, kind='sine', harmonics=8):
    t = np.arange(n) / SR
    if kind == 'sine':
        return np.sin(2 * np.pi * f * t)
    if kind == 'saw':   # band-limited
        return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, harmonics + 1)) * 0.6
    if kind == 'square':
        return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, harmonics * 2, 2)) * 0.8
    if kind == 'tri':
        return sum(((-1) ** ((k - 1) // 2)) * np.sin(2 * np.pi * f * k * t) / k ** 2 for k in range(1, harmonics * 2, 2)) * 0.8
    raise ValueError(kind)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):          # short buffers only (single notes)
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def pluck(f, n, rng, bright=0.5):
    """Karplus-Strong plucked string (guitar / harp-ish)."""
    p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.994 + 0.005 * bright)
    return out


def keys(f, n):      # electric-piano-ish: sine + bell partial, fast decay
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t * 8)) * np.exp(-t * 2.2)


def marimba(f, n):
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30)) * np.exp(-t * 7)


def kick(n, punch=1.0):
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (45 + 110 * punch * np.exp(-t * 35)) * t) * np.exp(-t * 9)


def snare(n, rng, tone=180):
    t = np.arange(n) / SR
    return (0.7 * rng.standard_normal(n) * np.exp(-t * 22) + 0.4 * np.sin(2 * np.pi * tone * t) * np.exp(-t * 30))


def clap(n, rng):
    t = np.arange(n) / SR
    e = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.01, 0.022))
    return rng.standard_normal(n) * e * 0.6


def hat(n, rng, open_=False):
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))       # crude high-pass
    return x * np.exp(-t * (9 if open_ else 55)) * 0.5


# ---------- arrangement ----------

class Track:
    def __init__(self, duration, bpm, rng):
        self.n = int(duration * SR)
        self.mix = np.zeros(self.n)
        self.beat = 60 / bpm
        self.rng = rng

    def add(self, at_s, sig, gain):
        s = int(at_s * SR)
        if s >= self.n or s < 0:
            return
        L = min(len(sig), self.n - s)
        self.mix[s:s + L] += gain * sig[:L]

    def beats(self):
        return int(self.n / SR / self.beat) + 1


def chord_notes(root, mode, degree, size=4, octave=0):
    sc = SCALES[mode]
    return [root + octave * 12 + sc[(degree + 2 * k) % 7] + 12 * ((degree + 2 * k) // 7) for k in range(size)]


def render(style, duration, seed=None, taps_s=()):
    rng = np.random.default_rng(seed)
    p = STYLES[style]
    mode = p['mode'] if p['mode'] != 'any' else rng.choice(['major', 'minor'])
    root = 48 + int(rng.integers(0, 12))           # C3..B3
    bpm = int(rng.integers(p['bpm'][0], p['bpm'][1] + 1))
    prog_i = int(rng.integers(0, len(PROGRESSIONS[mode])))
    prog = PROGRESSIONS[mode][prog_i]
    tr = Track(duration, bpm, rng)
    p['fn'](tr, root, mode, prog, rng)
    for ts in taps_s:                              # UI taps: a soft tick in key
        L = int(0.05 * SR); t = np.arange(L) / SR
        tr.add(ts, np.sin(2 * np.pi * hz(root + 36) * t) * np.exp(-t * 90), 0.12)
    x = tr.mix
    fade = int(1.2 * SR); x[-fade:] *= np.linspace(1, 0, fade)
    x[:int(0.03 * SR)] *= np.linspace(0, 1, int(0.03 * SR))
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.17          # same loudness for every style
    x = np.tanh(x * 1.1) / np.tanh(1.1)                      # soft limiter
    x = x / max(1.0, np.abs(x).max() / 0.89)
    sig = {'style': style, 'key': f"{NOTE_NAMES[root % 12]} {mode}", 'bpm': bpm,
           'progression': prog_i, 'seed': int(seed) if seed is not None else None}
    return x, sig


def write_wav(x, path):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1 if x.ndim == 1 else x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def make(style, duration, taps_s, out_wav, seed=None, outro_at=None):
    """outro_at: seconds where the end card starts; the bed fades out and the Suds theme plays."""
    if style in (None, 'random'):
        style = str(np.random.default_rng(seed).choice(sorted(STYLES)))
    x, sig = render(style, duration, seed, taps_s)
    if outro_at is not None:
        x = with_theme(x, outro_at)
    write_wav(x, out_wav)
    return sig


THEME_DB = -1.0     # the sting's loudness against the bed's: just under, so it doesn't jump out


def _biquad(x, b, a):
    y = np.empty_like(x); x1 = x2 = y1 = y2 = 0.0
    b0, b1, b2 = b[0] / a[0], b[1] / a[0], b[2] / a[0]; a1, a2 = a[1] / a[0], a[2] / a[0]
    for i in range(len(x)):
        y0 = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x[i], y1, y0; y[i] = y0
    return y


def _power(ch):
    """Mean power of channels (n, c) after K-weighting (ITU BS.1770, what LUFS uses), summed over channels."""
    w = 2 * np.pi * 1500 / SR; A = 10 ** (4 / 40); al = np.sin(w) / np.sqrt(2); c = np.cos(w); r = 2 * np.sqrt(A) * al
    shelf = ([A * ((A + 1) + (A - 1) * c + r), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - r)],
             [(A + 1) - (A - 1) * c + r, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - r])
    w = 2 * np.pi * 38 / SR; al = np.sin(w); c = np.cos(w)                       # Q = 0.5
    high = ([(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al])
    return sum(np.mean(_biquad(_biquad(ch[:, j], *shelf), *high) ** 2) for j in range(ch.shape[1])) + 1e-12


def with_theme(bed, at):
    """Fade the bed out across the end card's first moments and lay the Suds theme over it,
    matched to how loud the bed was just before.

    The bed is in a random key and the theme is in G, so the bed is gone by the
    time the theme's chord rings. Returns stereo (n, 2), as long as the bed."""
    import theme
    n = len(bed); t = np.arange(n) / SR
    k = np.clip((t - (at - 0.2)) / 0.6, 0, 1)        # 0.2 s before the card to 0.4 s into it
    out = np.repeat((bed * 0.5 * (1 + np.cos(np.pi * k)))[:, None], 2, axis=1)
    sting = theme.render()
    i = int(at * SR)
    ref = bed[max(0, i - 8 * SR):i]
    if len(ref) > SR:
        bed_p = _power(np.repeat(ref[:, None], 2, axis=1))
        sting = sting * np.sqrt(bed_p / _power(sting[:int(2.5 * SR)])) * 10 ** (THEME_DB / 20)
    m = min(len(sting), n - i)
    out[i:i + m] += sting[:m]
    return out / max(1.0, np.abs(out).max() / 0.89)


# ---------- styles ----------

def lofi(tr, root, mode, prog, rng):
    swing = 0.06 * tr.beat
    for b in range(tr.beats()):
        t = b * tr.beat
        deg = prog[(b // 4) % len(prog)]
        if b % 4 == 0:
            for m in chord_notes(root + 12, mode, deg):
                L = int(tr.beat * 4 * SR); tr.add(t, keys(hz(m), L) * env(L, 0.01, 1.5, 0.3, 0.3), 0.07)
            L = int(tr.beat * 2 * SR); tr.add(t, osc(hz(chord_notes(root - 12, mode, deg, 1)[0]), L) * env(L, 0.01, 0.6, 0.5, 0.2), 0.22)
        if b % 2 == 0 or rng.random() < 0.15:
            tr.add(t, kick(int(0.3 * SR), 0.6), 0.45)
        if b % 2 == 1:
            tr.add(t, snare(int(0.25 * SR), rng, 200) * 0.7, 0.18)
        for h in (0, 1):
            tr.add(t + h * tr.beat / 2 + (swing if h else 0), hat(int(0.06 * SR), rng), 0.06)
    noise = rng.standard_normal(tr.n) * 0.0012                # a little vinyl hiss
    tr.mix += noise


def house(tr, root, mode, prog, rng):
    stab_beats = [0.5, 1.5, 2.75] if rng.random() < 0.5 else [0.5, 2.5, 3.5]
    for b in range(tr.beats()):
        t = b * tr.beat
        deg = prog[(b // 8) % len(prog)]
        tr.add(t, kick(int(0.35 * SR), 1.0), 0.6)
        tr.add(t + tr.beat / 2, hat(int(0.2 * SR), rng, open_=True), 0.07)
        if b % 2 == 1:
            tr.add(t, clap(int(0.2 * SR), rng), 0.25)
        bass = hz(chord_notes(root - 12, mode, deg, 1)[0])
        L = int(tr.beat / 2 * SR)
        for o in (0.5,):
            tr.add(t + o * tr.beat, osc(bass * (2 if b % 2 else 1), L, 'saw', 6) * env(L, 0.005, 0.12, 0.3, 0.05), 0.16)
        if b % 4 in (0,):
            for sb in stab_beats:
                for m in chord_notes(root + 12, mode, deg, 3):
                    L = int(0.18 * SR); tr.add(t + sb * tr.beat, osc(hz(m), L, 'saw', 5) * env(L, 0.003, 0.08, 0.0, 0.05), 0.05)


def disco_funk(tr, root, mode, prog, rng):
    patt = [0, 0.75, 1.5, 2, 2.75, 3.5]
    for b in range(0, tr.beats(), 4):
        t = b * tr.beat
        deg = prog[(b // 4) % len(prog)]
        bass = chord_notes(root - 12, mode, deg, 1)[0]
        for k, pb in enumerate(patt):
            L = int(tr.beat * 0.4 * SR)
            tr.add(t + pb * tr.beat, osc(hz(bass + (12 if k % 2 else 0)), L, 'square', 4) * env(L, 0.004, 0.08, 0.4, 0.04), 0.14)
        for q in range(16):                                  # muted guitar chops on 16ths
            if q % 4 in (1, 3) or rng.random() < 0.2:
                m = chord_notes(root + 12, mode, deg, 3)[q % 3]
                L = int(0.09 * SR); tr.add(t + q * tr.beat / 4, pluck(hz(m), L, rng, 0.2), 0.05)
        for k in range(4):
            tr.add(t + k * tr.beat, kick(int(0.3 * SR), 0.8), 0.5)
            tr.add(t + k * tr.beat + tr.beat / 2, hat(int(0.15 * SR), rng, open_=True), 0.06)
            if k % 2:
                tr.add(t + k * tr.beat, clap(int(0.2 * SR), rng) + 0.5 * snare(int(0.2 * SR), rng), 0.2)


def tropical(tr, root, mode, prog, rng):
    for b in range(0, tr.beats(), 4):
        t = b * tr.beat
        deg = prog[(b // 4) % len(prog)]
        notes = chord_notes(root + 12, mode, deg, 4)
        for e8 in range(8):                                  # marimba arpeggio
            if rng.random() < 0.85:
                m = notes[[0, 2, 1, 3, 2, 1, 3, 2][e8]] + (12 if e8 in (3, 7) else 0)
                L = int(0.5 * SR); tr.add(t + e8 * tr.beat / 2, marimba(hz(m), L), 0.12)
        bass = chord_notes(root - 12, mode, deg, 1)[0]
        for k in range(4):
            L = int(tr.beat * 0.9 * SR)
            tr.add(t + k * tr.beat, osc(hz(bass), L) * env(L, 0.005, 0.2, 0.5, 0.1), 0.25)
            tr.add(t + k * tr.beat, kick(int(0.3 * SR), 0.7), 0.45)
            for o in (0.75, 1.5) if k % 2 == 0 else ():     # dembow-ish snare
                tr.add(t + (k + o) * tr.beat, snare(int(0.15 * SR), rng, 240), 0.14)
            tr.add(t + k * tr.beat + tr.beat / 2, hat(int(0.05 * SR), rng), 0.05)


def synthpop(tr, root, mode, prog, rng):
    for b in range(0, tr.beats(), 4):
        t = b * tr.beat
        deg = prog[(b // 4) % len(prog)]
        L = int(tr.beat * 4 * SR)
        for m in chord_notes(root, mode, deg, 3):            # saw pad
            pad = osc(hz(m + 12), L, 'saw', 6) * env(L, 0.3, 1.0, 0.7, 0.4)
            tr.add(t, pad, 0.03)
        arp = chord_notes(root + 24, mode, deg, 3)
        for s16 in range(16):
            m = arp[s16 % 3]
            L2 = int(0.12 * SR); tr.add(t + s16 * tr.beat / 4, osc(hz(m), L2, 'square', 3) * env(L2, 0.002, 0.05, 0.2, 0.03), 0.035)
        bass = chord_notes(root - 12, mode, deg, 1)[0]
        for e8 in range(8):
            L3 = int(tr.beat / 2 * 0.9 * SR)
            tr.add(t + e8 * tr.beat / 2, osc(hz(bass), L3, 'saw', 4) * env(L3, 0.003, 0.1, 0.5, 0.05), 0.12)
        for k in range(4):
            tr.add(t + k * tr.beat, kick(int(0.3 * SR), 0.9), 0.5 if k % 2 == 0 else 0.0)
            if k % 2:
                tr.add(t + k * tr.beat, snare(int(0.3 * SR), rng, 190), 0.25)
            tr.add(t + k * tr.beat + tr.beat / 2, hat(int(0.05 * SR), rng), 0.05)


def acoustic(tr, root, mode, prog, rng):
    patt = [0, 2, 1, 3, 2, 1, 3, 2]
    for b in range(0, tr.beats(), 4):
        t = b * tr.beat
        deg = prog[(b // 4) % len(prog)]
        notes = chord_notes(root, mode, deg, 4)
        for e8 in range(8):                                  # finger-picked guitar
            m = notes[patt[e8]] + 12
            L = int(0.9 * SR); tr.add(t + e8 * tr.beat / 2 + rng.normal(0, 0.006), pluck(hz(m), L, rng, 0.7), 0.13)
        L = int(1.6 * SR); tr.add(t, pluck(hz(notes[0] - 12), L, rng, 0.4), 0.2)
        for k in range(4):                                   # soft brushes + cajon-ish kick
            tr.add(t + k * tr.beat, hat(int(0.12 * SR), rng, open_=True) * 0.6, 0.05)
            if k in (0, 2):
                tr.add(t + k * tr.beat, kick(int(0.25 * SR), 0.4), 0.35)
            else:
                tr.add(t + k * tr.beat, snare(int(0.12 * SR), rng, 260) * 0.5, 0.1)


STYLES = {
    'lofi': {'fn': lofi, 'bpm': (78, 92), 'mode': 'any'},
    'house': {'fn': house, 'bpm': (118, 124), 'mode': 'minor'},
    'disco-funk': {'fn': disco_funk, 'bpm': (106, 116), 'mode': 'any'},
    'tropical': {'fn': tropical, 'bpm': (96, 108), 'mode': 'major'},
    'synthpop': {'fn': synthpop, 'bpm': (100, 114), 'mode': 'any'},
    'acoustic': {'fn': acoustic, 'bpm': (84, 98), 'mode': 'major'},
}

if __name__ == '__main__':
    style, secs, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else None
    print(json.dumps(make(style, secs, (), out, seed)))
