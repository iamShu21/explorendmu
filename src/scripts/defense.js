// Defense mode (?defense=1): a presenter version of the page.
// Large type and no cursor come from CSS (html.defense). Here: the tour starts on the first key press or click,
// PageDown / PageUp and the arrow keys (what presentation clickers send) jump scene by scene,
// B blanks the screen, F toggles fullscreen.
import { env, $ } from './core.js';

export function initDefense(tour) {
  if (!env.defense || !tour) return;
  const blank = $('[data-blank]');
  let started = false;
  const start = () => { if (started) return false; started = true; tour.play(); return true; };

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'b' || k === 'B' || k === '.') { e.preventDefault(); if (blank) blank.hidden = !blank.hidden; return; }
    if (blank && !blank.hidden) { blank.hidden = true; e.preventDefault(); return; }
    if (k === 'f' || k === 'F') { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {}); return; }
    if (k === 'p' || k === 'P') { started = true; return; } // tour.js toggles play / pause
    if (start()) { e.preventDefault(); return; }
    if (['PageDown', 'ArrowRight', 'ArrowDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); tour.next(); }
    else if (['PageUp', 'ArrowLeft', 'ArrowUp'].includes(k)) { e.preventDefault(); tour.prev(); }
    else if (k === 'Home') { e.preventDefault(); tour.jump(0); }
  }, true);

  // The first click anywhere starts the tour (it does not count as "the visitor took over").
  addEventListener('pointerdown', (e) => { if (!started && !e.target.closest('[data-tourbar]')) { e.stopImmediatePropagation(); start(); } }, true);
}
