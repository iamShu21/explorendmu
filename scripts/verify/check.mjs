// Cross-browser check of the built site (start scripts/verify/serve.mjs first).
// For every browser and width: load the page, scroll all the way down so every lazy asset is requested,
// and report console errors, failed or missing files, and horizontal overflow.
//   node scripts/verify/check.mjs [--quick]
import { chromium, firefox, webkit, devices } from 'playwright';

const base = process.env.SITE ?? 'http://localhost:4173/explorendmu/';
const quick = process.argv.includes('--quick');
const widths = quick ? [390, 1440] : [320, 360, 390, 768, 1280, 1440, 1920];
const engines = quick ? { chromium } : { chromium, firefox, webkit };
const runs = [];
for (const [name, type] of Object.entries(engines)) for (const w of widths) runs.push({ label: `${name} ${w}`, type, context: { viewport: { width: w, height: w < 700 ? 780 : 900 } } });
if (!quick) {
  runs.push({ label: 'iPhone 13 (webkit)', type: webkit, context: devices['iPhone 13'] });
  runs.push({ label: 'Pixel 7 (chromium)', type: chromium, context: devices['Pixel 7'] });
}
const pages = ['', 'research.html'];
let failures = 0;
const browsers = {};
for (const run of runs) {
  const key = run.type.name();
  browsers[key] ||= await run.type.launch(key === 'chromium' ? { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } : {});
  const context = await browsers[key].newContext(run.context);
  for (const path of pages) {
    const page = await context.newPage();
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => problems.push(`error: ${String(e).slice(0, 200)}`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', (r) => { const why = r.failure()?.errorText ?? ''; if (!/abort|cancel/i.test(why)) problems.push(`failed ${r.url()} ${why}`); });
    await page.goto(`${base}${path}?nointro`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1200);
    // scroll through the whole page
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = Math.round((run.context.viewport?.height ?? 800) * 0.8);
    let overflow = 0;
    for (let y = 0; y <= height; y += step) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(140);
      overflow = Math.max(overflow, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    }
    await page.waitForTimeout(1200);
    const unique = [...new Set(problems)];
    const ok = unique.length === 0 && overflow <= 0;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${run.label.padEnd(20)} /${path.padEnd(14)} height ${String(height).padStart(6)}  overflow ${overflow}px${unique.length ? '\n     ' + unique.slice(0, 6).join('\n     ') : ''}`);
    await page.close();
  }
  await context.close();
}
for (const b of Object.values(browsers)) await b.close();
console.log(failures ? `${failures} run(s) with problems` : 'all runs clean');
process.exit(failures ? 1 : 0);
