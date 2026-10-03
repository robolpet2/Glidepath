// Typography, HUD and lens flare drawn over each frame with Canvas 2D.
export const DURATION = 62;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const eOut = t => 1 - Math.pow(1 - t, 3);
const eOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const eInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const RED = '#ff2a1f', BLUE = '#7cc8ff', OFF = '#eef2f5';

function tracked(ctx, text, x, y, track, align = 'left') {
  // draw text with letter spacing; returns width
  let w = 0; const ws = [];
  for (const ch of text) { const m = ctx.measureText(ch).width; ws.push(m); w += m + track; }
  w -= track;
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  let i = 0;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ws[i++] + track; }
  return w;
}
function inOut(t, a, b, fi = 0.5, fo = 0.5) { return Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b)); }

// ---------- big centred statements ----------
function statement(ctx, S, t, a, b, text, opts = {}) {
  if (t < a || t > b) return;
  const k = inOut(t, a, b, opts.fi || 0.45, opts.fo || 0.4);
  const p = eOutExpo(seg(t, a, a + 1.4));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.font = `${opts.weight || 300} ${opts.size || 104}px Oswald, "DejaVu Sans", sans-serif`;
  ctx.fillStyle = opts.color || OFF;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = opts.glow || 'rgba(0,0,0,0.55)'; ctx.shadowBlur = opts.glow ? 40 : 30;
  const track = (opts.track || 26) + (1 - p) * (opts.trackFrom || 40);
  const y = (opts.y || S.H / 2) + (1 - p) * 10;
  const blurIn = 1 - seg(t, a, a + 0.25);
  if (blurIn > 0) ctx.filter = `blur(${(blurIn * 10).toFixed(1)}px)`;
  tracked(ctx, text, S.W / 2, y, track, 'center');
  ctx.restore();
}

// ---------- location cards ----------
function card(ctx, S, t, a, b, idx, name, sub, meta) {
  if (t < a || t > b) return;
  const x = 118, base = S.H - S.BAR - 118;
  const pin = eOutExpo(seg(t, a, a + 0.9));
  const out = eInOut(seg(t, b - 0.55, b));
  ctx.save();
  ctx.globalAlpha = 1 - out;
  const dx = -out * 40;
  // red rule + index
  ctx.fillStyle = RED;
  ctx.fillRect(x + dx, base - 128, 300 * pin, 3);
  ctx.font = '700 22px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = (1 - out) * seg(t, a + 0.1, a + 0.4);
  tracked(ctx, idx, x + dx, base - 142, 6);
  ctx.fillStyle = 'rgba(238,242,245,0.75)';
  ctx.font = '500 17px "JetBrains Mono", "DejaVu Sans Mono", monospace';
  tracked(ctx, '/ 05', x + dx + 46, base - 142, 4);
  // the name, rising out of a mask
  ctx.globalAlpha = 1 - out;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, base - 118, S.W, 122); ctx.clip();
  const rise = (1 - eOutExpo(seg(t, a + 0.15, a + 1.0))) * 110;
  ctx.font = '600 104px Oswald, "DejaVu Sans", sans-serif'; ctx.fillStyle = OFF;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24;
  tracked(ctx, name, x + dx - 4, base - 6 + rise, 7);
  ctx.restore();
  // subtitle + meta ticker
  ctx.globalAlpha = (1 - out) * seg(t, a + 0.55, a + 1.0);
  ctx.font = '500 21px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.fillStyle = 'rgba(238,242,245,0.92)';
  const shown = Math.floor(sub.length * seg(t, a + 0.55, a + 1.3));
  tracked(ctx, sub.slice(0, shown), x + dx, base + 38, 5);
  ctx.font = '500 16px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.fillStyle = 'rgba(255,42,31,0.95)';
  ctx.globalAlpha = (1 - out) * seg(t, a + 0.9, a + 1.3);
  tracked(ctx, meta(t - a), x + dx, base + 72, 4);
  ctx.restore();
}

// ---------- montage words ----------
function slam(ctx, S, t, a, word) {
  if (t < a || t > a + 0.5) return;
  const lt = t - a, k = 1 - seg(lt, 0.38, 0.5);
  const sc = 1.25 - 0.25 * eOutExpo(seg(lt, 0, 0.18));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(S.W / 2, S.H / 2); ctx.scale(sc, sc);
  ctx.font = '700 190px Oswald, "DejaVu Sans", sans-serif'; ctx.fillStyle = OFF; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30;
  tracked(ctx, word, 0, 0, 18, 'center');
  ctx.restore();
}

// ---------- typed terminal lines ----------
function typed(ctx, S, t, a, b, lines) {
  if (t < a || t > b) return;
  const k = 1 - seg(t, b - 0.2, b);
  ctx.save(); ctx.globalAlpha = k;
  ctx.font = '500 34px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.textBaseline = 'middle';
  let tt = t - a - 0.15;
  lines.forEach((ln, i) => {
    const n = clamp(Math.floor(tt * 28), 0, ln.text.length);
    tt -= ln.text.length / 28 + 0.12;
    ctx.fillStyle = ln.color;
    const y = S.H / 2 - 28 + i * 56;
    const w = tracked(ctx, ln.text.slice(0, n), S.W / 2 - 300, y, 6);
    const last = i === lines.length - 1 || tt < 0;
    if (n < ln.text.length || (i === lines.length - 1 && n === ln.text.length)) {
      if (n > 0 || i === 0) { if ((t * 2.2) % 1 < 0.55 && last) ctx.fillRect(S.W / 2 - 300 + w + 8, y - 17, 18, 34); }
    }
    if (n < ln.text.length) tt = -1;
  });
  ctx.restore();
}

// ---------- HYPER HUD ----------
function hyperHud(ctx, S, t, h) {
  if (!h) return;
  const tau = h.tau;
  const vis = seg(tau, 0.3, 0.8) * (1 - seg(tau, 7.75, 7.95));
  if (vis <= 0) return;
  const cx = S.W / 2, top = S.BAR + 62;
  const prog = eInOut(seg(tau, 2.1, 7.5));
  const togo = 2000 - prog * 1975;
  ctx.save();
  ctx.globalAlpha = vis;
  const bg = ctx.createLinearGradient(0, S.BAR, 0, S.BAR + 260);
  bg.addColorStop(0, 'rgba(2,8,18,0.55)'); bg.addColorStop(1, 'rgba(2,8,18,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, S.BAR, S.W, 260);
  ctx.shadowColor = 'rgba(80,170,255,0.8)'; ctx.shadowBlur = 16;
  ctx.fillStyle = BLUE; ctx.textBaseline = 'alphabetic';
  ctx.font = '700 20px "JetBrains Mono", "DejaVu Sans Mono", monospace';
  tracked(ctx, 'HYPER CRUISE  →  ENEMY ISLAND', cx, top, 5, 'center');
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px "JetBrains Mono", "DejaVu Sans Mono", monospace';
  const sp = (h.v / 1000).toFixed(1);
  tracked(ctx, `${sp} KM/S`, cx, top + 72, 4, 'center');
  ctx.fillStyle = BLUE; ctx.font = '700 26px "JetBrains Mono", "DejaVu Sans Mono", monospace';
  tracked(ctx, `MACH ${Math.round(h.v / 340)}`, cx, top + 112, 8, 'center');
  ctx.font = '500 18px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.fillStyle = 'rgba(200,230,255,0.9)';
  const eta = Math.max(0, Math.round((togo - 25) * 1000 / Math.max(h.v, 1)));
  tracked(ctx, `${Math.round(togo).toLocaleString('en-US')} KM TO GO  ·  ETA ${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}`, cx, top + 146, 4, 'center');
  // progress bar
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(cx - 260, top + 164, 520, 4);
  ctx.fillStyle = BLUE; ctx.fillRect(cx - 260, top + 164, 520 * clamp(1 - (togo - 25) / 1975, 0, 1), 4);
  // corner brackets
  ctx.strokeStyle = 'rgba(124,200,255,0.75)'; ctx.lineWidth = 3;
  const m = 46, L = 70, y0 = S.BAR + m, y1 = S.H - S.BAR - m, x0 = m, x1 = S.W - m;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
  ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
  ctx.moveTo(x0, y1 - L); ctx.lineTo(x0, y1); ctx.lineTo(x0 + L, y1);
  ctx.moveTo(x1 - L, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L);
  ctx.stroke();
  // side tapes: altitude + speed ladders
  ctx.font = '500 15px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.fillStyle = 'rgba(160,215,255,0.8)';
  const mid = S.H / 2;
  for (let i = -4; i <= 4; i++) {
    const v = Math.round(h.v / 100) * 100 + i * 500;
    const yy = mid + i * 42 - ((h.v / 500) % 1) * 42;
    ctx.fillRect(120, yy, i === 0 ? 30 : 14, 2);
    if (i % 2 === 0 && v > 0) tracked(ctx, String(v), 160, yy + 5, 2);
    ctx.fillRect(S.W - 150, yy, i === 0 ? 30 : 14, 2);
    if (i % 2 === 0) tracked(ctx, String(1500 + i * 50), S.W - 170, yy + 5, 2, 'right');
  }
  ctx.font = '700 14px "JetBrains Mono", "DejaVu Sans Mono", monospace';
  tracked(ctx, 'M/S', 120, mid - 210, 3); tracked(ctx, 'ALT M', S.W - 120, mid - 210, 3, 'right');
  // engage flash
  if (tau > 1.55 && tau < 2.6) {
    const on = (tau * 6) % 1 < 0.6 ? 1 : 0.25;
    ctx.globalAlpha = vis * on;
    ctx.font = '800 30px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = BLUE; ctx.lineWidth = 2;
    ctx.strokeRect(cx - 170, S.H - S.BAR - 150, 340, 54);
    tracked(ctx, 'HYPER ENGAGED', cx, S.H - S.BAR - 113, 6, 'center');
  }
  ctx.restore();
}

// ---------- lens flare ----------
function flare(ctx, S, sun) {
  if (!sun || sun.k <= 0.02) return;
  const { x, y } = sun, k = sun.k * 0.6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath(); ctx.rect(0, S.BAR, S.W, S.PH); ctx.clip();
  let g = ctx.createRadialGradient(x, y, 0, x, y, 420);
  g.addColorStop(0, `rgba(255,236,200,${0.55 * k})`); g.addColorStop(0.15, `rgba(255,190,120,${0.22 * k})`); g.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 420, y - 420, 840, 840);
  // anamorphic streak
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.018);
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1100);
  g.addColorStop(0, `rgba(190,220,255,${0.85 * k})`); g.addColorStop(0.3, `rgba(120,170,255,${0.3 * k})`); g.addColorStop(1, 'rgba(80,120,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-1100, -1100, 2200, 2200);
  ctx.restore();
  // ghosts along the axis through the centre
  const cx = S.W / 2, cy = S.H / 2, dx = cx - x, dy = cy - y;
  const ghosts = [[0.55, 60, '255,170,90', 0.10], [0.9, 26, '140,255,190', 0.12], [1.25, 110, '120,160,255', 0.07], [1.6, 44, '255,120,160', 0.09], [2.0, 180, '255,200,120', 0.04]];
  for (const [f, r, c, a] of ghosts) {
    const gx = x + dx * f, gy = y + dy * f;
    g = ctx.createRadialGradient(gx, gy, r * 0.2, gx, gy, r);
    g.addColorStop(0, `rgba(${c},${a * k * 0.4})`); g.addColorStop(0.8, `rgba(${c},${a * k})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---------- title ----------
function title(ctx, S, t) {
  const a = 54.6;
  if (t < a) return;
  const cx = S.W / 2, cy = S.H / 2 - 40;
  const p = eOutExpo(seg(t, a, a + 2.2));
  const fadeAll = 1 - seg(t, 60.7, 61.8);
  ctx.save();
  ctx.globalAlpha = seg(t, a, a + 0.25) * fadeAll;
  // glow pass
  ctx.font = '700 220px Oswald, "DejaVu Sans", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = OFF;
  ctx.shadowColor = 'rgba(225,6,0,0.75)'; ctx.shadowBlur = 70;
  const blurIn = 1 - seg(t, a, a + 0.3);
  if (blurIn > 0) ctx.filter = `blur(${(blurIn * 16).toFixed(1)}px)`;
  const w = tracked(ctx, 'GLIDEPATH', cx, cy, 22 + (1 - p) * 70, 'center');
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
  // the red line sweeping under it
  const lp = eOutExpo(seg(t, a + 0.35, a + 1.6));
  const lw = 760 * lp;
  const gr = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
  gr.addColorStop(0, 'rgba(225,6,0,0)'); gr.addColorStop(0.5, 'rgba(255,42,31,1)'); gr.addColorStop(1, 'rgba(225,6,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(cx - lw / 2, cy + 128, lw, 4);
  // tagline
  ctx.globalAlpha = seg(t, a + 1.7, a + 2.3) * fadeAll;
  ctx.font = '500 30px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.fillStyle = 'rgba(238,242,245,0.95)';
  tracked(ctx, 'THE WHOLE WORLD IS YOUR RUNWAY', cx, cy + 186, 9, 'center');
  // call to action
  const ca = seg(t, a + 3.4, a + 3.9) * fadeAll;
  ctx.globalAlpha = ca;
  ctx.strokeStyle = RED; ctx.lineWidth = 2;
  // the box is sized to the text it holds, with even padding on every side
  const cta = 'TAKE OFF  ·  PLAY IN YOUR BROWSER', ctaTrack = 4;
  ctx.font = '700 24px "JetBrains Mono", "DejaVu Sans Mono", monospace';
  let tw = -ctaTrack; for (const ch of cta) tw += ctx.measureText(ch).width + ctaTrack;
  const bw = Math.ceil(tw + 2 * 40), bh = 60, by = cy + 250;
  ctx.fillStyle = 'rgba(225,6,0,0.16)'; ctx.fillRect(cx - bw / 2, by, bw, bh);
  ctx.strokeRect(cx - bw / 2, by, bw, bh);
  ctx.fillStyle = OFF; ctx.textBaseline = 'middle';
  tracked(ctx, cta, cx, by + bh / 2 + 1, ctaTrack, 'center');
  ctx.restore();
}

export function drawOverlay(ctx, t, S) {
  flare(ctx, S, S.sun);
  // act one
  statement(ctx, S, t, 0.8, 2.75, 'ONE ISLAND.');
  statement(ctx, S, t, 3.55, 4.95, 'FOUR WORLDS.', { weight: 500 });
  card(ctx, S, t, 5.5, 10.4, '01', 'THE HEARTLAND', 'FORESTS · RIVERS · THE HOME FIELD', (u) => `HOME SECTOR  ·  ALT ${String(Math.round(48 + 6 * Math.sin(u * 1.3))).padStart(4, '0')} M  ·  ${Math.round(820 + u * 3)} KM/H`);
  card(ctx, S, t, 11.5, 17.4, '02', 'THE DUST SEA', 'DUNES · RED MESAS · OIL FIELDS', (u) => `16.5 KM EAST  ·  ALT ${String(Math.round(17 + 3 * Math.sin(u * 2.1))).padStart(4, '0')} M  ·  SURFACE 41°C`);
  card(ctx, S, t, 18.5, 24.4, '03', 'NORTHREACH', 'ICE FIELDS · AURORA · THE RESEARCH STATION', (u) => `17 KM NORTH  ·  OAT −${(31 + (u * 0.3) % 2).toFixed(0)}°C  ·  RWY 9° ICE`);
  card(ctx, S, t, 25.5, 31.4, '04', 'MOUNT KAELA', 'ACTIVE VOLCANO · LAVA LAKE · 9 KM OFFSHORE', (u) => `CRATER TEMP ${Math.round(1140 + 30 * Math.sin(u * 3))}°C  ·  ASH CEILING 4,800 M`);
  // montage
  slam(ctx, S, t, 32.0, 'SAND.'); slam(ctx, S, t, 32.5, 'ICE.'); slam(ctx, S, t, 33.0, 'FIRE.'); slam(ctx, S, t, 33.5, 'EARTH.');
  // hyper
  typed(ctx, S, t, 34.5, 36.05, [{ text: 'TARGET  ENEMY ISLAND', color: OFF }, { text: '2,000 KM DUE SOUTH', color: BLUE }]);
  hyperHud(ctx, S, t, S.hyper);
  statement(ctx, S, t, 39.0, 40.75, '2,000 KM.', { weight: 700, size: 150, glow: 'rgba(90,170,255,0.9)', track: 18 });
  statement(ctx, S, t, 41.0, 43.35, 'UNDER TWO MINUTES.', { weight: 700, size: 124, glow: 'rgba(90,170,255,0.9)', track: 14 });
  if (t > 43.85 && t < 45.2) {
    ctx.save(); ctx.globalAlpha = inOut(t, 43.85, 45.2, 0.1, 0.4);
    ctx.font = '700 22px "JetBrains Mono", "DejaVu Sans Mono", monospace'; ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(80,170,255,0.9)'; ctx.shadowBlur = 14;
    tracked(ctx, 'HYPER CRUISE COMPLETE  ·  25 KM', S.W / 2, S.BAR + 70, 6, 'center');
    ctx.restore();
  }
  card(ctx, S, t, 44.7, 48.35, '05', 'CARRIER OPS', 'STRIKE SQUAD · CATAPULT LAUNCH AT SEA', (u) => `CVN 73  ·  WIND ${Math.round(28 + Math.sin(u * 2) * 2)} KT DOWN THE DECK  ·  CATS 1 + 2`);
  title(ctx, S, t);
}
