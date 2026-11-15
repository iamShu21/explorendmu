// Dev tool: renders the stills that stand in for live WebGL, from the live scenes themselves.
//   1. public/img/hero-island-*.avif|webp   the hero's 3D campus island (transparent background)
//   2. src/img-static/gradient.avif         the living gradient, as a still
//   3. public/og.jpg                        the social card (the hero at 1200x630)
// Needs the dev server running:  npm run dev   then   node scripts/capture-posters.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.SITE ?? 'http://localhost:4321/';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

// 1. hero island
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  await page.goto(`${base}?nointro&eager&hour=13`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__heroCampus, null, { timeout: 30000 });
  const data = await page.evaluate(() => {
    const art = document.querySelector('[data-hero-art]');
    Object.assign(art.style, { position: 'fixed', left: '0', top: '0', right: 'auto', bottom: 'auto', width: '1440px', height: '990px', margin: '0', transform: 'none' });
    const c = window.__heroCampus;
    c.state.t = 0; c.setPointer(0, 0); c.setScroll(0);
    c.render(0);
    return document.querySelector('[data-hero-canvas]').toDataURL('image/png');
  });
  const img = sharp(png(data));
  for (const w of [1440, 960, 720]) {
    await img.clone().resize(w).avif({ quality: 58 }).toFile(join(root, `public/img/hero-island-${w}.avif`));
    await img.clone().resize(w).webp({ quality: 80 }).toFile(join(root, `public/img/hero-island-${w}.webp`));
  }
  console.log('hero island written');
  await page.close();
}

// 2. gradient still (the daytime look)
{
  const page = await browser.newPage({ viewport: { width: 900, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(`${base}?nointro&eager&hour=13`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__site?.gradient, null, { timeout: 30000 });
  const data = await page.evaluate(async () => {
    const g = window.__site.gradient;
    await g.boot();
    g.canvas.width = 600; g.canvas.height = 900; g.gl.viewport(0, 0, 600, 900);
    Object.assign(g.state, { bloom: 1, g: 1, m: 1, x: 0, y: 0, z: 1, t: 12 });
    g.draw();
    return g.canvas.toDataURL('image/png');
  });
  await sharp(png(data)).resize(900, 1350).blur(6).avif({ quality: 48 }).toFile(join(root, 'src/img-static/gradient.avif'));
  console.log('gradient still written');
  await page.close();
}

// 3. social card
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`${base}?nointro&eager&hour=13`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__heroCampus, null, { timeout: 30000 });
  await page.addStyleTag({ content: '.site-header,.tourbar,.chev,.spine,.hero__counter,.hero__actions{display:none!important}' });
  await page.waitForTimeout(2500);
  const shot = await page.screenshot({ type: 'png' });
  await sharp(shot).jpeg({ quality: 84, mozjpeg: true }).toFile(join(root, 'public/og.jpg'));
  console.log('og.jpg written');
  await page.close();
}
await browser.close();
