// Renders the trailer to MP4 with headless Chromium (software WebGL is fine, just slower).
//   node render.js                       -> glidepath-trailer.mp4 (1920x1080, 30 fps, AAC)
//   node render.js stills 3.1 16.3 29.4  -> still-<t>.jpg previews
// WORKERS=n sets how many browser processes share the frames (default: CPU count - 1).
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const FPS = 30, DUR = 35, here = __dirname;
const OUT = process.env.OUT || path.join(here, 'glidepath-trailer.mp4');
const FRAMES = process.env.FRAMES || path.join(os.tmpdir(), 'glidepath-frames');
const WORKERS = +process.env.WORKERS || Math.max(1, os.cpus().length - 1);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(here, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(here) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
async function open(port) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?capture`);
  await page.waitForFunction(() => window.trailerReady === true, null, { timeout: 180000 });
  return { browser, page };
}
const grab = async (page, t) => Buffer.from((await page.evaluate(t => window.renderFrame(t), t)).split(',')[1], 'base64');

(async () => {
  const srv = await serve(), port = srv.address().port;
  if (process.argv[2] === 'stills') {
    const { browser, page } = await open(port);
    for (const s of process.argv.slice(3)) {
      const t0 = Date.now();
      fs.writeFileSync(path.join(process.env.STILLS || here, `still-${s}.jpg`), await grab(page, +s));
      console.log(`still ${s}  ${Date.now() - t0} ms`);
    }
    await browser.close(); srv.close(); return;
  }
  fs.mkdirSync(FRAMES, { recursive: true });
  const total = FPS * DUR, started = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const { browser, page } = await open(port);
    if (w === 0) fs.writeFileSync(path.join(FRAMES, 'score.wav'), Buffer.from(await page.evaluate(() => window.renderAudio()), 'base64'));
    for (let i = w; i < total; i += WORKERS) {
      const f = path.join(FRAMES, `f${String(i).padStart(5, '0')}.jpg`);
      if (!fs.existsSync(f)) fs.writeFileSync(f, await grab(page, i / FPS));
      if (++done % 30 === 0) {
        const el = (Date.now() - started) / 1000;
        console.log(`${done}/${total} frames  ${el.toFixed(0)} s elapsed, ~${(el / done * (total - done) / 60).toFixed(1)} min left`);
      }
    }
    await browser.close();
  }));
  srv.close();
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.jpg'),
    '-i', path.join(FRAMES, 'score.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', '9M', '-bufsize', '18M',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg failed');
  console.log('wrote', OUT);
})().catch(e => { console.error(e); process.exit(1); });
