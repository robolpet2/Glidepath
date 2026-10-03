// Synthesised score and sound design for the trailer (Web Audio, deterministic).
// buildScore works with a live AudioContext or an OfflineAudioContext.
export function buildScore(ac, out, T0, DUR) {
  const at = s => T0 + s;
  const nf = m => 440 * Math.pow(2, (m - 69) / 12);
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const noise = ac.createBuffer(2, ac.sampleRate * 4, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = noise.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const ir = ac.createBuffer(2, ac.sampleRate * 3.5, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / d.length, 3); }

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .25; comp.knee.value = 10;
  const master = ac.createGain(); master.gain.value = .62;
  master.gain.setValueAtTime(.62, at(DUR - 1.2)); master.gain.linearRampToValueAtTime(0, at(DUR));
  master.connect(comp); comp.connect(out);
  const rev = ac.createConvolver(); rev.buffer = ir; const revOut = ac.createGain(); revOut.gain.value = .45; rev.connect(revOut); revOut.connect(master);

  const env = (t, a, peak, d, dest = master, send = 0) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at(t)); g.gain.linearRampToValueAtTime(peak, at(t + a)); g.gain.exponentialRampToValueAtTime(.0001, at(t + a + d));
    g.connect(dest); if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(rev); }
    return g;
  };
  const src = (t, dur, rate = 1) => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = rate; s.start(at(t), rnd() * 3); s.stop(at(t + dur + .05)); return s; };
  const osc = (type, f, t, dur) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(at(t)); o.stop(at(t + dur + .05)); return o; };
  const filt = (type, f, q = .7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const pan = (p0, p1, t, d) => { const p = ac.createStereoPanner(); p.pan.setValueAtTime(p0, at(t)); p.pan.linearRampToValueAtTime(p1, at(t + d)); p.connect(master); return p; };

  function kick(t, v = .9, f0 = 120) {
    const o = osc('sine', f0, t, .6); o.frequency.setValueAtTime(f0, at(t)); o.frequency.exponentialRampToValueAtTime(38, at(t + .16));
    o.connect(env(t, .003, v, .5));
  }
  function taiko(t, v = .7) {
    kick(t, v, 90);
    const n = src(t, .4); const lp = filt('lowpass', 900); n.connect(lp); lp.connect(env(t, .002, v * .5, .25, master, .3));
  }
  function snare(t, v = .35) {
    const n = src(t, .3); const bp = filt('bandpass', 2000, .7); n.connect(bp); bp.connect(env(t, .002, v, .2, master, .3));
    const o = osc('triangle', 185, t, .15); o.connect(env(t, .002, v * .6, .1));
  }
  function hat(t, v = .06) { const n = src(t, .08); const hp = filt('highpass', 8000); n.connect(hp); hp.connect(env(t, .001, v, .04)); }
  function boom(t, v = 1, len = 2, f0 = 70) {
    const o = osc('sine', f0, t, len); o.frequency.setValueAtTime(f0, at(t)); o.frequency.exponentialRampToValueAtTime(22, at(t + len));
    o.connect(env(t, .004, v, len));
    const n = src(t, len); const lp = filt('lowpass', 1600); lp.frequency.setValueAtTime(1600, at(t)); lp.frequency.exponentialRampToValueAtTime(60, at(t + len * .8));
    n.connect(lp); lp.connect(env(t, .003, v * .95, len * .9, master, .35));
    // debris crackle
    const c = src(t + .05, len * .7, .6); const bp = filt('bandpass', 2400, 1.2); c.connect(bp); bp.connect(env(t + .05, .02, v * .18, len * .6, master, .3));
  }
  function crash(t, v = .25, len = 2) { const n = src(t, len); const hp = filt('highpass', 3500); n.connect(hp); hp.connect(env(t, .002, v, len, master, .5)); }
  function braam(t, v = .12, len = 2.6, notes = [26, 38, 45, 50]) {
    const lp = filt('lowpass', 2400, 1.2);
    lp.frequency.setValueAtTime(2600, at(t)); lp.frequency.exponentialRampToValueAtTime(380, at(t + len));
    lp.connect(env(t, .03, v, len, master, .45));
    notes.forEach(m => [-12, 0, 11].forEach(d => { const o = osc('sawtooth', nf(m), t, len + .2); o.detune.value = d; o.connect(lp); }));
    boom(t, .8, 2.2, 60);
  }
  function pad(t0, t1, notes, v = .04, cut = 900) {
    const lp = filt('lowpass', cut, .5);
    const g = ac.createGain(); g.gain.setValueAtTime(0, at(t0)); g.gain.linearRampToValueAtTime(v, at(t0 + .8));
    g.gain.setValueAtTime(v, at(t1 - .4)); g.gain.linearRampToValueAtTime(0, at(t1 + .3));
    lp.connect(g); g.connect(master); const s = ac.createGain(); s.gain.value = .5; g.connect(s); s.connect(rev);
    notes.forEach(m => [-6, 6].forEach(d => { const o = osc('sawtooth', nf(m), t0, t1 - t0 + .4); o.detune.value = d; o.connect(lp); }));
  }
  function ostinato(t0, t1, notes, step = .125, v = .05) {
    let i = 0;
    for (let t = t0; t < t1 - .01; t += step, i++) {
      const m = notes[i % notes.length];
      const lp = filt('lowpass', 1800, 3); lp.frequency.setValueAtTime(2400, at(t)); lp.frequency.exponentialRampToValueAtTime(300, at(t + step * .9));
      lp.connect(env(t, .004, v, step * .9, master, .15));
      const o = osc('sawtooth', nf(m), t, step); o.connect(lp);
      const o2 = osc('square', nf(m - 12), t, step); const g2 = ac.createGain(); g2.gain.value = .4; o2.connect(g2); g2.connect(lp);
    }
  }
  // jet passing: band-limited roar with a falling Doppler whine, panned across
  function flyby(tp, v = .5, dur = 2.4, p0 = -1, p1 = 1, f = 1) {
    const t = tp - dur * .55;
    const n = src(t, dur); const bp = filt('bandpass', 900, .6);
    bp.frequency.setValueAtTime(700 * f, at(t)); bp.frequency.exponentialRampToValueAtTime(2400 * f, at(tp)); bp.frequency.exponentialRampToValueAtTime(260 * f, at(t + dur));
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, at(t)); g.gain.exponentialRampToValueAtTime(v, at(tp)); g.gain.exponentialRampToValueAtTime(.0001, at(t + dur));
    const pn = pan(p0, p1, t, dur); n.connect(bp); bp.connect(g); g.connect(pn);
    const lo = src(t, dur, .5); const lp = filt('lowpass', 260); const g3 = ac.createGain(); g3.gain.setValueAtTime(.0001, at(t)); g3.gain.exponentialRampToValueAtTime(v * 1.2, at(tp + .05)); g3.gain.exponentialRampToValueAtTime(.0001, at(t + dur)); lo.connect(lp); lp.connect(g3); g3.connect(master);
    const o = osc('sawtooth', 1900 * f, t, dur); o.frequency.setValueAtTime(2200 * f, at(t)); o.frequency.setValueAtTime(2200 * f, at(tp - .1)); o.frequency.exponentialRampToValueAtTime(1100 * f, at(tp + .25));
    const ob = filt('bandpass', 2000 * f, 8); const og = ac.createGain(); og.gain.setValueAtTime(.0001, at(t)); og.gain.exponentialRampToValueAtTime(v * .08, at(tp)); og.gain.exponentialRampToValueAtTime(.0001, at(t + dur));
    o.connect(ob); ob.connect(og); og.connect(pn);
  }
  function roar(t0, t1, v0, v1, f0, f1) {
    const n = src(t0, t1 - t0); const lp = filt('lowpass', f0, 1.2);
    lp.frequency.setValueAtTime(f0, at(t0)); lp.frequency.exponentialRampToValueAtTime(f1, at(t1));
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, at(t0)); g.gain.linearRampToValueAtTime(v0, at(t0 + .3)); g.gain.linearRampToValueAtTime(v1, at(t1 - .05)); g.gain.linearRampToValueAtTime(0, at(t1));
    n.connect(lp); lp.connect(g); g.connect(master);
  }
  function rocket(t, v = .5, dur = 2.5) {
    const n = src(t, dur, .7); const lp = filt('lowpass', 2500, .8); lp.frequency.setValueAtTime(3500, at(t)); lp.frequency.exponentialRampToValueAtTime(500, at(t + dur));
    n.connect(lp); lp.connect(env(t, .02, v, dur, master, .3));
    const c = src(t, dur * .7, 1.3); const bp = filt('bandpass', 5000, 1); c.connect(bp); bp.connect(env(t, .01, v * .4, dur * .5));
    kick(t, v * .9, 80);
  }
  function guns(t0, t1, v = .32) {
    for (let t = t0; t < t1; t += 1 / 65) {
      const n = src(t, .02); const bp = filt('bandpass', 260 + rnd() * 60, 1.5); n.connect(bp); bp.connect(env(t, .001, v, .018));
      const o = osc('square', 62, t, .015); const lp = filt('lowpass', 400); o.connect(lp); lp.connect(env(t, .001, v * .5, .014));
    }
  }
  function beep(t, f, d, v = .05) {
    const o = osc('square', f, t, d); const lp = filt('lowpass', 3000); o.connect(lp);
    const g = ac.createGain(); g.gain.setValueAtTime(0, at(t)); g.gain.linearRampToValueAtTime(v, at(t + .004)); g.gain.setValueAtTime(v, at(t + d - .01)); g.gain.linearRampToValueAtTime(0, at(t + d));
    lp.connect(g); g.connect(master);
  }
  function radio(t0, t1, v = .05) {
    const n = src(t0, t1 - t0); const bp = filt('bandpass', 1800, 2); n.connect(bp);
    const g = ac.createGain(); g.gain.setValueAtTime(0, at(t0)); g.gain.linearRampToValueAtTime(v, at(t0 + .05)); g.gain.setValueAtTime(v, at(t1 - .05)); g.gain.linearRampToValueAtTime(0, at(t1));
    bp.connect(g); g.connect(master);
    beep(t0, 1400, .06, .04); beep(t1 - .06, 900, .06, .04);
    // garbled voice-like burble under the subtitle
    for (let t = t0 + .1; t < t1 - .15; t += .09) {
      const o = osc('sawtooth', 110 + rnd() * 60, t, .08); const f = filt('bandpass', 700 + rnd() * 900, 4); o.connect(f); f.connect(env(t, .01, .025, .07));
    }
  }
  function riser(t0, t1, v = .1) {
    const o = osc('sawtooth', 60, t0, t1 - t0); o.frequency.exponentialRampToValueAtTime(900, at(t1));
    const lp = filt('lowpass', 300); lp.frequency.exponentialRampToValueAtTime(6000, at(t1));
    const g = ac.createGain(); g.gain.setValueAtTime(0, at(t0)); g.gain.linearRampToValueAtTime(v, at(t1 - .02)); g.gain.linearRampToValueAtTime(0, at(t1));
    o.connect(lp); lp.connect(g); g.connect(master);
    const n = src(t0, t1 - t0); const hp = filt('highpass', 400); hp.frequency.exponentialRampToValueAtTime(8000, at(t1));
    const g2 = ac.createGain(); g2.gain.setValueAtTime(0, at(t0)); g2.gain.linearRampToValueAtTime(v * 1.6, at(t1 - .02)); g2.gain.linearRampToValueAtTime(0, at(t1));
    n.connect(hp); hp.connect(g2); g2.connect(master);
  }

  // 1 · canopy: drone, wind, radio, heartbeat
  pad(0, 2.7, [26, 33, 38], .05, 420);
  roar(0, 2.7, .05, .12, 500, 900);
  [.3, .55, 1.3, 1.55, 2.3].forEach((s, i) => kick(s, i % 2 ? .4 : .62, 80));
  radio(.45, 2.45);
  riser(1.6, 2.6, .06);
  // 2 · formation: BRAAM, afterburners
  braam(2.6, .13);
  roar(2.7, 4.6, .12, .3, 400, 2400);
  boom(3.9, .5, 1.2, 90); roar(3.9, 4.6, .2, .35, 800, 4000);
  ostinato(2.6, 4.6, [38, 38, 45, 38, 41, 38, 48, 38], .125, .035);
  // 3 · bandits dive
  flyby(5.95, .6, 2.6, .7, -.7, .8);
  taiko(4.6); taiko(5.1, .6); taiko(5.35, .5); taiko(5.6, .8); snare(5.6, .3);
  braam(5.0, .09, 1.6, [27, 39, 46]);
  ostinato(4.6, 6.2, [39, 39, 46, 39, 42, 39, 49, 39], .125, .04);
  // 4 · merge: time stretch
  riser(6.2, 6.9, .09);
  const ts = src(6.5, 1.2, .25); const tsl = filt('lowpass', 500); ts.connect(tsl); tsl.connect(env(6.5, .25, .5, 1.0, master, .6));
  boom(6.95, .7, 2.2, 50); crash(6.95, .2, 1.6);
  flyby(7.25, .55, 1.4, -1, 1, 1.1);
  // 5 · fox two
  kick(8.15, .6, 200); beep(8.12, 220, .04, .06);
  rocket(8.42, .55, 2.2);
  ostinato(7.8, 9.6, [38, 50, 38, 48, 38, 45, 38, 43], .125, .04);
  [7.8, 8.3, 8.8, 9.3].forEach(s => taiko(s, .6));
  // 6 · flares
  radio(9.75, 11.4, .04);
  for (let s = 9.6; s < 11.55; s += .14) beep(s, 1250, .07, .04);
  for (let i = 0; i < 13; i++) { const s = 10.15 + i * .09; const n = src(s, .1); const hp = filt('highpass', 2500); n.connect(hp); hp.connect(env(s, .002, .18, .08)); }
  roar(9.6, 12.4, .25, .2, 1500, 700);
  boom(11.6, .9, 2.2); crash(11.6, .22, 1.8);
  pad(9.6, 12.4, [26, 38, 45, 50, 53], .03, 800);
  // 7 · reversal
  roar(12.4, 14.2, .3, .42, 600, 3500);
  riser(12.6, 14.2, .07);
  pad(12.4, 14.3, [29, 41, 48, 53, 57], .035, 1400);
  [12.4, 12.9, 13.4, 13.65, 13.9, 14.05].forEach((s, i) => taiko(s, .5 + i * .06));
  // 8 · guns
  braam(14.2, .11, 2.2, [26, 38, 45, 50]);
  for (let i = 0; i < 24; i++) { const s = 14.2 + i * .125; if (i % 4 === 0) kick(s, .8); if (i % 8 === 4) snare(s, .3); hat(s, .05); }
  guns(15.0, 16.1, .3);
  for (let i = 0; i < 14; i++) { const s = 15.35 + i * .05; const n = src(s, .05); const bp = filt('bandpass', 3000, 2); n.connect(bp); bp.connect(env(s, .001, .12, .04)); }
  boom(16.25, 1.1, 2.6, 75); crash(16.25, .3, 2.2);
  ostinato(14.2, 17.2, [38, 38, 50, 38, 41, 38, 48, 38], .125, .04);
  // 9 · wave-top
  flyby(18.1, .75, 2.2, .9, -.9, 1); flyby(18.65, .6, 2.2, -.6, .9, .9);
  for (let i = 0; i < 16; i++) { const s = 17.2 + i * .125; if (i % 2 === 0) kick(s, .55); hat(s, .05); }
  // 10–12 · SAM site
  rocket(19.65, .7, 3); rocket(20.25, .7, 3);
  braam(19.45, .12, 2.4, [25, 37, 44, 49]);
  for (let s = 21.5; s < 22.6; s += .11) beep(s, 1500, .06, .035);
  boom(22.65, .7, 1.8); boom(22.95, .7, 1.8); crash(22.65, .15, 1.4);
  pad(21.4, 23.4, [25, 37, 44, 49, 52], .03, 900);
  [21.4, 21.9, 22.4, 22.65, 22.9].forEach(s => taiko(s, .55));
  rocket(23.75, .4, 1.4); rocket(23.87, .35, 1.4);
  riser(23.9, 24.75, .08);
  boom(24.75, 1.25, 3.2, 60); crash(24.75, .35, 2.5); boom(24.95, 1.0, 2.6, 70); boom(25.2, .8, 2.4, 80);
  // 13 · last bandit
  riser(25.6, 26.8, .07);
  ostinato(25.6, 26.8, [38, 50, 38, 50, 41, 53, 41, 53], .1, .045);
  guns(25.95, 26.4, .18);
  flyby(26.75, .35, 1.2, .8, -.2, 1.3);
  const slow = src(27.25, 1.6, .3); const sl = filt('lowpass', 700); slow.connect(sl); sl.connect(env(27.25, .01, .9, 1.5, master, .6));
  boom(27.25, 1.1, 2.8, 45); crash(27.25, .25, 2.2);
  radio(27.0, 27.95, .035);
  // 14 · hero pass: near silence, then the crack
  pad(28.0, 29.4, [62, 65, 69, 74], .02, 3000);
  roar(28.4, 29.42, .02, .5, 500, 7000);
  flyby(29.45, .9, 1.4, 0, 0, 1.2);
  boom(29.45, 1.3, 2.8, 55);
  const crack = src(29.45, .25); const ch = filt('highpass', 1500); crack.connect(ch); ch.connect(env(29.45, .001, .7, .2, master, .5));
  // 15 · title
  riser(30.0, 30.5, .05);
  braam(30.5, .15, 4.2, [26, 38, 45, 50, 53, 57]);
  pad(30.5, 34.6, [26, 38, 45, 50, 53, 57, 64], .045, 1500);
  [31.6, 32.6].forEach(s => taiko(s, .4));
}
