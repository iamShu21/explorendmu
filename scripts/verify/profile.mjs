// CPU profile of the first seconds on a phone-sized page: prints where script time goes.
//   node scripts/verify/profile.mjs
import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(devices['Pixel 7']);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await page.goto(`${process.env.SITE ?? 'http://localhost:4173/explorendmu/'}?nointro`, { waitUntil: 'load' });
await page.waitForTimeout(Number(process.argv[2] ?? 6000));
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map();
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
// total time per function (self + children), grouped by name and file
const total = new Map();
for (const [id, t] of self) {
  const seen = new Set();
  for (let cur = id; cur; cur = parent.get(cur)) {
    const f = byId.get(cur).callFrame;
    const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop().slice(0, 22)}:${f.lineNumber}:${f.columnNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    total.set(key, (total.get(key) ?? 0) + t);
  }
}
const all = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`sampled ${(all / 1000).toFixed(0)} ms in total (unthrottled)`);
const selfByFn = new Map();
for (const [id, t] of self) { const f = byId.get(id).callFrame; const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop().slice(0, 22)}:${f.lineNumber}:${f.columnNumber}`; selfByFn.set(key, (selfByFn.get(key) ?? 0) + t); }
console.log('--- self time');
[...selfByFn].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, t]) => console.log(`${(t / 1000).toFixed(1).padStart(7)} ms  ${k}`));
console.log('--- total time');
[...total].sort((a, b) => b[1] - a[1]).filter(([k]) => !/^\((root|program|idle)\)/.test(k)).slice(0, 22).forEach(([k, t]) => console.log(`${(t / 1000).toFixed(1).padStart(7)} ms  ${k}`));
await browser.close();
