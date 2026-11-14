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

    let d = `M${xl} ${y0}`, x = xl;
    dots.innerHTML = '';
    for (let i = 1; i < tops.length; i++) {
      const yj = tops[i];
      if (yj - span / 2 <= y0 + 20 || yj + span / 2 >= y1 - 20) continue;
      const nx = x === xl ? xr : xl;
      d += ` L${x} ${yj - span / 2} C${x} ${yj + span * 0.05} ${nx} ${yj - span * 0.05} ${nx} ${yj + span / 2}`;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', yj - span / 2); c.setAttribute('r', 4.5);
      dots.appendChild(c);
      x = nx;
    }
    // The last stretch bends to the centre and stops above the arrival card.
    const cx = endRect ? endRect.left + endRect.width / 2 : w / 2;
    const yb = y1 - Math.min(260, vh * 0.3);
    d += ` L${x} ${yb} C${x} ${yb + (y1 - yb) * 0.7} ${cx} ${yb + (y1 - yb) * 0.3} ${cx} ${y1}`;
    line.setAttribute('d', d); glow.setAttribute('d', d);

    // Sample the path by height.
    const total = line.getTotalLength();
    samples = [];
    let l = 0, p = line.getPointAtLength(0);
    for (let y = y0; y <= y1; y += STEP) {
      while (l < total && p.y < y) { l += 3; p = line.getPointAtLength(l); }
      const q = line.getPointAtLength(Math.min(total, l + 10));
      samples.push({ x: p.x, a: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 90 });
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
