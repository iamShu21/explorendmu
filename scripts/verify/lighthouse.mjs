// Runs Lighthouse (mobile) on the built site and prints the numbers that matter.
// Start scripts/verify/serve.mjs first.   node scripts/verify/lighthouse.mjs [page] [--detail]
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const page = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
const url = `${process.env.SITE ?? 'http://localhost:4173/explorendmu/'}${page}`;
mkdirSync('.lighthouse', { recursive: true });
const out = `.lighthouse/${page.replace(/\W+/g, '-') || 'home'}.json`;
const r = spawnSync('npx', ['--yes', 'lighthouse', url, '--quiet', '--chrome-flags=--headless=new --no-sandbox', '--output=json', `--output-path=${out}`], { shell: true, stdio: 'inherit', env: { ...process.env, CHROME_PATH: chromium.executablePath() } });
if (r.status !== 0) process.exit(r.status ?? 1);
const lh = JSON.parse(readFileSync(out, 'utf8')), c = lh.categories, a = lh.audits;
console.log(`${url}\n  Performance ${Math.round(c.performance.score * 100)}  Accessibility ${Math.round(c.accessibility.score * 100)}  Best Practices ${Math.round(c['best-practices'].score * 100)}  SEO ${Math.round(c.seo.score * 100)}`);
for (const k of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'total-byte-weight']) console.log(`  ${k.padEnd(26)} ${a[k].displayValue}`);
const js = a['network-requests'].details.items.filter((i) => i.resourceType === 'Script').reduce((s, i) => s + i.transferSize, 0);
console.log(`  script transferred         ${(js / 1024).toFixed(0)} KiB (gzip), ${a['network-requests'].details.items.length} requests`);
for (const cat of ['accessibility', 'best-practices', 'seo']) for (const ref of c[cat].auditRefs) { const x = a[ref.id]; if (x.score !== null && x.score < 1) console.log(`  - ${cat}: ${ref.id}`); }
if (process.argv.includes('--detail')) {
  const lt = a['long-tasks']?.details?.items ?? [];
  console.log('  long tasks:', lt.map((i) => `${Math.round(i.startTime)}+${Math.round(i.duration)}ms ${i.url.split('/').pop().slice(0, 24)}`).join(' | '));
  console.log('  main thread:', a['mainthread-work-breakdown'].details.items.map((i) => `${i.groupLabel} ${Math.round(i.duration)}`).join(' | '));
  console.log('  scripts:', a['network-requests'].details.items.filter((i) => i.resourceType === 'Script').map((i) => `${i.url.split('/').pop().slice(0, 30)} ${(i.transferSize / 1024).toFixed(0)}K`).join(', '));
}
