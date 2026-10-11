import numpy as np, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
T = 30.0
N = int(SR * T)
rs = np.random.RandomState(5)
BEAT = 0.375          # 160 BPM
BAR = 4 * BEAT
S16 = BEAT / 4

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 100), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)

class Bus:
    def __init__(s): s.L = np.zeros(N); s.R = np.zeros(N)
    def add(s, sig, at, g=1.0, pan=0.0):
        i = int(round(at * SR))
        if i >= N: return
        if i < 0: sig = sig[-i:]; i = 0
        e = min(N, i + len(sig)); sig = sig[:e - i] * g
        s.L[i:e] += sig * np.sqrt(0.5 * (1 - pan)); s.R[i:e] += sig * np.sqrt(0.5 * (1 + pan))

drums, bassb, synth, fxb, send = Bus(), Bus(), Bus(), Bus(), Bus()

# ---------------- instruments
_k = None
def kick():
    global _k
    if _k is None:
        t = tt(0.32); f = 52 + 190 * np.exp(-t * 38)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
        s += np.exp(-t * 400) * rs.randn(len(t)) * 0.35
        _k = np.tanh(s * 2.2) * 0.95
    return _k
def clap():
    t = tt(0.3); n = rs.randn(len(t)); env = np.zeros(len(t))
    for d in (0, .009, .018): env += np.where(t >= d, np.exp(-(t - d) * 70), 0)
    env += np.exp(-t * 16) * .55
    return bp(n * env, 1000, 5500) * 1.7
def snare():
    t = tt(0.18)
    return (bp(rs.randn(len(t)), 1200, 8000) * 0.9 + np.sin(2 * np.pi * 200 * t) * 0.6) * np.exp(-t * 22)
def hat(open_=False):
    t = tt(0.22 if open_ else 0.04); return hp(rs.randn(len(t)), 8000) * np.exp(-t * (14 if open_ else 110))
def crash(d=2.0):
    t = tt(d); return hp(rs.randn(len(t)), 4500) * np.exp(-t * 2.4) * 0.8
def saw(f, t, det=0.0):
    return 2 * ((f * (1 + det) * t + rs.rand()) % 1.0) - 1
def supersaw(f, d, voices=7, spread=0.014):
    t = tt(d); s = np.zeros(len(t))
    for v in range(voices): s += saw(f, t, (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread)
    return s / voices
def pluck(f, d=0.2):
    t = tt(d); s = np.zeros(len(t))
    for k in range(1, 9): s += np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (10 + k * 5))
    return s * 0.6
def bell(f, d=2.0):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + .25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)) * np.exp(-t * 1.8)
def impact(d=2.5, big=1.0):
    t = tt(d); f = 75 * np.exp(-t * 1.8) + 28
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (1.3 / big))
    nz = lp(rs.randn(len(t)), 2200) * np.exp(-t * 6)
    return np.tanh((sub * 1.5 + nz * 0.9) * 1.4)
def riser(d, f0=200, f1=4000):
    t = tt(d); p = t / d; f = f0 * (f1 / f0) ** (p ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.12
    nz = hp(rs.randn(len(t)), 1500) * 0.55
    trem = 0.7 + 0.3 * np.sin(2 * np.pi * np.cumsum(6 + 30 * p) / SR)
    return (tone + nz * p) * p ** 1.5 * trem
def whoosh(d=0.35):
    t = tt(d); p = t / d; env = np.sin(np.pi * p) ** 2
    n = rs.randn(len(t)); return (lp(n, 1000) * (1 - p) + bp(n, 1500, 8000) * p) * env * 1.4
def zap(f0=2400, f1=90, d=0.16):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d)
    ph = np.cumsum(f) / SR
    return (2 * (ph % 1) - 1) * np.exp(-t * 12) * 0.6
def revcym(d=1.0):
    return crash(d)[::-1] * np.linspace(0, 1, int(d * SR)) ** 2

CH = {'Am': [57, 60, 64, 69], 'F': [53, 57, 60, 65], 'C': [55, 60, 64, 67], 'G': [55, 59, 62, 67]}
ROOT = {'Am': 45, 'F': 41, 'C': 48, 'G': 43}
PROG = ['Am', 'F', 'C', 'G']
LADDER = {k: sorted(v + [n + 12 for n in v]) for k, v in CH.items()}
HOOK = [5, -1, 4, 5, 6, -1, 5, 4, -1, 3, 4, -1, 5, 6, 7, 6]

def bar_chord(b): return PROG[b % 4]

def groove_bar(at, name, big=False, lead=False, double=False, shaker=False, no_arp=False):
    notes = CH[name]; root = ROOT[name]
    # drums
    for b in range(4):
        bt = at + b * BEAT
        drums.add(kick(), bt, 1.0); KICKS.append(bt)
        if double: drums.add(kick(), bt + BEAT / 2, 0.85); KICKS.append(bt + BEAT / 2)
        if b % 2 == 1: drums.add(clap(), bt, 0.6, pan=-0.05); send.add(clap(), bt, 0.12)
        drums.add(hat(True), bt + BEAT / 2, 0.2, pan=0.25)
        for h in range(4): drums.add(hat(), bt + h * S16, 0.13 if h % 2 else 0.07, pan=-0.3)
        if shaker:
            for h in range(4): drums.add(hp(rs.randn(int(.05 * SR)), 9000) * np.exp(-tt(.05) * 60), bt + h * S16 + .01, 0.08, pan=0.4)
    # chords
    cs = np.zeros(int(BAR * SR))
    for m in notes + ([notes[0] + 12, notes[2] + 12] if big else []): cs += supersaw(mtof(m), BAR)
    cs = lp(cs, 3800 if big else 2600) * (0.5 if big else 0.4)
    synth.add(cs, at, 0.62); send.add(cs, at, 0.28)
    # galloping bass
    for b in range(4):
        for s in (1, 2, 3):
            ba = at + b * BEAT + s * S16
            bt_ = tt(S16 * 0.92); m = root + (12 if s == 3 else 0)
            bs = saw(mtof(m), bt_) * 0.7 + np.sin(2 * np.pi * mtof(m - 12) * bt_) * 0.9
            bs = lp(bs, 1100) * np.exp(-bt_ * 8)
            bassb.add(bs, ba, 0.55)
    # 16th arp
    if not no_arp:
        lad = LADDER[name]; pat = [0, 2, 4, 6, 7, 6, 4, 2]
        for s in range(16):
            p = pluck(mtof(lad[pat[s % 8] % len(lad)] + 12), 0.16)
            synth.add(p, at + s * S16, 0.17 if not big else 0.2, pan=(0.35 if s % 2 else -0.35)); send.add(p, at + s * S16, 0.1)
    if lead:
        lad = LADDER[name] + [LADDER[name][-1] + 5]
        for s, idx in enumerate(HOOK):
            if idx < 0: continue
            m = lad[min(idx, len(lad) - 1)]
            d = S16 * (1.8 if s + 1 < 16 and HOOK[s + 1] < 0 else 0.9)
            t_ = tt(d + 0.06); vib = 1 + 0.003 * np.sin(2 * np.pi * 6 * t_)
            sg = np.zeros(len(t_))
            for v in range(5): sg += 2 * ((mtof(m) * vib * (1 + (v - 2) * 0.007) * t_ + rs.rand()) % 1) - 1
            sg = lp(sg / 5, 5000) * np.minimum(1, t_ / 0.004) * np.exp(-np.maximum(0, t_ - d) * 40)
            synth.add(sg, at + s * S16, 0.3, pan=0.05); send.add(sg, at + s * S16, 0.3)

def fill(at_end, beats=1.0, sub=4, g0=0.15, g1=0.5):
    n = int(beats * sub)
    for k in range(n):
        drums.add(snare(), at_end - beats * BEAT + k * BEAT / sub, g0 + (g1 - g0) * k / max(1, n - 1), pan=0.1)

def stab(at, notes=(57, 64, 69, 72, 76), d=0.3, g=0.7):
    st = np.zeros(int(d * SR))
    for m in notes: st += supersaw(mtof(m), d, 7, 0.02)
    st = lp(st, 5000) * np.exp(-tt(d) * 7)
    synth.add(st, at, g); send.add(st, at, 0.4)

KICKS = []

# ---------------- intro (0 - 1.5)
fxb.add(impact(1.2, 0.6), 0.0, 0.5); drums.add(crash(1.2), 0.0, 0.3)
pad = np.zeros(int(1.6 * SR))
for m in [45, 52, 57, 60, 64]: pad += supersaw(mtof(m), 1.6, 5, 0.008)
pt = tt(1.6); pad = lp(pad, 1200) * np.minimum(1, pt / 0.6) * 0.5
synth.add(pad, 0, 0.5); send.add(pad, 0, 0.3)
for i in range(16):
    p = lp(pluck(mtof([57, 64, 69, 72][i % 4] + 12), 0.16), 700 + i * 380)
    synth.add(p, i * S16, 0.15 + i * 0.015, pan=(-.3 if i % 2 else .3)); send.add(p, i * S16, 0.12)
fxb.add(riser(1.5, 160, 3500), 0.0, 0.6)
fxb.add(revcym(0.8), 0.7, 0.55)
for k in range(2): drums.add(snare(), 0.375 + k * BEAT / 2, 0.15 + .05 * k)
for k in range(4): drums.add(snare(), 0.75 + k * S16, 0.25 + .04 * k)
for k in range(8): drums.add(snare(), 1.125 + k * S16 / 2, 0.35 + .04 * k)

# ---------------- main groove (1.5 - 25.5)
for b in range(16):
    at = 1.5 + b * BAR; name = bar_chord(b)
    if b <= 13:   # 1.5 .. 22.5
        groove_bar(at, name, big=(b >= 12), lead=(6 <= b <= 13), shaker=(2 <= b <= 13))
    elif b == 14:  # montage bar 1 (22.5 - 24.0): hits on every beat
        groove_bar(at, name, big=True, no_arp=False)
        for k in range(4):
            stab(at + k * BEAT, tuple(n + 12 for n in CH[name]) + (CH[name][0] + 24,), 0.3, 0.6)
            fxb.add(impact(0.6, 0.4), at + k * BEAT, 0.35); drums.add(crash(0.6), at + k * BEAT, 0.2)
    else:          # montage bar 2 (24.0 - 25.5): double-time kicks + zaps on every 8th
        groove_bar(at, name, big=True, double=True)
        for k in range(8):
            fxb.add(zap(1800 + k * 300, 120 + k * 40, 0.12), at + k * BEAT / 2, 0.35, pan=(0.4 if k % 2 else -0.4))
        fill(at + BAR, beats=4, sub=4, g0=0.1, g1=0.55)
        fxb.add(riser(BAR, 300, 3000), at, 0.4)

# wall word stabs + fill into the builds
for at in (3.0, 3.375, 3.75): stab(at)
fill(4.5, beats=1, sub=4); fxb.add(riser(0.75, 400, 3000), 3.75, 0.35)
# build transitions: whoosh + zap + crash on every bar line
for k in range(1, 10):
    w = 4.5 + k * BAR
    fxb.add(whoosh(0.32), w - 0.22, 0.6, pan=(-0.5 if k % 2 else 0.5))
    fxb.add(zap(2600, 110, 0.16), w, 0.3, pan=(0.3 if k % 2 else -0.3))
    drums.add(crash(1.0), w, 0.28)
for e, bts in ((10.5, 1), (16.5, 1), (19.5, 2), (22.5, 1)): fill(e, beats=bts, sub=4 if bts == 1 else 8)
fxb.add(riser(1.5, 250, 3500), 18.0, 0.45)
fxb.add(riser(0.75, 300, 3000), 21.75, 0.35)
for at, g in ((1.5, 1.0), (4.5, 0.65), (19.5, 0.75), (22.5, 0.7)):
    fxb.add(impact(2.2, g), at, 0.9 * g); drums.add(crash(), at, 0.55); send.add(crash(), at, 0.2)

# ---------------- vortex (25.5 - 27.0)
fxb.add(impact(1.6, 0.8), 25.5, 0.75); drums.add(crash(1.2), 25.5, 0.4)
for k in range(8): drums.add(snare(), 25.5 + k * S16, 0.4 + 0.02 * k)
for k in range(8): drums.add(kick(), 25.5 + k * BEAT / 2, 0.55 + 0.04 * k) if k < 4 else None
for k in range(10): drums.add(snare(), 26.25 + k * S16 / 2, 0.5 + 0.02 * k)
for k in range(8): drums.add(snare(), 26.72 + k * S16 / 4, 0.55)
fxb.add(riser(1.42, 300, 6000) * 0.6 + riser(1.42, 300, 6000)[::-1] * 0 + np.linspace(.35, 1, int(1.42 * SR)) * riser(1.42, 300, 6000) * .6, 25.5, 0.9)
fxb.add(revcym(1.0), 25.92, 0.75)
vt = tt(1.42); vs = np.zeros(len(vt))
for m in [45, 52, 57, 64]: vs += np.sin(2 * np.pi * np.cumsum(mtof(m) * (1 + 1.8 * (vt / 1.42) ** 3)) / SR)
fxb.add(vs * (vt / 1.42) ** 2 * 0.22, 25.5, 0.7)
up = np.zeros(int(1.42 * SR))
for m in [57, 60, 64]: up += supersaw(mtof(m), 1.42, 5, 0.01)
up = lp(up, 3000) * (vt / 1.42) ** 1.5 * 0.4
synth.add(up, 25.5, 0.5)

# ---------------- finale (27.0 -)
fxb.add(impact(3.0, 1.6), 27.0, 1.0); drums.add(crash(2.5), 27.0, 0.7); send.add(crash(2.5), 27.0, 0.35)
groove_bar(27.0, 'Am', big=True, lead=True, shaker=True)
fxb.add(impact(1.5, 1.0), 28.5, 0.8); drums.add(crash(1.5), 28.5, 0.6)
fin = np.zeros(int(1.5 * SR))
for m in [33, 45, 52, 57, 59, 60, 64, 69, 76]: fin += supersaw(mtof(m), 1.5, 7, 0.016)
fin = lp(fin, 3000) * np.exp(-tt(1.5) * 1.6) * 0.6
synth.add(fin, 28.5, 0.8); send.add(fin, 28.5, 0.55)
for at, m in [(28.55, 81), (28.74, 84), (28.92, 88), (29.1, 93)]:
    b_ = bell(mtof(m), 1.0); synth.add(b_, at, 0.15, pan=(0.3 if m % 2 else -0.3)); send.add(b_, at, 0.25)

# ---------------- sidechain + gate
t_all = np.arange(N) / SR
sc = np.ones(N)
for k in KICKS:
    i = int(k * SR); e = min(N, i + int(0.3 * SR)); d = t_all[i:e] - k
    sc[i:e] = np.minimum(sc[i:e], 1 - 0.8 * np.exp(-d * 14))
for b in (bassb, synth):
    b.L *= sc; b.R *= sc
gate = np.ones(N); g0, g1 = int(26.93 * SR), int(27.0 * SR); gate[g0:g1] = 0
for b in (drums, bassb, synth, fxb, send):
    b.L *= gate; b.R *= gate

# ---------------- reverb + master
ir_t = tt(2.0)
irL = lp(rs.randn(len(ir_t)) * np.exp(-ir_t * 3.0), 5500); irR = lp(rs.randn(len(ir_t)) * np.exp(-ir_t * 3.0), 5500)
irL[:int(.015 * SR)] = 0; irR[:int(.015 * SR)] = 0
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
revL = fftconvolve(send.L, irL)[:N] * 0.8; revR = fftconvolve(send.R, irR)[:N] * 0.8
L = drums.L * 0.95 + bassb.L * 0.9 + synth.L * 0.8 + fxb.L * 0.8 + revL
R = drums.R * 0.95 + bassb.R * 0.9 + synth.R * 0.8 + fxb.R * 0.8 + revR
mix = np.stack([L, R])
mix = hp(mix, 28)
mix /= np.abs(mix).max()
mix = np.tanh(mix * 2.2) / np.tanh(2.2)
fade = np.ones(N); fo = int(0.5 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= fade
mix /= np.abs(mix).max() * 1.06
w = wave.open('music.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix.T * 32767).astype('<i2').tobytes()); w.close()
print('ok')
