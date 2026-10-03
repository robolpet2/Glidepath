// usage: node shoot.mjs out_dir t1 t2 ...   (renders stills)  |  node shoot.mjs --range out_dir start end fps
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.cwd();
const port = 8800 + Math.floor(Math.random() * 900);
const srv = http.createServer((q, s) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } const ext = path.extname(f); s.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' }[ext] || 'application/octet-stream' }); s.end(d); }); }).listen(port);
const args = process.argv.slice(2);
const range = args[0] === '--range'; if (range) args.shift();
const outDir = args.shift(); fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('LOG', m.text().slice(0, 300)); });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://localhost:${port}/trailer.html?samples=${process.env.SAMPLES || 1}`);
await p.waitForFunction(() => window.TRAILER_READY, null, { timeout: 300000 });
const grab = async (t) => p.evaluate((t) => { window.TRAILER.frame(t); return document.getElementById('out').toDataURL('image/jpeg', 0.95); }, t);
const t0 = Date.now();
if (range) {
  const [s, e, fps] = args.map(Number);
  const n0 = Math.round(s * fps), n1 = Math.round(e * fps);
  // each frame is claimed with an exclusive lock file, so several workers never render the same frame
  const fname = (n) => path.join(outDir, `f${String(n).padStart(5, '0')}.jpg`);
  const claim = (n) => { try { fs.closeSync(fs.openSync(path.join(outDir, `.claim_${n}`), 'wx')); return true; } catch (e) { return false; } };
  const doFrame = async (n) => {
    if (fs.existsSync(fname(n)) || !claim(n)) return;
    const u = await grab(n / fps);
    fs.writeFileSync(fname(n), Buffer.from(u.split(',')[1], 'base64'));
    if (n % 30 === 0) console.log('frame', n, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  };
  for (let n = n0; n < n1; n++) await doFrame(n);
  // done early? help with what's left of the current queue section, from its end backwards
  try {
    const m = [...fs.readFileSync('logs/queue3.log', 'utf8').matchAll(/START \S+ \(.*?frames (\d+)-(\d+)\)/g)].pop();
    if (m) { const a = +m[1], b = +m[2]; if (n0 >= a && n1 <= b + 1) for (let n = b; n >= a; n--) await doFrame(n); }
  } catch (e) {}
} else {
  for (const a of args) { const u = await grab(Number(a)); fs.writeFileSync(path.join(outDir, `t${a}.jpg`), Buffer.from(u.split(',')[1], 'base64')); }
}
console.log('done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await b.close(); srv.close();
