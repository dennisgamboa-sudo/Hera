// Renders the CV's deliverables from lab/public/cv/index.html:
//   three one-page A4 PDFs (luxury, studio, ai) and the 16-second showreel MP4 + poster.
// Needs Playwright (Chromium), curl and ffmpeg.
//   node scripts/cv-render.mjs          -> PDFs and reel
//   node scripts/cv-render.mjs pdf      -> PDFs only
//   node scripts/cv-render.mjs reel     -> reel only
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let pw;
try { pw = await import('playwright'); } catch { pw = createRequire(path.join(execSync('npm root -g').toString().trim(), '/'))('playwright'); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'lab/public/cv');
const url = pathToFileURL(path.join(dir, 'index.html')).href;
const what = process.argv[2] || 'all';
const browser = await pw.chromium.launch();

// Google Fonts goes through curl, so the render works behind proxies Chromium does not trust.
const fonts = new Map();
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
async function open(options = {}, init) {
  const ctx = await browser.newContext(options);
  await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const u = route.request().url();
    if (!fonts.has(u)) fonts.set(u, execFileSync('curl', ['-sS', '-L', '-m', '30', '-A', UA, u]));
    await route.fulfill({ status: 200, body: fonts.get(u), headers: { 'content-type': u.includes('googleapis') ? 'text/css; charset=utf-8' : 'font/woff2', 'access-control-allow-origin': '*' } });
  });
  if (init) await ctx.addInitScript(init);
  return ctx.newPage();
}

async function pdfs() {
  const out = [['luxury', 'Dennis_Gamboa_CV.pdf'], ['studio', 'Dennis_Gamboa_CV_studio.pdf'], ['ai', 'Dennis_Gamboa_CV_ai.pdf']];
  for (const [v, name] of out) {
    const page = await open();
    await page.goto(`${url}#${v}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__reel.ready);
    await page.emulateMedia({ media: 'print' });
    const slack = await page.evaluate(() => {
      const s = document.querySelector('.sheet');
      const foot = s.querySelector('.foot').getBoundingClientRect().top;
      const bottoms = [...s.querySelectorAll('.cols > *')].flatMap(col => [...col.children]
        .filter(e => getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect().bottom));
      return Math.round(foot - Math.max(...bottoms)) - (s.scrollHeight - s.clientHeight);
    });
    if (slack < 0) throw new Error(`${v}: the content is ${-slack}px taller than one A4 page`);
    await page.pdf({ path: path.join(dir, name), preferCSSPageSize: true, printBackground: true });
    await page.context().close();
    console.log(`${name} · ${slack}px free above the footer`);
  }
}

async function reel() {
  const frames = mkdtempSync(path.join(tmpdir(), 'reel-'));
  const page = await open({ viewport: { width: 1920, height: 1080 } }, () => { window.__REEL_RENDER__ = true; });
  await page.goto(`${url}#luxury`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__reel.ready);
  const { DUR, FPS } = await page.evaluate(() => ({ DUR: window.__reel.DUR, FPS: window.__reel.FPS }));
  const total = (DUR + 1) * FPS; // one extra second on the end card
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.__reel.render(t), Math.min(DUR, f / FPS));
    await page.screenshot({ path: path.join(frames, `${String(f).padStart(4, '0')}.png`) });
  }
  await page.context().close();
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%04d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(dir, 'showreel.mp4')]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(frames, `${String(total - 1).padStart(4, '0')}.png`), '-q:v', '3', path.join(dir, 'showreel.jpg')]);
  rmSync(frames, { recursive: true, force: true });
  console.log(`showreel.mp4 · ${total} frames at ${FPS} fps`);
}

try {
  if (what === 'all' || what === 'pdf') await pdfs();
  if (what === 'all' || what === 'reel') await reel();
} finally {
  await browser.close();
}
