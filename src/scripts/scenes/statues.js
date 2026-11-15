// Scan a statue in 3D: lazy <model-viewer> for the team's two models, a tap-to-play render for the Stallion.
import { gsap, env, perf, $, $$, onNear, onVisible } from '../core.js';

export function initStatues() {
  const section = $('#statues');
  if (!section) return;

  // a slow light sweep across the stage, tied to the scroll
  const sweep = $('.stage__sweep', section);
  if (sweep && !env.reduced) gsap.fromTo(sweep, { xPercent: -40 }, { xPercent: 360, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- our own models ---------- */
  let lib = null;
  const upgrade = async (view) => {
    if (view.dataset.state) return;
    view.dataset.state = 'loading';
    const state = $('[data-statue-state]', view), open = $('[data-statue-open]', view);
    const say = (text) => { state.textContent = text; state.hidden = !text; };
    open.disabled = true;
    say('Loading the 3D model…');
    try { lib ||= import('@google/model-viewer'); await lib; } catch { view.dataset.state = ''; open.disabled = false; return say('The 3D viewer could not load. Check your connection and try again.'); }
    const mv = document.createElement('model-viewer');
    const d = view.dataset;
    const attrs = {
      src: d.model, alt: d.alt, 'camera-orbit': d.orbit, 'camera-target': d.target, 'min-camera-orbit': d.minOrbit, 'max-camera-orbit': d.maxOrbit,
      'auto-rotate': '', 'auto-rotate-delay': '0', 'rotation-per-second': '14deg', 'interaction-prompt': 'none', 'touch-action': 'pan-y',
      'shadow-intensity': '0', exposure: '1.05', loading: 'eager',
    };
    if (d.fov !== 'auto') Object.assign(attrs, { 'field-of-view': d.fov, 'max-field-of-view': d.fov, 'min-field-of-view': '9deg' });
    if (d.ar) Object.assign(attrs, { ar: '', 'ar-modes': 'scene-viewer' }); // Android Scene Viewer only; no USDZ, so no iOS Quick Look
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    if (d.ar) mv.insertAdjacentHTML('beforeend', '<button slot="ar-button" type="button" class="btn btn-gold statue__ar"><i class="fi-rr-cube" aria-hidden="true"></i>View in your space</button>');
    const hint = document.createElement('p');
    hint.className = 'statue__hint';
    hint.textContent = env.touch ? 'Tap to turn it' : 'Click to turn and zoom';
    mv.addEventListener('load', () => { view.dataset.state = 'ready'; view.classList.add('is-3d'); say(''); view.appendChild(hint); $('video', view)?.pause(); }, { once: true });
    mv.addEventListener('error', () => { mv.remove(); hint.remove(); view.classList.remove('is-3d'); view.dataset.state = 'failed'; say('The 3D model could not load. The turntable above still shows it.'); }, { once: true });
    // The viewer never traps the page: it only takes drags and zoom after a tap, and gives them back once it is off screen.
    const unlock = () => { mv.setAttribute('camera-controls', ''); mv.setAttribute('data-lenis-prevent', ''); hint.remove(); };
    const lock = () => { mv.removeAttribute('camera-controls'); mv.removeAttribute('data-lenis-prevent'); };
    mv.addEventListener('click', unlock);
    onVisible(view, null, lock);
    view.appendChild(mv);
  };
  $$('[data-statue-view]', section).forEach((view) => {
    $('[data-statue-open]', view).addEventListener('click', () => upgrade(view));
    // Desktops load the live model by themselves when the scene is near. Phones keep the light turntable until asked.
    if (env.fine && env.webgl && !env.weak && !env.reduced) onNear(view, () => { if (!perf.slow) upgrade(view); }, '60% 0px');
  });

  /* ---------- the Bronze Stallion: the artist's own render, after a tap ---------- */
  const st = $('[data-stallion]', section);
  if (st) {
    $('[data-stallion-play]', st).addEventListener('click', () => {
      if ($('video', st)) return;
      const v = document.createElement('video');
      v.className = 'statue__turn';
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.setAttribute('aria-label', 'Turntable render of the Bronze Stallion model');
      // the files are served exactly as rendered: transparent WebM where the browser plays it, the dark MP4 elsewhere
      v.innerHTML = '<source src="stallion/stallion.webm" type="video/webm; codecs=vp9"><source src="stallion/stallion_dark.mp4" type="video/mp4">';
      st.appendChild(v);
      st.classList.add('is-playing');
      v.play().catch(() => {});
      onVisible(st, () => v.play().catch(() => {}), () => v.pause());
    });
  }
}
