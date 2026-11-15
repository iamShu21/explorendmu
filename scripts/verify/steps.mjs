// Prints how long each start-up step takes on a slowed-down phone (4x CPU throttle), to find what blocks the page.
//   node scripts/verify/steps.mjs
import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(devices['Pixel 7']);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
page.on('console', (m) => { if (/^step /.test(m.text())) console.log(m.text()); });
await page.goto(`${process.env.SITE ?? 'http://localhost:4173/explorendmu/'}?nointro&perf`, { waitUntil: 'load' });
await page.waitForTimeout(6000);
await browser.close();
