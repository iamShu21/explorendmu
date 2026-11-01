// Make every root-absolute URL in the built HTML/CSS relative ("/x" -> "./x"),
// so the site works under any sub-path (GitHub Pages project site, previews).
// All pages are emitted at the root of dist/ (build.format 'file').
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

for (const file of walk(dist)) {
  const ext = extname(file);
  if (!['.html', '.css', '.js'].includes(ext)) continue;
  let s = readFileSync(file, 'utf8');
  const depth = file.slice(dist.length).split('/').length - 1; // 0 for root files
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const before = s;
  if (ext === '.html') {
    s = s.replace(/(\s(?:href|src|poster|content|srcset|data-src)=")\/(?!\/)/g, `$1${up}`);
    // asset paths inside other attributes (data-lightbox="/fig/…", JSON in data-models)
    s = s.replace(/(&quot;|")\/(models|img|video|downloads|fig)\//g, `$1${up}$2/`);
  }
  if (ext === '.css') {
    // CSS lives in /assets: fonts and images are siblings or one level up
    s = s.replace(/url\((["']?)\/(?!\/)/g, `url($1${up}`);
  }
  if (ext === '.js') {
    s = s.replace(/(["'`])\/(models|img|video|downloads|fig|fonts|vendor)\//g, `$1./$2/`);
  }
  if (s !== before) writeFileSync(file, s);
}
console.log('relative URLs written');
