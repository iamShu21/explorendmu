// Shared motion core: one animation engine (GSAP + ScrollTrigger), one scroll system (Lenis on GSAP's ticker),
// one set of easings and durations, and the device checks every scene uses.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

export { gsap, ScrollTrigger, SplitText };

/* ---------- tokens (mirrored in global.css) ---------- */
export const EASE = { out: 'expo.out', inOut: 'power3.inOut', soft: 'sine.inOut', none: 'none' };
export const DUR = { enter: 0.9, micro: 0.25 };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- environment ---------- */
const params = new URLSearchParams(location.search);
// Whether WebGL is worth trying. No test context is created here (that alone can stall the first paint);
// the first real context, the gradient's, sets env.webgl to false if the browser refuses it.
const hasWebGL = () => !params.has('nowebgl') && !!window.WebGLRenderingContext; // "?nowebgl" lets us test the fallbacks
const cores = navigator.hardwareConcurrency || 4;
const memory = navigator.deviceMemory || 4;
const conn = navigator.connection || {};
export const env = {
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
  touch: matchMedia('(pointer: coarse)').matches,
  // asked as a media query: reading innerWidth here would force a layout of the whole page before its first paint
  phone: matchMedia('(max-width: 599px), (max-height: 599px)').matches,
  defense: params.get('defense') === '1',
  tourParam: params.get('tour') === '1',
  interacted: false, // set once the visitor has touched, scrolled or typed
  webgl: hasWebGL(),
  saveData: !!conn.saveData,
  // "weak" = little memory or few cores, or the visitor asked to save data. Real frame time can lower this later.
  weak: memory <= 2 || cores <= 2 || !!conn.saveData || params.has('weak'),
  dpr: Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2),
};
const root = document.documentElement;
if (!env.webgl) root.classList.add('no-webgl');
if (env.weak) root.classList.add('weak');

/* ---------- tiny event bus ---------- */
const listeners = {};
export const on = (name, fn) => { (listeners[name] ||= []).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; };
export const emit = (name, data) => (listeners[name] || []).forEach((fn) => fn(data));

/* ---------- smooth scroll ---------- */
export let lenis = null;
// Registering ScrollTrigger measures the page, which forces a layout. So the engine is switched on by the entry
// script after the first paint, not while this module loads.
let booted = false;
export const boot = () => {
  if (booted) return;
  booted = true;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true }); // the iOS address bar collapsing must not re-measure the page
  if (!env.reduced) {
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
};
export const scrollY = () => (lenis ? lenis.scroll : window.scrollY);
export const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
/** Scroll to a position or element. `immediate` jumps without easing (the tour drives the page this way). */
export const scrollTo = (target, { immediate = false, duration = 1.2, offset = 0 } = {}) => {
  if (lenis) lenis.scrollTo(target, { immediate, duration, offset, force: true, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else {
    const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top: y, behavior: 'auto' });
  }
};

/* ---------- visibility helpers ---------- */
const io = (cb, opts) => ('IntersectionObserver' in window ? new IntersectionObserver(cb, opts) : null);
/** Run once when the element comes within `margin` of the viewport (lazy loading). */
export const onNear = (el, cb, margin = '100% 0px') => {
  if (!el) return;
  const o = io((entries) => entries.forEach((e) => { if (e.isIntersecting) { o.disconnect(); cb(el); } }), { rootMargin: margin });
  if (o) o.observe(el); else cb(el);
};
/** Enter / leave callbacks (pause WebGL and video off-screen). */
export const onVisible = (el, enter, leave, { threshold = 0.01, margin = '0px' } = {}) => {
  if (!el) return;
  const o = io((entries) => entries.forEach((e) => (e.isIntersecting ? enter?.(el) : leave?.(el))), { threshold, rootMargin: margin });
  if (o) o.observe(el); else enter?.(el);
};
document.addEventListener('visibilitychange', () => emit('visibility', !document.hidden));

/* ---------- real frame time: drop quality when the device cannot keep up ---------- */
// Samples frames while something is animating. Below about 45 fps for a sustained window, we emit "slow" once.
export const perf = { slow: false };
(() => {
  if (env.reduced) return;
  let last = 0, bad = 0, good = 0, frames = 0;
  const tick = (now) => {
    if (perf.slow) return;
    if (!document.hidden && last) {
      const dt = now - last;
      if (dt < 250) { // ignore tab switches and long pauses
        frames++;
        if (frames > 30) { // let the page settle first
          if (dt > 1000 / 45) bad++; else good++;
          if (bad + good >= 90) {
            if (bad / (bad + good) > 0.55) { perf.slow = true; root.classList.add('slow'); emit('slow'); return; }
            bad = good = 0;
          }
        }
      }
    }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();

/* ---------- reveals ---------- */
// Content is visible by default. JS hides only what is below the first screen, an IntersectionObserver brings it in,
// and a timer shows anything that is on screen but somehow still hidden.
const below = (el) => el.getBoundingClientRect().top > innerHeight * 0.92;
export const initHeadlines = () => {
  if (env.reduced) return;
  // Headlines: line by line through masks.
  $$('[data-split]').forEach((el) => {
    const waiting = below(el) && !el.closest('[data-no-reveal]');
    let tween = null, shown = !waiting;
    const split = SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
      onSplit(self) {
        if (shown) return gsap.set(self.lines, { yPercent: 0 });
        tween = gsap.from(self.lines, { yPercent: 108, duration: DUR.enter, ease: EASE.out, stagger: 0.09, paused: true });
        return tween;
      },
    });
    el._reveal = () => { if (shown) return; shown = true; tween ? tween.play() : gsap.set(split.lines, { yPercent: 0 }); };
    if (waiting) onVisibleOnce(el, el._reveal);
  });
};
export const initReveals = () => {
  if (env.reduced) return;
  // Everything else: a single quiet rise.
  const items = $$('.rv').filter(below);
  gsap.set(items, { opacity: 0, y: 26 });
  let queue = [], raf = 0;
  const show = (el) => {
    queue.push(el);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { gsap.to(queue, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.out, stagger: 0.06, overwrite: true }); queue = []; });
  };
  items.forEach((el) => onVisibleOnce(el, show));
  // safety net
  const rescue = () => {
    items.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0 && +getComputedStyle(el).opacity < 0.05) gsap.to(el, { opacity: 1, y: 0, duration: 0.5, overwrite: true }); });
    $$('[data-split]').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el._reveal?.(); });
  };
  setInterval(rescue, 2500);
};
export const onVisibleOnce = (el, cb, margin = '0px 0px -10% 0px') => {
  const o = io((entries) => entries.forEach((e) => { if (e.isIntersecting) { o.unobserve(e.target); cb(e.target); } }), { rootMargin: margin });
  if (o) o.observe(el); else cb(el);
};

/* ---------- lazy video ---------- */
// Every clip below the fold has preload="none" and a poster. The file is fetched only when the clip is near the screen,
// it plays only while visible, and it pauses when the tab is hidden. With reduced motion nothing autoplays.
export const initVideos = () => {
  const vids = $$('video[data-lazy]');
  const load = (v) => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    v.src = v.dataset.src;
    v.load();
  };
  vids.forEach((v) => {
    v.muted = true; v.playsInline = true;
    // the poster comes first, well before the clip is on screen
    onNear(v, () => { if (v.dataset.poster) v.poster = v.dataset.poster; }, '250% 0px');
    if (env.reduced) { v.controls = true; v.loop = false; onNear(v, load, '50% 0px'); return; }
    onNear(v, load, '120% 0px');
    onVisible(v, () => { v.dataset.inview = '1'; if (v.dataset.hold !== '1') v.play().catch(() => {}); }, () => { v.dataset.inview = ''; v.pause(); }, { threshold: 0.2 });
    v.addEventListener('error', () => v.classList.add('is-broken'));
  });
  on('visibility', (visible) => vids.forEach((v) => { if (!visible) v.pause(); else if (v.dataset.inview === '1' && v.dataset.hold !== '1' && !env.reduced) v.play().catch(() => {}); }));
};

/* ---------- desktop niceties: gold ring cursor and magnetic buttons ---------- */
export const initPointer = () => {
  if (!env.fine || env.reduced || env.defense) return;
  const ring = $('[data-cursor]');
  if (ring) {
    const x = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
    const y = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
    const s = gsap.quickTo(ring, 'scale', { duration: 0.3, ease: 'power3' });
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      ring.classList.add('is-on'); x(e.clientX); y(e.clientY);
      s(e.target.closest?.('a, button, [role="button"], input, summary, model-viewer, [data-hover]') ? 1.7 : 1);
    }, { passive: true });
    addEventListener('pointerdown', () => ring.classList.add('is-down'));
    addEventListener('pointerup', () => ring.classList.remove('is-down'));
    document.addEventListener('pointerleave', () => ring.classList.remove('is-on'));
  }
  $$('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.22); y((e.clientY - r.top - r.height / 2) * 0.3); });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
};

/* ---------- header ---------- */
export const initHeader = () => {
  const header = $('[data-header]');
  if (!header) return;
  const set = () => header.classList.toggle('is-solid', window.scrollY > 24);
  set();
  addEventListener('scroll', set, { passive: true });
  // in-page links go through Lenis
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a) return;
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    emit('user-nav');
    scrollTo(el, { duration: 1.4 });
    history.replaceState(null, '', a.getAttribute('href'));
  });
};
