// Screenshot helper for looking at the page while building.
//   node scripts/verify/shot.mjs --url http://localhost:4321/ --out shot.png --w 1440 --h 900 [--y 1200] [--id walk] [--p 0.5]
//   --id <scene id> scrolls to that scene; --p 0..1 scrolls that far through it; --device "iPhone 13"; --browser webkit
import { chromium, firefox, webkit, devices } from 'playwright';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const has = (name) => process.argv.includes(`--${name}`);
const url = arg('url', 'http://localhost:4321/?nointro&eager');
const out = arg('out', 'shot.png');
const browserType = { chromium, firefox, webkit }[arg('browser', 'chromium')];
const device = arg('device');
const w = Number(arg('w', 1440)), h = Number(arg('h', 900));

const browser = await browserType.launch({ args: arg('browser', 'chromium') === 'chromium' ? (has('soft') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']) : [] });
const context = await browser.newContext(device ? { ...devices[device] } : { viewport: { width: w, height: h }, deviceScaleFactor: Number(arg('dpr', 1)), reducedMotion: has('reduced') ? 'reduce' : 'no-preference' });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('requestfailed', (r) => { if (!/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) errors.push(`failed: ${r.url()} ${r.failure()?.errorText}`); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(arg('wait', 2500)));
const id = arg('id'), p = Number(arg('p', 0));
if (id) {
  await page.evaluate(([id, p]) => {
    const el = document.getElementById(id);
    const top = el.getBoundingClientRect().top + window.scrollY;
    const run = Math.max(0, el.offsetHeight - innerHeight);
    const y = top + run * p;
    window.__site?.tour ? window.scrollTo(0, y) : window.scrollTo(0, y);
  }, [id, p]);
  await page.waitForTimeout(Number(arg('settle', 1600)));
} else if (arg('y')) {
  await page.evaluate((y) => window.scrollTo(0, y), Number(arg('y')));
  await page.waitForTimeout(Number(arg('settle', 1600)));
}
await page.screenshot({ path: out, fullPage: has('full') });
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
else console.log('no console errors');
await browser.close();
