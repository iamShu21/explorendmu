// Entry for the showcase page. Scenes are set up top to bottom, the order they sit on the page.
import { gsap, ScrollTrigger, env, $, on, emit, initReveals, initVideos, initPointer, initHeader } from './core.js';
import { initGradient } from './gradient.js';
import { initSpine } from './spine.js';
import { initTour } from './tour.js';
import { initSound } from './sound.js';
import { initDefense } from './defense.js';
import { heroEntrance, initHero } from './scenes/hero.js';
import { initScenes } from './scenes/index.js';

const gradient = initGradient();
initHeader();

/* ---------- intro: the logo draws in, then the gradient blooms (once per visit, skippable) ---------- */
const intro = $('[data-intro]');
const root = document.documentElement;
const playIntro = () => new Promise((resolve) => {
  if (!intro || !root.classList.contains('intro-on')) { gradient?.bloom(0); return resolve(0); }
  try { sessionStorage.setItem('ndmu-intro', '1'); } catch {}
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    tl.kill();
    gradient?.bloom(0.9);
    gsap.to(intro, { opacity: 0, duration: 0.4, ease: 'power2.out', onComplete: () => { root.classList.remove('intro-on'); intro.remove(); } });
    removeEventListener('keydown', finish); intro.removeEventListener('pointerdown', finish);
    resolve(0.1);
  };
  const tl = gsap.timeline({ onComplete: finish });
  tl.to('[data-intro-path]', { strokeDashoffset: 0, duration: 0.72, ease: 'power2.inOut' }, 0.08)
    .to('[data-intro-ring]', { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, 0.1)
    .to('.intro__logo', { scale: 0.94, duration: 0.25, ease: 'power2.in' }, 0.86);
  addEventListener('keydown', finish); intro.addEventListener('pointerdown', finish);
  setTimeout(finish, 1500); // never longer than 1.5 s, whatever happens
});

const sound = initSound();
playIntro().then((delay) => heroEntrance(delay));
initHero();
initScenes({ sound });
initReveals();
initVideos();
initPointer();
const tour = initTour();
initDefense(tour);
initSpine();

// "?tour=1" starts the tour straight away.
if (env.tourParam && !env.defense && tour) addEventListener('load', () => setTimeout(() => tour.play(), 600), { once: true });

// Positions depend on fonts and on images that arrive later.
document.fonts?.ready.then(() => ScrollTrigger.refresh());
addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
window.__site = { env, tour, sound, gradient, ScrollTrigger };
