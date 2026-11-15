// Hero: the headline rises line by line, then the 3D campus island wakes up (when the device can afford it).
import { gsap, SplitText, env, perf, $, $$, on, onVisible, clamp, EASE, DUR } from '../core.js';
import net from '../../data/campus-network.json';
import routes from '../../data/routes.gen.json';

export function heroEntrance(delay = 0) {
  const title = $('[data-hero-title]');
  if (!title || env.reduced) return;
  SplitText.create(title, {
    type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
    onSplit: (self) => gsap.from(self.lines, { yPercent: 108, duration: 1.1, ease: EASE.out, stagger: 0.1, delay }),
  });
  gsap.from('.hero-in', { y: 22, opacity: 0, duration: DUR.enter, ease: EASE.out, stagger: 0.08, delay: delay + 0.35, clearProps: 'transform,opacity' });
}

export function initHero() {
  const art = $('[data-hero-art]'), canvas = $('[data-hero-canvas]');
  if (!art || !canvas) return;
  // Live WebGL only where it will run well. Everyone else keeps the still of the same scene.
  if (!env.webgl || env.weak || env.reduced) return;

  let campus = null, visible = false, running = false, dead = false;
  const loop = (time, dt) => { campus?.render(Math.min(dt, 60) / 1000); };
  const start = () => { if (campus && visible && !running && !document.hidden && !dead) { running = true; gsap.ticker.add(loop); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(loop); } };
  const giveUp = () => { dead = true; stop(); art.classList.remove('is-live'); campus?.dispose(); campus = null; };

  const boot = async () => {
    if (dead || perf.slow) return;
    const { createCampus } = await import('../three/campus.js');
    if (dead) return;
    try {
      campus = createCampus(canvas, { net, mode: 'hero', route: routes.walk.pts, phone: env.phone, shadows: !env.phone || !env.touch, dpr: env.dpr });
    } catch { return; }
    campus.render(0);
    window.__heroCampus = campus;
    requestAnimationFrame(() => { art.classList.add('is-live'); start(); });
    canvas.addEventListener('campus-lost', giveUp);
  };
  // Wait until the page is idle so the first paint is never blocked.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
  const arm = () => idle(() => boot(), { timeout: 2500 });
  const whenLoaded = (fn) => (document.readyState === 'complete' ? fn() : addEventListener('load', fn, { once: true }));
  if (env.touch) {
    // Phones show the still of the same scene until the visitor first touches or scrolls the page:
    // building a 3D scene is the heaviest thing this page does, and a phone should not pay for it before it is wanted.
    const wake = () => { removeEventListener('touchstart', wake); removeEventListener('scroll', wake); whenLoaded(arm); };
    addEventListener('touchstart', wake, { passive: true, once: true });
    addEventListener('scroll', wake, { passive: true, once: true });
  } else whenLoaded(arm);

  onVisible(art, () => { visible = true; start(); }, () => { visible = false; stop(); });
  on('visibility', (v) => (v ? start() : stop()));
  on('slow', giveUp); // below about 45 fps: stop the hero 3D and fall back to the still

  // The island turns with the pointer on desktop and with the scroll on phones.
  if (env.fine) {
    const target = { x: 0, y: 0 };
    const tx = gsap.quickTo(target, 'x', { duration: 1.2, ease: 'power3', onUpdate: () => campus?.setPointer(target.x, target.y) });
    const ty = gsap.quickTo(target, 'y', { duration: 1.2, ease: 'power3' });
    addEventListener('pointermove', (e) => { if (!visible) return; tx((e.clientX / innerWidth) * 2 - 1); ty((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
  }
  addEventListener('scroll', () => { if (visible) campus?.setScroll(clamp(window.scrollY / innerHeight)); }, { passive: true });
}
