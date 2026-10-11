import numpy as np, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
T = 30.0
N = int(SR * T)
rs = np.random.RandomState(3)
BEAT = 0.5  # 120 BPM

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 100), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)

class Bus:
    def __init__(s): s.L = np.zeros(N); s.R = np.zeros(N)
    def add(s, sig, at, g=1.0, pan=0.0):
        i = int(at * SR)
        if i >= N: return
        if i < 0: sig = sig[-i:]; i = 0
        e = min(N, i + len(sig)); sig = sig[:e - i] * g
        s.L[i:e] += sig * np.sqrt(0.5 * (1 - pan)); s.R[i:e] += sig * np.sqrt(0.5 * (1 + pan))

drums, bassb, synth, fxb, send = Bus(), Bus(), Bus(), Bus(), Bus()

# ---------- instruments
def kick():
    t = tt(0.45); f = 48 + 140 * np.exp(-t * 32)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    s += np.exp(-t * 300) * rs.randn(len(t)) * 0.25
    return np.tanh(s * 1.6)
def clap():
    t = tt(0.35); n = rs.randn(len(t)); env = np.zeros(len(t))
    for d in (0, .011, .022): env += np.where(t >= d, np.exp(-(t - d) * 60), 0)
    env += np.exp(-t * 14) * .5
    return bp(n * env, 900, 4500) * 1.6
def hat(open_=False):
    t = tt(0.32 if open_ else 0.05); return hp(rs.randn(len(t)), 7000) * np.exp(-t * (11 if open_ else 90))
def crash(d=2.4):
    t = tt(d); return hp(rs.randn(len(t)), 4000) * np.exp(-t * 2.2) * 0.8
def saw(f, t, det=0.0):
    ph = rs.rand()
    return 2 * ((f * (1 + det) * t + ph) % 1.0) - 1
def supersaw(f, d, voices=7, spread=0.012):
    t = tt(d); s = np.zeros(len(t))
    for v in range(voices): s += saw(f, t, (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread)
    return s / voices
def pluck(f, d=0.35):
    t = tt(d); s = np.zeros(len(t))
    for k in range(1, 9): s += np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (6 + k * 3.5))
    return s * 0.6
def bell(f, d=2.5):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + .25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)) * np.exp(-t * 1.6)
def impact(d=3.0, big=1.0):
    t = tt(d); f = 70 * np.exp(-t * 1.5) + 28
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (1.1 / big))
    nz = lp(rs.randn(len(t)), 1800) * np.exp(-t * 5)
    return np.tanh((sub * 1.4 + nz * 0.9) * 1.3)
def riser(d, f0=200, f1=3000):
    t = tt(d); p = t / d
    f = f0 * (f1 / f0) ** (p ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.12
    nz = hp(rs.randn(len(t)), 1500) * 0.5
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(4 + 20 * p) / SR)
    return (tone + nz * p) * p ** 1.6 * trem
def whoosh(d=0.6):
    t = tt(d); p = t / d; env = np.sin(np.pi * p) ** 2
    n = rs.randn(len(t)); a = lp(n, 900); b = bp(n, 1500, 7000)
    return (a * (1 - p) + b * p) * env * 1.3
def revcym(d=1.2):
    return crash(d)[::-1] * np.linspace(0, 1, int(d * SR)) ** 2

# ---------- arrangement
CH = {'Am': ([57, 60, 64, 69], 45), 'F': ([53, 57, 60, 65], 41), 'C': ([55, 60, 64, 67], 36), 'G': ([55, 59, 62, 67], 43)}
PROG = ['Am', 'F', 'C', 'G']
def chord_at(t): return PROG[int((t - 3) // 2) % 4]

GROOVE_END = 25.3
kicks = []

# intro 0-3
pad_t = tt(3.2); pad = np.zeros(len(pad_t))
for m in [45, 52, 57, 60, 64]: pad += supersaw(mtof(m), 3.2, 5, 0.008)
pad = lp(pad, 900) * np.minimum(1, pad_t / 2.2) * 0.5
synth.add(pad, 0, 0.55); send.add(pad, 0, 0.35)
for i in range(16):  # filtered arp intro (1.0 -> 3.0)
    at = 1.0 + i * 0.125; notes = [57, 64, 69, 72]
    p = pluck(mtof(notes[i % 4] + 12), 0.3); p = lp(p, 600 + i * 260)
    synth.add(p, at, 0.18 + i * 0.02, pan=(-.3 if i % 2 else .3)); send.add(p, at, 0.15)
fxb.add(riser(1.85, 150, 2500), 1.12, 0.55)
fxb.add(revcym(1.0), 2.0, 0.5)
roll = [2.0 + k * 0.125 for k in range(4)] + [2.5 + k * 0.0625 for k in range(7)]
for k, r in enumerate(roll): drums.add(clap(), r, 0.18 + 0.05 * k, pan=0.1)

# groove 3 - 25.3
t0 = 3.0
nb = int((GROOVE_END - t0) / BEAT)
for b in range(nb):
    at = t0 + b * BEAT
    drums.add(kick(), at, 1.0); kicks.append(at)
    if b % 2 == 1: drums.add(clap(), at, 0.55, pan=-0.05); send.add(clap(), at, 0.12)
    drums.add(hat(True), at + BEAT / 2, 0.22, pan=0.25)
    for h in range(4):
        if h != 2: drums.add(hat(), at + h * BEAT / 4, 0.12 if h % 2 else 0.08, pan=-0.3)
# chords, bass, arp per bar
for bar in range(int((GROOVE_END - t0) / 2) + 1):
    at = t0 + bar * 2.0
    if at >= GROOVE_END: break
    name = PROG[bar % 4]; notes, root = CH[name]
    d = min(2.0, GROOVE_END - at)
    big = at >= 21
    cs = np.zeros(int(d * SR))
    for m in notes + ([notes[0] + 12, notes[2] + 12] if big else []): cs += supersaw(mtof(m), d)
    cs = lp(cs, 3200 if big else 2200) * (0.5 if big else 0.38)
    synth.add(cs, at, 0.6); send.add(cs, at, 0.3)
    for e in range(8):  # offbeat-ish 8th bass
        ba = at + e * 0.25
        if ba >= GROOVE_END: break
        bt = tt(0.23); bs = saw(mtof(root), bt) * 0.6 + np.sin(2 * np.pi * mtof(root - 12) * bt)
        bs = lp(bs, 380 + 500 * np.exp(-bt * 20).mean()) * np.exp(-bt * 3)
        bassb.add(bs, ba, 0.55 if e % 2 else 0.35)
    arp = [notes[0], notes[1], notes[2], notes[3], notes[2] + 12, notes[3], notes[1] + 12, notes[2]]
    for s16 in range(16):
        aa = at + s16 * 0.125
        if aa >= GROOVE_END: break
        p = pluck(mtof(arp[s16 % 8] + 12), 0.28)
        synth.add(p, aa, 0.16 if not big else 0.2, pan=(0.35 if s16 % 2 else -0.35)); send.add(p, aa, 0.12)
# word stabs (SPAWN / PLAN / PARALLELIZE) and impacts
for at, m in [(5.5, 0), (6.5, 0), (7.5, 0)]:
    st = np.zeros(int(0.5 * SR))
    for n_ in [57, 64, 69, 72]: st += supersaw(mtof(n_), 0.5, 7, 0.02)
    st = lp(st, 4000) * np.exp(-tt(0.5) * 6)
    synth.add(st, at, 0.7); send.add(st, at, 0.4)
fxb.add(riser(1.4, 300, 3000), 7.6, 0.4)
for k in range(8): drums.add(clap(), 8.0 + k * 0.125, 0.15 + 0.04 * k)
for at, bg in [(3.0, 1.0), (9.0, 0.7), (21.0, 0.85)]:
    fxb.add(impact(2.5, bg), at, 0.9 * bg); drums.add(crash(), at, 0.55); send.add(crash(), at, 0.2)
for w in [11, 13, 15, 17, 19]:
    fxb.add(whoosh(0.55), w - 0.38, 0.6, pan=(-0.4 if w % 4 == 1 else 0.4))
    drums.add(crash(1.2), w, 0.3)
# lead 21 - 25.3
LEAD = [(21.0, 69, .5), (21.5, 72, .25), (21.75, 69, .25), (22.0, 67, .5), (22.5, 65, .25), (22.75, 67, .25),
        (23.0, 67, .5), (23.5, 72, .25), (23.75, 71, .25), (24.0, 72, .5), (24.5, 74, .25), (24.75, 76, .25), (25.0, 74, .3)]
for at, m, d in LEAD:
    t_ = tt(d + 0.15); vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t_)
    s = np.zeros(len(t_))
    for v in range(5): s += 2 * ((mtof(m) * vib * (1 + (v - 2) * 0.006) * t_ + rs.rand()) % 1) - 1
    s = lp(s / 5, 3500) * np.minimum(1, t_ / 0.01) * np.exp(-np.maximum(0, t_ - d) * 30)
    synth.add(s, at, 0.32); send.add(s, at, 0.35)
# build into vortex
for k in range(16): drums.add(clap(), 24.3 + k * 0.0625, 0.12 + 0.03 * k)
fxb.add(riser(2.1, 120, 4500), 24.3, 0.75)
fxb.add(revcym(1.1), 25.28, 0.7)
vt = tt(1.1); vs = np.zeros(len(vt))
for m in [45, 57, 64]: vs += np.sin(2 * np.pi * np.cumsum(mtof(m) * (1 + 1.5 * (vt / 1.1) ** 3)) / SR)
fxb.add(vs * (vt / 1.1) ** 2 * 0.25, 25.28, 0.6)
# finale 26.5
fxb.add(impact(3.5, 1.5), 26.5, 1.0); drums.add(crash(3.0), 26.5, 0.7); send.add(crash(3.0), 26.5, 0.35)
fin = np.zeros(int(3.5 * SR))
for m in [33, 45, 52, 57, 59, 60, 64, 69]: fin += supersaw(mtof(m), 3.5, 7, 0.014)
fin = lp(fin, 2600) * np.exp(-tt(3.5) * 0.7) * 0.55
synth.add(fin, 26.5, 0.75); send.add(fin, 26.5, 0.5)
for at, m in [(27.1, 81), (27.35, 84), (27.6, 88), (27.85, 93), (28.5, 88), (28.75, 84)]:
    b_ = bell(mtof(m), 2.0); synth.add(b_, at, 0.16, pan=(0.3 if m % 2 else -0.3)); send.add(b_, at, 0.25)
for k in range(16):
    p = pluck(mtof([69, 72, 76, 81][k % 4] + 12), 0.25)
    synth.add(p, 27.9 + k * 0.125, 0.08 * (1 - k / 16), pan=(0.4 if k % 2 else -0.4)); send.add(p, 27.9 + k * 0.125, 0.1)
fxb.add(hp(rs.randn(int(3 * SR)), 6000) * np.exp(-tt(3) * 1.5) * 0.15, 26.5, 1.0)

# ---------- sidechain
t_all = np.arange(N) / SR
sc = np.ones(N)
for k in kicks:
    i = int(k * SR); e = min(N, i + int(0.45 * SR)); d = t_all[i:e] - k
    sc[i:e] = np.minimum(sc[i:e], 1 - 0.75 * np.exp(-d * 9))
for b in (bassb, synth):
    b.L *= sc; b.R *= sc

# ---------- reverb send
ir_t = tt(2.6)
irL = rs.randn(len(ir_t)) * np.exp(-ir_t * 2.4); irR = rs.randn(len(ir_t)) * np.exp(-ir_t * 2.4)
irL = lp(irL, 5000); irR = lp(irR, 5000); irL[:int(.02 * SR)] = 0; irR[:int(.02 * SR)] = 0
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
revL = fftconvolve(send.L, irL)[:N] * 0.9; revR = fftconvolve(send.R, irR)[:N] * 0.9

L = drums.L * 0.9 + bassb.L * 0.9 + synth.L * 0.8 + fxb.L * 0.8 + revL
R = drums.R * 0.9 + bassb.R * 0.9 + synth.R * 0.8 + fxb.R * 0.8 + revR
mix = np.stack([L, R], 1)
mix = hp(mix.T, 25).T
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.8) / np.tanh(1.8)
fade = np.ones(N); fo = int(0.5 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= fade[:, None]
mix /= np.abs(mix).max() * 1.06
w = wave.open('music.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
print('ok')
