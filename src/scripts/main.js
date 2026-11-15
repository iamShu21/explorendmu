// Entry for the showcase page.
//
// The page is complete as plain HTML and CSS: every scene can be read, and the intro runs, before this script has
// done anything. So the app does not set itself up while the visitor is still looking at the first screen. It waits
// for the first sign that they are about to use the page (a touch, a scroll, a key, the pointer moving) or for a few
// quiet seconds, and then sets up in small steps, one per task. Scenes are set up top to bottom, in page order.
import { ScrollTrigger, env, $, boot, initHeadlines, initReveals, initVideos, initPointer, initHeader } from './core.js';
import { initGradient } from './gradient.js';
import { initSpine } from './spine.js';
import { initTour } from './tour.js';
import { initSound } from './sound.js';
import { initDefense } from './defense.js';
import { heroEntrance, initHero } from './scenes/hero.js';
import { sceneSteps } from './scenes/index.js';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const site = (window.__site = { env, ScrollTrigger, tour: null, sound: null, gradient: null, ready: false });
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
  // in a task of its own, so loading this script and splitting the headline are never one long task
  if (left > 500) setTimeout(() => { boot(); heroEntrance(Math.max(0, (1450 - performance.now() - 550) / 1000)); }, 0);
}

/* ---------- setting up, one small step at a time ---------- */
const ctx = {};
// Until now the browser has rendered the first screen only (content-visibility in global.css).
// The scenes below are rendered one per frame, before anything measures the page.
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
  () => initHeadlines(),
  () => initReveals(),
  () => initVideos(),
  () => initPointer(),
  () => { site.tour = initTour(); },
  () => initDefense(site.tour),
  () => initSpine(),
  () => ScrollTrigger.refresh(),
];
const timing = params.has('perf');
let pressed = null, wokeWithP = false; // what the visitor pressed before the page was ready
const next = () => {
  const step = steps.shift();
  if (!step) {
    site.ready = true;
    // "?tour=1" starts the tour straight away.
    if (env.tourParam && !env.defense && site.tour) setTimeout(() => site.tour.play(), 400);
    // The press that woke the page up still counts: Start tour, Sound, a scene dot.
    if (pressed?.isConnected) pressed.click();
    else if (wokeWithP) site.tour?.toggle();
    return;
  }
  const t0 = performance.now();
  step();
  if (timing) console.log(`step ${String(step).slice(6, 60).replace(/\s+/g, ' ')}: ${(performance.now() - t0).toFixed(1)} ms`);
  // a step that changes what is rendered waits for the next frame, so each one gets a frame to itself
  if (step.frame) requestAnimationFrame(() => setTimeout(next, 0)); else setTimeout(next, 0);
};

const WAKE = ['pointerdown', 'pointermove', 'touchstart', 'wheel', 'keydown', 'scroll'];
const CONTROLS = '[data-tour-toggle], [data-tour-start], [data-tour-speed], [data-tour-jump], [data-tour-list-toggle], [data-sound], [data-sound-on]';
// a click on one of the controls that lands before they are ready is repeated once they are
addEventListener('click', (e) => { if (!site.ready && e.isTrusted) pressed = e.target.closest?.(CONTROLS) ?? pressed; }, true);
let started = false;
const start = (e) => {
  if (started) return;
  started = true;
  WAKE.forEach((type) => removeEventListener(type, start, true));
  if (e) env.interacted = true;
  if (e?.type === 'keydown' && /^p$/i.test(e.key)) wokeWithP = true;
  // if the visitor is scrolling, the steps do not wait for frames: the page should be ready as soon as possible
  if (e) renderSteps.forEach((s) => (s.frame = e.type === 'pointermove'));
  requestAnimationFrame(() => setTimeout(next, 0));
};
if (params.has('eager') || env.tourParam || env.defense || timing || env.reduced) start();
else {
  WAKE.forEach((type) => addEventListener(type, start, { capture: true, passive: true }));
  // no sign of life: set up anyway once the page has been quiet for a while
  const later = () => setTimeout(() => (window.requestIdleCallback || setTimeout)(() => start()), 5500);
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}

// Positions depend on fonts and on images that arrive later.
let refreshTimer = 0;
const refreshSoon = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => site.ready && ScrollTrigger.refresh(), 300); };
document.fonts?.ready.then(refreshSoon);
addEventListener('load', refreshSoon, { once: true });
