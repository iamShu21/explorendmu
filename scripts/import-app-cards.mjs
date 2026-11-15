// One-off import: copies, unchanged, the few place cards the site's info-cards.json does not have from the app
// (the Unity project is only read). They are written to src/data/info-cards-app.json.
//   node scripts/import-app-cards.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UNITY = process.env.NDMU_UNITY ?? 'C:/Users/USER/ExploreNDMU Final';
const app = JSON.parse(readFileSync(join(UNITY, 'Assets/Resources/ArInfoCards.json'), 'utf8')).cards;
const wanted = ['CASSC Office', 'OSAD (Office of Student Affairs and Development)', 'Records Section', 'Gate 01 (Main Gate)'];
const cards = wanted.map((name) => {
  const c = app.find((x) => x.name === name);
  if (!c) throw new Error(`The app has no card named "${name}"`);
  return { name: c.name, about: c.about, services: c.services ?? [], schedule: c.schedule ?? [], match: c.match ?? [] };
});
// Bro. Renato B. Cruz Hall has no info card in the app, only a directory entry. Its one-line description is taken
// from that entry (Assets/Scripts/Data/BRC Building.asset).
const asset = readFileSync(join(UNITY, 'Assets/Scripts/Data/BRC Building.asset'), 'utf8');
const description = asset.match(/\n  description: ([\s\S]*?)\n  about:/)?.[1].replace(/\s*\n\s*/g, ' ').trim();
if (!description) throw new Error('Could not read the description of Bro. Renato B. Cruz Hall');
cards.push({ name: 'Bro. Renato B. Cruz Hall', about: description, services: [], schedule: [], match: [] });
writeFileSync(join(root, 'src/data/info-cards-app.json'), JSON.stringify({ note: 'Copied unchanged from the app by scripts/import-app-cards.mjs.', cards }, null, 1) + '\n');
console.log(cards.map((c) => `${c.name}: ${c.about.slice(0, 70)}…`).join('\n'));
