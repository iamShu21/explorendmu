// The whole page is a route. A thin gold path runs from the hero to the footer, each scene is a junction on it,
// and a gold chevron (the shape of the app's AR arrow) rides it with the scroll and turns at every junction.
import { gsap, ScrollTrigger, env, $, $$, clamp, on, emit } from './core.js';

const NS = 'http://www.w3.org/2000/svg';

export function initSpine() {
  const main = $('#main');
  const scenes = $$('[data-scene]');
  if (!main || scenes.length < 2) return;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'spine');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path class="spine__glow"/><path class="spine__line"/><g class="spine__dots"></g>';
  main.prepend(svg);
  const [glow, line] = svg.querySelectorAll('path');
  const dots = svg.querySelector('g');

  const chev = document.createElement('div');
  chev.className = 'chev';
  chev.setAttribute('aria-hidden', 'true');
  chev.innerHTML = '<div class="chev__tilt"><div class="chev__turn"><i></i><i></i><i></i></div></div>';
  document.body.appendChild(chev);
  const turn = chev.querySelector('.chev__turn');

  let samples = []; // [{y, x, a}] one per 6 px of page height, so position by scroll is a table lookup
  let y0 = 0, y1 = 0, mainTop = 0;
  const STEP = 6;

  const build = () => {
    const w = main.clientWidth, h = main.scrollHeight;
    mainTop = main.getBoundingClientRect().top + window.scrollY;
    svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 20;
    const gpx = gutter * (String(getComputedStyle(document.documentElement).getPropertyValue('--gutter')).includes('rem') ? 16 : 1);
    const wrap = $('.wrap');
    const pad = wrap ? parseFloat(getComputedStyle(wrap).paddingLeft) : gpx;
    const edge = wrap ? Math.max(0, (w - wrap.clientWidth) / 2) : 0;
    const xl = Math.round(edge + Math.max(11, pad * 0.42)), xr = w - xl;
    const vh = innerHeight;

    // Junctions: the top of every scene after the first.
    const tops = scenes.map((s) => s.getBoundingClientRect().top + window.scrollY - mainTop);
    const end = $('[data-arrival]');
    const endRect = end?.getBoundingClientRect();
    y0 = Math.min(vh * 0.74, (scenes[0].offsetHeight || vh) - 40);
    y1 = endRect ? endRect.top + window.scrollY - mainTop - 14 : h - 200;
    const span = Math.min(170, vh * 0.2); // height of a turn

    // The path is straight rails joined by S-shaped turns. Each turn is a cubic curve whose height only ever
    // increases, so "where is the path at height y" has one answer and can be worked out directly.
    let d = `M${xl} ${y0}`, x = xl;
    const turns = []; // {ya, yb, p: [x0, y0, x1, y1, x2, y2, x3, y3]}
    dots.innerHTML = '';
    for (let i = 1; i < tops.length; i++) {
      const yj = tops[i];
      if (yj - span / 2 <= y0 + 20 || yj + span / 2 >= y1 - 20) continue;
      const nx = x === xl ? xr : xl;
      const p = [x, yj - span / 2, x, yj + span * 0.05, nx, yj - span * 0.05, nx, yj + span / 2];
      d += ` L${p[0]} ${p[1]} C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}`;
      turns.push({ ya: p[1], yb: p[7], p });
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', yj - span / 2); c.setAttribute('r', 4.5);
      dots.appendChild(c);
      x = nx;
    }
    // The last stretch bends to the centre and stops above the arrival card.
    const cx = endRect ? endRect.left + endRect.width / 2 : w / 2;
    const yb = y1 - Math.min(260, vh * 0.3);
    const last = [x, yb, x, yb + (y1 - yb) * 0.7, cx, yb + (y1 - yb) * 0.3, cx, y1];
    d += ` L${last[0]} ${last[1]} C${last[2]} ${last[3]} ${last[4]} ${last[5]} ${last[6]} ${last[7]}`;
    turns.push({ ya: yb, yb: y1, p: last });
    line.setAttribute('d', d); glow.setAttribute('d', d);

    // Position and heading for every 6 px of height.
    const bez = (a, b, c, e, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e; };
    const dbez = (a, b, c, e, t) => { const u = 1 - t; return 3 * (u * u * (b - a) + 2 * u * t * (c - b) + t * t * (e - c)); };
    samples = [];
    let k = 0, rail = xl;
    for (let y = y0; y <= y1; y += STEP) {
      while (k < turns.length && y > turns[k].yb) { rail = turns[k].p[6]; k++; }
      const tn = turns[k];
      if (!tn || y < tn.ya) { samples.push({ x: rail, a: 180 }); continue; }
      let lo = 0, hi = 1;
      for (let n = 0; n < 18; n++) { const mid = (lo + hi) / 2; if (bez(tn.p[1], tn.p[3], tn.p[5], tn.p[7], mid) < y) lo = mid; else hi = mid; }
      const t = (lo + hi) / 2;
      const dx = dbez(tn.p[0], tn.p[2], tn.p[4], tn.p[6], t), dy = dbez(tn.p[1], tn.p[3], tn.p[5], tn.p[7], t);
      samples.push({ x: bez(tn.p[0], tn.p[2], tn.p[4], tn.p[6], t), a: (Math.atan2(dy, dx) * 180) / Math.PI + 90 });
    }
    update();
  };

  const setX = gsap.quickSetter(chev, 'x', 'px'), setY = gsap.quickSetter(chev, 'y', 'px');
  const setR = gsap.quickSetter(turn, 'rotation', 'deg'), setO = gsap.quickSetter(chev, 'opacity');
  let arrived = false;
  const update = () => {
    if (!samples.length) return;
    const sy = window.scrollY;
    const y = clamp(sy + innerHeight * 0.5 - mainTop, y0, y1);
    const s = samples[Math.min(samples.length - 1, Math.round((y - y0) / STEP))];
    setX(s.x); setY(y + mainTop - sy); setR(s.a);
    const done = y >= y1 - 2;
    setO(done ? 0 : 1);
    if (done !== arrived) { arrived = done; emit('arrived', done); }
  };

  ScrollTrigger.addEventListener('refresh', build);
  addEventListener('scroll', update, { passive: true });
  if (env.reduced) chev.classList.add('is-still');
  build();
  // Fonts and lazy images change heights; re-measure when the page settles.
  if (document.fonts?.ready) document.fonts.ready.then(() => requestAnimationFrame(build));
  addEventListener('load', () => setTimeout(build, 300));
  new ResizeObserver(() => { clearTimeout(build._t); build._t = setTimeout(build, 200); }).observe(main);
}
