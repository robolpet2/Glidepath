# Synthesized score + sound design for the Glidepath trailer, locked to the picture's timeline.
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 62.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def T(t): return int(t * SR)
def tt(n): return np.arange(n) / SR

def add(x, t0, gain=1.0, pan=0.0):
    i = T(t0)
    if i >= N: return
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    lg = np.cos((pan + 1) * np.pi / 4) * gain; rg = np.sin((pan + 1) * np.pi / 4) * gain
    L[i:i + n] += x[:n] * lg; R[i:i + n] += x[:n] * rg

def add_st(l, r, t0, gain=1.0):
    i = T(t0); n = min(len(l), N - i)
    L[i:i + n] += l[:n] * gain; R[i:i + n] += r[:n] * gain

def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)

def lpv(x, c, blk=512):
    out = np.zeros(len(x)); zi = None
    for i in range(0, len(x), blk):
        sos = signal.butter(2, float(np.clip(c[i], 40, SR / 2.2)), 'low', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        out[i:i + blk], zi = signal.sosfilt(sos, x[i:i + blk], zi=zi)
    return out

def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    A, D, Rr = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n); e[:A] = np.linspace(0, 1, A) if A else e[:A]
    if D: e[A:A + D] = np.linspace(1, s, len(e[A:A + D]))
    if Rr: e[-Rr:] *= np.linspace(1, 0, Rr)
    return e

def saw(f, n, phase=0.0):
    t = tt(n)
    ph = np.cumsum(np.broadcast_to(f, (n,)) / SR) + phase if np.ndim(f) else f * t + phase
    return 2 * (ph % 1.0) - 1

def sine(f, n):
    ph = np.cumsum(np.broadcast_to(f, (n,)) / SR) if np.ndim(f) else f * tt(n)
    return np.sin(2 * np.pi * ph)

def noise(n): return rng.standard_normal(n)

def note(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    k, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[k] + 12 * (o + 1) - 69) / 12)

# ---------------- instruments ----------------
def pad(freqs, dur, cutoff=900, detune=0.006, attack=1.5, release=2.0):
    n = int(dur * SR); x = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0, detune):
            x += saw(f * (1 + d), n, rng.random())
    x = lp(x, cutoff, 2) / (len(freqs) * 3)
    return x * env_adsr(n, attack, 0.5, 1.0, release)

def sub_boom(dur=2.5, f0=70, f1=28, gain=1.0):
    n = int(dur * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * 3)
    x = sine(f, n) * np.exp(-t * 1.6)
    click = lp(noise(n), 2500) * np.exp(-t * 30) * 0.5
    return (x + click) * gain

def impact(dur=3.0, bright=1.0):
    n = int(dur * SR); t = tt(n)
    body = sub_boom(dur, 90, 30)
    crack = bp(noise(n), 300, 6000 * bright) * np.exp(-t * 9) * 0.6
    metal = sum(sine(f, n) * np.exp(-t * (2 + i)) for i, f in enumerate([110, 165.5, 220.7, 331])) * 0.12
    return body + crack + metal

def braam(freqs, dur=3.5, cutoff=1800):
    n = int(dur * SR); t = tt(n)
    x = np.zeros(n)
    for f in freqs:
        for d in (-0.008, -0.003, 0.003, 0.008):
            x += saw(f * (1 + d), n, rng.random())
    x /= len(freqs) * 4
    c = cutoff * (0.25 + 0.75 * np.exp(-t * 0.9))
    # time-varying lowpass via short blocks
    out = np.zeros(n); blk = 1024; zi = None
    for i in range(0, n, blk):
        sos = signal.butter(2, max(80, c[i]), 'low', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        out[i:i + blk], zi = signal.sosfilt(sos, x[i:i + blk], zi=zi)
    out = np.tanh(out * 2.2) * 0.8
    return out * env_adsr(n, 0.02, 0.4, 0.75, dur * 0.6)

def whoosh(dur, peak, lo=200, hi=3500, gain=1.0):
    n = int(dur * SR); t = tt(n)
    e = np.exp(-((t - peak) / (dur * 0.18)) ** 2)
    x = bp(noise(n), lo, hi) * e
    return x * gain

def jet_flyby(dur, peak, gain=1.0):
    # roar + doppler whine, returns stereo pair (pans left -> right through the peak)
    n = int(dur * SR); t = tt(n)
    rel = (t - peak)
    dist = np.sqrt(rel ** 2 * 170 ** 2 + 25 ** 2)
    amp = 1 / (1 + dist / 25) * 4
    dop = 1 + 0.35 * np.tanh(-rel * 2.5)
    roar = lp(noise(n), 1200) * 0.8 + bp(noise(n), 1500, 5000) * 0.25
    whine = sine(900 * dop, n) * 0.08 + sine(1800 * dop, n) * 0.03 + saw(120 * dop, n) * 0.08
    x = (roar + lp(whine, 4000)) * amp
    pan = np.tanh(rel * 3)
    l = x * np.cos((pan + 1) * np.pi / 4); r = x * np.sin((pan + 1) * np.pi / 4)
    return l * gain, r * gain

def tom(f=80, dur=0.6, gain=1.0):
    n = int(dur * SR); t = tt(n)
    fr = f * (1 + 1.5 * np.exp(-t * 25))
    return (sine(fr, n) * np.exp(-t * 7) + lp(noise(n), 1500) * np.exp(-t * 40) * 0.25) * gain

def pluck(f, dur=0.45, gain=1.0, cutoff=2500):
    n = int(dur * SR); t = tt(n)
    x = (saw(f, n) + saw(f * 1.003, n)) * 0.5
    x = lp(x, cutoff) * np.exp(-t * 7)
    return x * gain

def tick(gain=1.0):
    n = int(0.03 * SR); t = tt(n)
    return hp(noise(n), 2000) * np.exp(-t * 300) * gain

def rumble(dur, gain=1.0):
    n = int(dur * SR); t = tt(n)
    x = lp(noise(n), 90, 4) * 6 + lp(noise(n), 400) * 0.3
    return x * np.exp(-t * 0.45) * (1 - np.exp(-t * 20)) * gain

def riser(dur, f0=200, f1=1400, gain=1.0):
    n = int(dur * SR); t = tt(n); k = t / dur
    f = f0 * (f1 / f0) ** (k ** 1.5)
    x = sum(saw(f * m, n, rng.random()) for m in (1, 1.5, 2.0)) / 3
    x = lpv(x, 600 + 6000 * k) * (k ** 2)
    nz = bp(noise(n), 800, 9000) * (k ** 3) * 0.7
    return (x + nz) * gain

# ---------------- the score ----------------
Dm = [note('D2'), note('A2'), note('D3'), note('F3')]
Bb = [note('A#1'), note('F2'), note('A#2'), note('D3')]
F_ = [note('F2'), note('C3'), note('F3'), note('A3')]
C_ = [note('C2'), note('G2'), note('C3'), note('E3')]

# Act 1: dawn drone with a shimmer
add(pad([note('D2'), note('A2'), note('D3')], 5.6, cutoff=500, attack=2.5, release=1.2), 0.0, 0.55)
add(lp(noise(T(5)), 7000) * np.linspace(0, 1, T(5)) ** 3 * 0.06, 0.0, 1.0)
add(sub_boom(3, 55, 28, 0.6), 0.25)
for t0 in (1.0, 1.5, 2.6, 3.1):   # heartbeat
    add(tom(55, 0.5, 0.35), t0)
l, r = jet_flyby(3.0, 1.5, 1.0); add_st(l, r, 3.25 - 1.5, 0.9)

# Act 2: biomes — 120 BPM pulse, chord per world
chords = [(5, Dm), (11, Bb), (18, F_), (25, C_)]
for i, (t0, ch) in enumerate(chords):
    d = [11, 18, 25, 32][i] - t0
    add(pad(ch, d + 0.4, cutoff=700 + i * 350, attack=0.3, release=0.6), t0, 0.5)
    add(impact(3.2, 0.8 + 0.1 * i), t0, 0.85)
# toms on the beat, building
for k in range(int((32 - 5) * 2)):
    t0 = 5 + k * 0.5
    sec = (t0 - 5) / 27
    add(tom(62, 0.5, 0.45 + 0.35 * sec), t0)
    if k % 2 == 1: add(tom(95, 0.35, 0.25 + 0.3 * sec), t0)
    if t0 > 18 and k % 4 == 3: add(tom(130, 0.25, 0.3), t0 + 0.25)
# pluck ostinato (8ths), notes follow the chord
arp = {5: ['D4', 'F4', 'A4', 'F4'], 11: ['D4', 'F4', 'A#4', 'F4'], 18: ['C4', 'F4', 'A4', 'F4'], 25: ['C4', 'E4', 'G4', 'E4']}
for t0, notes in arp.items():
    for k in range(int(7 * 4) if t0 != 5 else 24):
        tk = t0 + k * 0.25
        if tk >= {5: 11, 11: 18, 18: 25, 25: 32}[t0]: break
        add(pluck(note(notes[k % 4]), 0.4, 0.16, 1800 + (tk - 5) * 80), tk, pan=0.3 * np.sin(k))
# set-piece sounds
l, r = jet_flyby(3.0, 1.5, 1.0); add_st(l, r, 9.62 - 1.5, 0.9)
add(whoosh(2.0, 1.0, 300, 4000, 0.5), 14.5)
add(lp(noise(T(7)), 600) * 0.12 * env_adsr(T(7), 1, 0, 1, 1), 11.0, 1.0)   # desert wind
l, r = jet_flyby(3.0, 1.5, 1.2); add_st(r, l, 22.1 - 1.5, 1.0)
add(rumble(6, 1.0), 25.0, 0.5)
add(impact(4.0, 1.2), 27.45, 1.0); add(rumble(5, 1.6), 27.45, 0.9)
add(sub_boom(3, 50, 25, 0.8), 29.35)
l, r = jet_flyby(2.5, 1.2, 1.0); add_st(l, r, 30.35 - 1.2, 0.9)

# montage slams: SAND / ICE / FIRE / EARTH
for i, t0 in enumerate((32.0, 32.5, 33.0, 33.5)):
    add(braam([note('D1'), note('D2'), note('A2')] if i % 2 == 0 else [note('C1'), note('C2'), note('G2')], 0.9, 2200), t0, 0.55)
    add(impact(1.2, 1.0), t0, 0.7)
# typed text ticks
for k in range(40):
    tk = 34.65 + k * (1 / 28) + (0.12 if k > 20 else 0)
    if tk < 35.95: add(tick(0.25), tk, pan=0.2)

# Act 3: HYPER
add(pad([note('D1'), note('A1'), note('D2')], 8.5, cutoff=300, attack=0.4, release=0.3), 36.0, 0.6)
add(lp(noise(T(8)), 1500) * 0.12 * env_adsr(T(8), 0.3, 0, 1, 0.2), 36.0, 1.0)   # cockpit wind
add(riser(0.6, 120, 900, 0.5), 37.5)
add(impact(3.0, 1.4), 38.12, 1.1); add(sub_boom(3.5, 80, 22, 1.0), 38.12)
crack = hp(noise(T(0.12)), 1200) * np.exp(-tt(T(0.12)) * 40); add(crack, 38.12, 1.4)
add(riser(5.3, 160, 2600, 0.9), 38.25)
# accelerating pulse
tk, step = 38.6, 0.25
while tk < 43.5:
    add(tom(70, 0.3, 0.55), tk); tk += step; step = max(0.0625, step * 0.93)
add(lp(noise(T(5.5)), 3000) * np.linspace(0.05, 0.55, T(5.5)), 38.2, 0.6)   # hyper roar
add(whoosh(1.0, 0.85, 500, 9000, 1.0), 43.0)

# Act 4: CARRIER — calm, then launch
add(impact(4.5, 0.7), 44.0, 0.9)
add(pad([note('F2'), note('C3'), note('A3'), note('E4')], 5.0, cutoff=1400, attack=0.05, release=2.0), 44.0, 0.75)
add(pad([note('D2'), note('A2'), note('F3'), note('C4')], 3.6, cutoff=1200, attack=1.0, release=1.5), 48.5, 0.65)
add(lp(noise(T(18)), 500) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.15 * tt(T(18)))) * 0.1, 44.0, 1.0)   # ocean
# engine spool + afterburner light
n = T(3.1); f = 80 + 140 * np.clip((tt(n) - 1.9) / 0.6, 0, 1)
eng = (saw(f, n) * 0.25 + lp(noise(n), 900) * (0.3 + 0.7 * np.clip((tt(n) - 1.9) / 0.6, 0, 1)))
add(lp(eng, 2500) * 0.5, 48.5, 0.8)
add(lp(hp(noise(T(3)), 3000), 9000) * 0.022, 48.5, 1.0)   # steam hiss
add(riser(3.0, 100, 800, 0.4), 48.6)
# launch
add(sub_boom(1.5, 60, 30, 0.9), 51.6)
l, r = jet_flyby(4.0, 2.0, 1.6); add_st(l, r, 53.6 - 2.0, 1.2)
add(whoosh(2.0, 0.6, 1000, 8000, 0.6), 53.0)
# title: the big one
add(braam([note('D1'), note('D2'), note('A2'), note('D3')], 6.5, 2600), 54.6, 1.0)
add(impact(6.0, 1.0), 54.6, 1.1)
add(pad([note('D2'), note('A2'), note('D3'), note('F3'), note('A3')], 7.0, cutoff=1600, attack=1.2, release=3.0), 55.0, 0.45)
add(pluck(note('A4'), 1.5, 0.2), 56.3); add(pluck(note('D5'), 1.5, 0.18), 56.55); add(pluck(note('F5'), 2.0, 0.16), 56.8)

# ---------------- mix: reverb, glue, limiter ----------------
irn = int(2.8 * SR); ir = noise(irn) * np.exp(-tt(irn) * 2.4); ir = lp(ir, 5000)
irL = ir; irR = np.roll(noise(irn) * np.exp(-tt(irn) * 2.4), 0); irR = lp(irR, 5000)
wetL = signal.fftconvolve(L, irL)[:N] * 0.06; wetR = signal.fftconvolve(R, irR)[:N] * 0.06
L2 = L + wetL; R2 = R + wetR
# fade out at the end
fade = np.ones(N); fs = T(60.8); fade[fs:] = np.linspace(1, 0, N - fs) ** 1.5
L2 *= fade; R2 *= fade
pk = max(np.abs(L2).max(), np.abs(R2).max())
L2 = np.tanh(L2 / pk * 2.0) / np.tanh(2.0) * 0.93; R2 = np.tanh(R2 / pk * 2.0) / np.tanh(2.0) * 0.93
out = np.stack([L2, R2], 1)
wavfile.write('score.wav', SR, (out * 32767).astype(np.int16))
print('ok', out.shape, float(np.abs(out).max()))
