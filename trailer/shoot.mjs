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
await p.goto(`http://localhost:${port}/trailer.html`);
await p.waitForFunction(() => window.TRAILER_READY, null, { timeout: 300000 });
const grab = async (t) => p.evaluate((t) => { window.TRAILER.frame(t); return document.getElementById('out').toDataURL('image/jpeg', 0.95); }, t);
const t0 = Date.now();
if (range) {
  const [s, e, fps] = args.map(Number);
  const n0 = Math.round(s * fps), n1 = Math.round(e * fps);
  for (let n = n0; n < n1; n++) {
    const f = path.join(outDir, `f${String(n).padStart(5, '0')}.jpg`);
    if (fs.existsSync(f)) continue;
    const u = await grab(n / fps);
    fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
    if (n % 30 === 0) console.log('frame', n, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
} else {
  for (const a of args) { const u = await grab(Number(a)); fs.writeFileSync(path.join(outDir, `t${a}.jpg`), Buffer.from(u.split(',')[1], 'base64')); }
}
console.log('done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await b.close(); srv.close();
