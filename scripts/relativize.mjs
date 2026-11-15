// Makes every root-absolute URL in the built site relative ("/assets/x" -> "./assets/x"),
// so the same build works under any sub-path: https://<user>.github.io/explorendmu/, a preview, a file server.
// All pages are emitted at the root of dist/ (build.format 'file'), and the site's own asset URLs are already
// written relative in the source; this pass only fixes what the bundler emits.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

let changed = 0;
for (const file of walk(dist)) {
  const ext = extname(file);
  if (!['.html', '.css', '.js'].includes(ext)) continue;
  const depth = relative(dist, file).split(sep).length - 1; // 0 for files at the root
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const before = readFileSync(file, 'utf8');
  let s = before;
  if (ext === '.html') {
    // attributes that hold a URL (the <base> tag of the 404 page keeps its absolute address)
    s = s.replace(/(<(?!base\b)[^>]*?\s(?:href|src|poster|data-src)=")\/(?!\/)/g, `$1${up}`);
    s = s.replace(/(\s(?:srcset|imagesrcset)=")([^"]*)"/g, (m, a, list) => `${a}${list.replace(/(^|,\s*)\/(?!\/)/g, `$1${up}`)}"`);
    // run the first rule again for tags with several URL attributes
    for (let i = 0; i < 4; i++) s = s.replace(/(<(?!base\b)[^>]*?\s(?:href|src|poster|data-src)=")\/(?!\/)/g, `$1${up}`);
    s = s.replace(/url\((["']?)\/(?!\/)/g, `url($1${up}`); // inlined stylesheets
  }
  if (ext === '.css') s = s.replace(/url\((["']?)\/(?!\/)/g, `url($1${up}`);
  if (ext === '.js') {
    // the bundler's loader for lazy chunks builds URLs from the site root; make it page-relative instead
    s = s.replace(/return\s*"\/"\s*\+\s*([a-zA-Z_$][\w$]*)/g, 'return new URL($1,document.baseURI).href');
  }
  if (s !== before) { writeFileSync(file, s); changed++; }
}
console.log(`relative URLs written (${changed} files changed)`);
