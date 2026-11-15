// Entry for the showcase page.
// Only what the first screen needs runs straight away. Everything else is set up in small steps, one per task,
// so the page paints and answers input quickly. Scenes are still set up top to bottom, the order they sit on the page.
import { ScrollTrigger, env, $, boot, initReveals, initVideos, initPointer, initHeader } from './core.js';
import { initGradient } from './gradient.js';
import { initSpine } from './spine.js';
import { initTour } from './tour.js';
import { initSound } from './sound.js';
import { initDefense } from './defense.js';
import { heroEntrance, initHero } from './scenes/hero.js';
import { sceneSteps } from './scenes/index.js';

const root = document.documentElement;
const site = (window.__site = { env, ScrollTrigger, tour: null, sound: null, gradient: null });
initHeader();

/* ---------- intro ---------- */
// The intro itself runs on CSS (see Intro.astro), so it never waits for this script. Here: any click or key skips
// it, it is tidied away when it ends, and the headline rises behind it if this script arrived while it was still up.
const intro = $('[data-intro]');
if (intro && root.classList.contains('intro-on')) {
  const clear = () => { root.classList.remove('intro-on'); intro.remove(); removeEventListener('keydown', clear); };
  intro.addEventListener('pointerdown', clear, { once: true });
  addEventListener('keydown', clear);
  const left = 1450 - performance.now(); // the CSS intro is over about 1.45 s after the page starts
  setTimeout(clear, Math.max(0, left));
  if (left > 500) { boot(); heroEntrance(Math.max(0, (left - 550) / 1000)); }
}

/* ---------- everything else, one small step at a time ---------- */
const ctx = {};
// For the first paint the browser renders the first screen only (content-visibility in global.css).
// The scenes below are then rendered one per frame, before anything measures the page.
const deferred = [...document.querySelectorAll('#main > .scene ~ .scene, .site-footer')];
const renderSteps = deferred.map((el) => Object.assign(() => { el.style.contentVisibility = 'visible'; }, { frame: true }));
const steps = [
  ...renderSteps,
  () => { root.classList.add('rendered'); deferred.forEach((el) => el.style.removeProperty('content-visibility')); },
  () => boot(),
  () => { site.gradient = initGradient(); },
  () => { site.sound = ctx.sound = initSound(); },
  () => initHero(),
  ...sceneSteps.map((step) => () => step(ctx)),
  () => initReveals(),
  () => initVideos(),
  () => initPointer(),
  () => { site.tour = initTour(); },
  () => initDefense(site.tour),
  () => initSpine(),
  () => ScrollTrigger.refresh(),
  // "?tour=1" starts the tour straight away.
  () => { if (env.tourParam && !env.defense && site.tour) setTimeout(() => site.tour.play(), 400); },
];
const timing = new URLSearchParams(location.search).has('perf');
const next = () => {
  const step = steps.shift();
  if (!step) { site.ready = true; return; }
  const t0 = performance.now();
  step();
  if (timing) console.log(`step ${String(step).slice(6, 60).replace(/\s+/g, ' ')}: ${(performance.now() - t0).toFixed(1)} ms`);
  // a step that changes what is rendered waits for the next frame, so each one gets a frame to itself
  if (step.frame) requestAnimationFrame(() => setTimeout(next, 0)); else setTimeout(next, 0);
};
// start after the first paint
requestAnimationFrame(() => setTimeout(next, 0));

// Positions depend on fonts and on images that arrive later.
let refreshTimer = 0;
const refreshSoon = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => site.ready && ScrollTrigger.refresh(), 300); };
document.fonts?.ready.then(refreshSoon);
addEventListener('load', refreshSoon, { once: true });
