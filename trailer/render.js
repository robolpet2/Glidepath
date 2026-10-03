// Renders trailer.html to an MP4 (1920x1080, 30 fps, AAC audio) with headless Chromium.
//   node render.js                 -> glidepath-trailer.mp4
//   node render.js stills 4 16 31  -> frame-<t>.jpg previews
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30, DUR = 35;
const here = __dirname;
const out = process.env.OUT || path.join(here, 'glidepath-trailer.mp4');

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto('file://' + path.join(here, 'trailer.html') + '?capture');
  await page.evaluate(() => window.trailerReady);

  const grab = async t => Buffer.from((await page.evaluate(t => window.renderFrame(t), t)).split(',')[1], 'base64');

  if (process.argv[2] === 'stills') {
    for (const s of process.argv.slice(3)) fs.writeFileSync(path.join(process.env.STILLS || here, `frame-${s}.jpg`), await grab(+s));
    await browser.close();
    return;
  }

  const wavPath = out.replace(/\.mp4$/, '.wav');
  fs.writeFileSync(wavPath, Buffer.from(await page.evaluate(() => window.renderAudio()), 'base64'));

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wavPath,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '7M', '-bufsize', '14M', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = FPS * DUR;
  for (let i = 0; i < total; i++) {
    const buf = await grab(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${total}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg exit ' + c)) : res()));
  fs.unlinkSync(wavPath);
  await browser.close();
  console.log('wrote', out);
})().catch(e => { console.error(e); process.exit(1); });
