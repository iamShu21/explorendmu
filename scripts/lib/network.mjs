// Geometry helpers for src/data/campus-network.json (the team's walked routes, projected to a flat plane).
// Everything the site says about distances comes from here.

/** "M369.2 273.9 L322.6 313.6 ..." -> [[x, y], ...] */
export const parsePath = (d) => {
  const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = [];
  for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  return pts;
};
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const polyLength = (pts) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);
export const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${+p[0].toFixed(1)} ${+p[1].toFixed(1)}`).join(' ');

/** Metres recorded for a walk: the number in its name, e.g. "Gate 03 to Library (192 m)". */
export const namedMetres = (name) => Number(name.match(/\((\d+) m\)\s*$/)?.[1] ?? NaN);
export const stripMetres = (name) => name.replace(/\s*\(\d+ m\)\s*$/, '');
/** "Gate 03 to Library (192 m)" -> ["Gate 03", "Library"] */
export const walkEnds = (name) => stripMetres(name).split(/ to (.*)/s).slice(0, 2);

/**
 * Metres per plane unit. Each walk's name carries the distance the app recorded for it
 * (Haversine over the GPS points). Scale = sum of those metres / sum of the walks' path lengths.
 */
export const metresPerUnit = (net) => {
  let m = 0, u = 0;
  for (const w of net.walks) { m += namedMetres(w.name); u += polyLength(parsePath(w.d)); }
  return m / u;
};
