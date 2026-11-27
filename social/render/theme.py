#!/usr/bin/env python3
"""The Suds theme: the 4-second sting that plays over every reel's end card.

A steel-pan calypso hook (D G B G A B -> high D over a G major chord), shaker and
congas, then two glasses clink "cheers" (tuned to B and D of the chord) and ring
out. Synthesized here like the music bed, nothing sampled. Fixed seeds, so every
reel gets the identical sting: it's the brand's sound, not a variation.

Timing (seconds from the start of the end card):
  0.12  first pan note (the logo is sliding in)
  1.08  final chord
  2.04  the clink, which rings to the end
  4.00  end (last 0.8 s fades out)

  python3 theme.py out.wav      # write it on its own to listen
  theme.render() -> (n, 2) float array, peak 0.89
"""
import sys, wave
import numpy as np

SR = 44100
DUR = 4.0
STEP = 0.16                     # one melody note
LAST = 6 * STEP + 0.12          # the final chord
CLINK = LAST + 6 * STEP         # six notes of rest, then cheers


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def T(n): return np.arange(n) / SR


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y


def hp(x, fc): return x - onepole_lp(x, fc)


def bp(x, f, q=8):
    w = 2 * np.pi * f / SR; r = np.exp(-w / (2 * q))
    a1, a2 = -2 * r * np.cos(w), r * r
    y = np.zeros_like(x); y1 = y2 = 0.0; g = (1 - r)
    for i in range(len(x)):
        y0 = g * x[i] - a1 * y1 - a2 * y2; y[i] = y0; y2, y1 = y1, y0
    return y


# ---------- instruments ----------

def steelpan(f, dur=0.5, vel=1.0, ring=1.0):
    n = int(dur * SR); t = T(n)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / (0.55 * ring))
         + 0.55 * np.sin(2 * np.pi * f * 2.005 * t) * np.exp(-t / (0.35 * ring))
         + 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t / (0.18 * ring))
         + 0.12 * np.sin(2 * np.pi * f * 4.03 * t) * np.exp(-t / 0.08))
    x *= 1 + 0.12 * np.sin(2 * np.pi * 6 * t) * np.exp(-t / (0.4 * (2 if ring > 1 else 1)))   # the pan's shimmer
    return x * (1 - np.exp(-t / 0.0015)) * vel


def shaker(rng):
    n = int(0.08 * SR); t = T(n)
    return hp(hp(rng.normal(0, 1, n), 5000), 5000) * np.sin(np.pi * t / t[-1]) ** 2


def conga(rng, f):
    n = int(0.3 * SR); t = T(n)
    ff = f * (1 + 0.4 * np.exp(-t / 0.01))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / 0.09) + hp(rng.normal(0, 1, n), 2000) * np.exp(-t / 0.003) * 0.3


def glass(rng, f, dur=2.4, bright=1.0, ring=1.6):
    """Glass clink: inharmonic partials with slight beating, plus the contact tick."""
    n = int(dur * SR); t = T(n); x = np.zeros(n)
    for r, a, d in zip([1, 2.32, 4.25, 6.63, 9.38], [1, 0.6, 0.35 * bright, 0.2 * bright, 0.1 * bright], [1.1, 0.6, 0.3, 0.18, 0.1]):
        for det in (-0.7, 0.7):
            x += a * np.sin(2 * np.pi * (f * r + det * r) * t + rng.uniform(0, 6.28)) * np.exp(-t / (d * ring)) * 0.5
    x += hp(rng.normal(0, 1, n), 6000) * np.exp(-t / 0.0015) * 0.6
    return x * (1 - np.exp(-t / 0.0005))


def reverb(L, R, wet=0.22, length=1.4, damp=3.5):
    n = int(length * SR); t = T(n); out = []
    for ch, seed in ((L, 1), (R, 2)):
        ir = np.random.default_rng(seed).normal(0, 1, n) * np.exp(-t * damp)
        ir = onepole_lp(ir, 5000); ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        m = len(ch) + n; N = 1 << (m - 1).bit_length()
        out.append(ch + wet * np.fft.irfft(np.fft.rfft(ch, N) * np.fft.rfft(ir, N), N)[: len(ch)])
    return out


# ---------- the sting ----------

def render():
    perc, clink = np.random.default_rng(42), np.random.default_rng(7)
    L = np.zeros(int(DUR * SR) + 3 * SR); R = np.zeros_like(L)

    def add(t, x, gain=1.0, pan=0.0):
        i = int(t * SR); x = x[: len(L) - i] * gain
        L[i:i + len(x)] += x * np.sqrt((1 - pan) / 2)
        R[i:i + len(x)] += x * np.sqrt((1 + pan) / 2)

    for k, m in enumerate((74, 79, 83, 79, 81, 83, 86)):              # D G B G A B D
        last = k == 6
        add(k * STEP + 0.12, steelpan(hz(m), 3.0, ring=1.8) if last else steelpan(hz(m)), 0.5, (m - 80) / 15)
    for m in (71, 74, 79):                                            # G major under the last note
        add(LAST, steelpan(hz(m), 3.0, 0.7, ring=1.8), 0.25, (m - 74) / 10)
    add(LAST, steelpan(hz(43), 3.0, ring=2.2), 0.35)                  # low G bass pan
    for k in range(12):
        add(0.12 + k * STEP / 2, shaker(perc), 0.12 if k % 2 else 0.2, 0.5)
    for t0, f in ((0.12, 220), (0.36, 300), (0.44, 300), (0.6, 220), (0.88, 330), (1.08, 220)):
        add(t0, conga(perc, f), 0.35, -0.4)
    add(CLINK, glass(clink, hz(98)), 0.30, -0.35)                     # D7 and B6: two glasses, cheers
    add(CLINK + 0.025, glass(clink, hz(95), bright=0.8), 0.24, 0.35)

    L, R = reverb(L, R)
    n = int(DUR * SR); L, R = L[:n], R[:n]
    fade = np.ones(n); k = int(0.8 * SR); fade[-k:] = np.linspace(1, 0, k) ** 2
    st = np.stack([L, R], 1) * fade[:, None]
    return np.tanh(st / np.max(np.abs(st)) * 1.3) / np.tanh(1.3) * 0.89


def write_wav(x, path):
    x = x if x.ndim == 2 else x[:, None]
    with wave.open(path, 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


if __name__ == '__main__':
    write_wav(render(), sys.argv[1])
