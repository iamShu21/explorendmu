// Serves dist/ the way GitHub Pages does: under /explorendmu/, with 404.html for anything missing.
//   node scripts/verify/serve.mjs [port]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const BASE = '/explorendmu/';
const port = Number(process.argv[2] ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.vtt': 'text/vtt', '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.xml': 'application/xml' };

createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/' || url === BASE.slice(0, -1)) { res.writeHead(302, { location: BASE }); return res.end(); }
  let file = url.startsWith(BASE) ? join(dist, normalize(url.slice(BASE.length))) : null;
  if (file && url.endsWith('/')) file = join(file, 'index.html');
  let status = 200;
  if (!file || !file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) { file = join(dist, '404.html'); status = 404; }
  const size = statSync(file).size;
  const head = { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range && status === 200) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { ...head, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  // text is gzipped, as GitHub Pages does
  if (/\.(html|js|css|json|svg|xml|vtt)$/.test(file) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    const body = gzipSync(readFileSync(file));
    res.writeHead(status, { ...head, 'content-encoding': 'gzip', 'content-length': body.length });
    return res.end(body);
  }
  res.writeHead(status, { ...head, 'content-length': size });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}${BASE}`));
