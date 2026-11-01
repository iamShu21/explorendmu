import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToHash = (hash) => {
  const el = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
  if (!el) return false;
  if (lenis) lenis.scrollTo(el, { offset: hash === '#top' ? 0 : -72, duration: 1.4 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  return true;
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  if (!a) return;
  const url = new URL(a.href, location.href);
  if (url.pathname !== location.pathname) return;
  if (scrollToHash(url.hash)) { e.preventDefault(); history.replaceState(null, '', url.hash); closeMenu(); }
});

/* ---------------- nav ---------------- */
const nav = $('[data-nav]');
const setNav = () => {
  const on = scrollY > 24;
  nav?.classList.toggle('bg-ink/75', on);
  nav?.classList.toggle('backdrop-blur-xl', on);
  nav?.classList.toggle('!border-white/10', on);
};
setNav();
addEventListener('scroll', setNav, { passive: true });

const menu = $('[data-menu]');
const toggle = $('[data-menu-toggle]');
function closeMenu() {
  if (!menu || menu.classList.contains('hidden')) return;
  menu.classList.add('hidden');
  toggle?.setAttribute('aria-expanded', 'false');
  const icon = $('[data-menu-icon]'); if (icon) icon.className = 'fi-rr-menu-burger';
}
toggle?.addEventListener('click', () => {
  const open = menu.classList.toggle('hidden') === false;
  toggle.setAttribute('aria-expanded', String(open));
  $('[data-menu-icon]').className = open ? 'fi-rr-cross' : 'fi-rr-menu-burger';
});

/* ---------------- intro ---------------- */
document.fonts.ready.then(() => {
  const h = $('[data-split]');
  if (h && !reduced) {
    const split = SplitText.create(h, { type: 'lines,words', mask: 'lines', linesClass: 'pb-[.08em]' });
    // words become inline-blocks, so a parent's gradient text no longer reaches them
    split.words.forEach((w) => { if (w.parentElement?.closest('.gold-text')) w.classList.add('gold-text'); });
    gsap.from(split.words, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.045, delay: 0.1 });
  }
  if (!reduced) {
    gsap.from('.hero-in', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.09, delay: 0.35 });
    if ($('.hero-phone')) gsap.from('.hero-phone', { y: 60, rotate: 4, opacity: 0, duration: 1.4, ease: 'expo.out', delay: 0.25 });
    if ($('.float-chip')) gsap.from('.float-chip', { scale: 0.8, opacity: 0, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.2, delay: 0.9 });
  }
});

/* ---------------- reveal on scroll ---------------- */
if (!reduced) {
  // Hide only what is below the first screen, so the page is complete at rest and without JS.
  gsap.set($$('.reveal').filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9), { opacity: 0, y: 28 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
}

/* ---------------- campus network: draw + pulses ---------------- */
function animateNetwork(svg, { scrub = false } = {}) {
  if (!svg) return;
  const walks = $$('[data-walk]', svg);
  const pulses = $$('[data-pulse]', svg);
  const places = $$('.net-place', svg);
  if (reduced) return;
  gsap.set(walks, { drawSVG: '0%' });
  gsap.set(places, { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' });
  const tl = gsap.timeline(scrub
    ? { scrollTrigger: { trigger: svg, start: 'top 80%', end: 'center 45%', scrub: 1 } }
    : { delay: 0.3 });
  tl.to(walks, { drawSVG: '100%', duration: 1.6, ease: 'power2.inOut', stagger: { each: 0.025, from: 'random' } })
    .to(places, { scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: { each: 0.02, from: 'random' } }, '-=0.9');

  // gold "walkers" travelling along random routes
  const pulseGroup = $('.net-pulse', svg);
  gsap.set(pulseGroup, { opacity: 1 });
  gsap.set(pulses, { drawSVG: '0% 0%' });
  const run = () => {
    const p = pulses[Math.floor(Math.random() * pulses.length)];
    const len = p.getTotalLength();
    const seg = Math.min(18, Math.max(6, 900 / Math.max(len, 1)));
    gsap.fromTo(p, { drawSVG: `0% ${seg}%`, opacity: 1 }, {
      drawSVG: `${100 - seg}% 100%`, duration: Math.min(4, Math.max(1.4, len / 120)), ease: 'none',
      onComplete: () => gsap.to(p, { opacity: 0, duration: 0.3, onComplete: () => gsap.set(p, { drawSVG: '0% 0%', opacity: 1 }) }),
    });
  };
  const start = () => { for (let i = 0; i < 3; i++) gsap.delayedCall(i * 0.6, run); };
  ScrollTrigger.create({
    trigger: svg, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive) { start(); svg._pulse = setInterval(run, 900); }
      else clearInterval(svg._pulse);
    },
  });
}
animateNetwork($('#hero-net'));
animateNetwork($('#map-net'), { scrub: true });

/* ---------------- count up ---------------- */
$$('[data-count]').forEach((el) => {
  const to = Number(el.dataset.count);
  const fmt = (v) => (el.dataset.fmt ? Math.round(v).toLocaleString('en-US') : String(Math.round(v)));
  if (reduced) return;
  const o = { v: 0 };
  el.textContent = fmt(0);
  gsap.to(o, { v: to, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => (el.textContent = fmt(o.v)) });
});

/* ---------------- features: pinned stage ---------------- */
const layers = $$('[data-stage-layer]');
let current = 0;
function showLayer(i) {
  if (i === current || !layers[i]) return;
  const prev = layers[current];
  const next = layers[i];
  const dir = i > current ? 1 : -1;
  current = i;
  gsap.killTweensOf([prev, next]);
  prev.setAttribute('aria-hidden', 'true');
  next.setAttribute('aria-hidden', 'false');
  if (reduced) { gsap.set(prev, { autoAlpha: 0 }); gsap.set(next, { autoAlpha: 1 }); }
  else {
    gsap.to(prev, { autoAlpha: 0, y: -40 * dir, scale: 0.94, rotate: -2 * dir, duration: 0.5, ease: 'power2.in' });
    gsap.fromTo(next, { autoAlpha: 0, y: 60 * dir, scale: 0.94, rotate: 3 * dir }, { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.9, ease: 'expo.out', delay: 0.15 });
  }
  playIn(next);
  $$('video', prev).forEach((v) => v.pause());
}
function playIn(scope) {
  $$('video[data-autoplay]', scope).forEach((v) => { v.preload = 'auto'; v.play().catch(() => {}); });
  const cues = $$('.voice-cue', scope);
  if (cues.length && !reduced) gsap.fromTo(cues, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out', stagger: 0.18, delay: 0.3 });
}
const mm = gsap.matchMedia();
mm.add('(min-width: 1024px)', () => {
  $$('.feature-step').forEach((step, i) => {
    ScrollTrigger.create({ trigger: step, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && showLayer(i) });
    if (!reduced) gsap.fromTo($('.feature-copy', step), { opacity: 0.25 }, { opacity: 1, scrollTrigger: { trigger: step, start: 'top 75%', end: 'top 45%', scrub: true } });
  });
});
// mobile + anything outside the stage: play videos when visible
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  const v = e.target;
  if (v.closest('[data-stage-layer]')) return;
  if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
}), { threshold: 0.35 });
$$('video[data-autoplay]').forEach((v) => io.observe(v));
$$('.feature-step [data-voice]').forEach((panel) => ScrollTrigger.create({ trigger: panel, start: 'top 80%', once: true, onEnter: () => playIn(panel) }));

/* ---------------- directory demo ---------------- */
$$('[data-directory]').forEach((root) => {
  const input = $('[data-dir-search]', root);
  const items = $$('[data-dir-list] > li', root);
  let cat = 'All';
  const apply = () => {
    const q = (input.value || '').trim().toLowerCase();
    items.forEach((li) => {
      const ok = (cat === 'All' || li.dataset.cat === cat) && (!q || li.dataset.name.includes(q));
      li.hidden = !ok;
    });
  };
  input.addEventListener('input', apply);
  $$('[data-dir-filter]', root).forEach((b) => b.addEventListener('click', () => {
    cat = b.dataset.dirFilter;
    $$('[data-dir-filter]', root).forEach((x) => {
      const on = x === b;
      x.setAttribute('aria-pressed', String(on));
      ['!bg-gold', '!text-ink', '!border-gold'].forEach((c) => x.classList.toggle(c, on));
    });
    apply();
  }));
});

/* ---------------- 3D models (lazy) ---------------- */
const host = $('[data-model-host]');
if (host) {
  const models = JSON.parse(host.dataset.models);
  let viewer = null;
  const load = async () => {
    await import('@google/model-viewer');
    const MV = customElements.get('model-viewer');
    MV.meshoptDecoderLocation = new URL('vendor/meshopt-ready.js', document.baseURI).href;
    viewer = document.createElement('model-viewer');
    Object.entries({
      src: models[0].src, alt: `3D model of ${models[0].name}`, 'camera-controls': '', 'auto-rotate': '', 'auto-rotate-delay': '0',
      'rotation-per-second': '18deg', 'interaction-prompt': 'auto', 'shadow-intensity': '1.1', 'shadow-softness': '0.9',
      exposure: '1.05', 'environment-image': 'neutral', 'camera-orbit': '25deg 78deg auto', 'field-of-view': '28deg',
      autoplay: '', ar: '', 'ar-modes': 'scene-viewer webxr quick-look', 'touch-action': 'pan-y',
    }).forEach(([k, v]) => viewer.setAttribute(k, v));
    viewer.style.cssText = 'width:100%;height:100%;background:transparent;--poster-color:transparent;--progress-bar-color:#ffc20e';
    const arBtn = document.createElement('button');
    arBtn.slot = 'ar-button';
    arBtn.className = 'btn btn-gold absolute right-4 top-4 !py-2.5 !text-sm';
    arBtn.innerHTML = '<i class="fi-rr-cube"></i>View in your space';
    viewer.appendChild(arBtn);
    viewer.addEventListener('load', () => $('[data-model-loading]', host)?.remove());
    host.appendChild(viewer);
  };
  ScrollTrigger.create({ trigger: host, start: 'top 140%', once: true, onEnter: load });
  $$('[data-model-tab]').forEach((tab) => tab.addEventListener('click', () => {
    const m = models.find((x) => x.id === tab.dataset.modelTab);
    $$('[data-model-tab]').forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      ['!bg-gold', '!text-ink', '!border-gold'].forEach((c) => t.classList.toggle(c, on));
    });
    $('[data-model-name]').textContent = m.name;
    if (viewer) { viewer.src = m.src; viewer.alt = `3D model of ${m.name}`; }
  }));
}

/* ---------------- tabs (code excerpts) ---------------- */
$$('[data-tabs]').forEach((root) => {
  const tabs = $$('[data-tab]', root);
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $$('[data-panel]', root).forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
    if (!reduced) gsap.from($(`[data-panel="${t.dataset.tab}"] code`, root), { opacity: 0, y: 8, duration: 0.4 });
  }));
});

/* ---------------- scrubbed lines ---------------- */
if (!reduced) {
  const fill = $('.timeline-fill');
  if (fill) gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '[data-timeline]', start: 'top 70%', end: 'bottom 70%', scrub: 0.6 } });
  $$('.timeline-item').forEach((it) => gsap.from(it, { opacity: 0.2, x: 16, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: it, start: 'top 80%' } }));
  $$('.pipe-fill').forEach((f) => gsap.to(f, { height: '100%', ease: 'none', scrollTrigger: { trigger: f.closest('li'), start: 'top 70%', end: 'bottom 60%', scrub: true } }));
  $$('[data-parallax]').forEach((img) => gsap.fromTo(img, { scale: 1.15, yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } }));
} else {
  $$('.timeline-fill').forEach((f) => (f.style.transform = 'scaleY(1)'));
}

/* ---------------- pointer niceties ---------------- */
if (finePointer && !reduced) {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.card-glow');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  $$('.magnetic').forEach((b) => {
    const xTo = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'elastic.out(1, .4)' });
    const yTo = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'elastic.out(1, .4)' });
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.25); yTo((e.clientY - r.top - r.height / 2) * 0.35); });
    b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });

  const tilt = $('[data-tilt]');
  if (tilt) {
    const phone = $('.hero-phone', tilt);
    const rx = gsap.quickTo(phone, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(phone, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    gsap.set(tilt, { perspective: 1000 });
    addEventListener('pointermove', (e) => { ry((e.clientX / innerWidth - 0.5) * 14); rx(-(e.clientY / innerHeight - 0.5) * 10); }, { passive: true });
  }
}

/* ---------------- research page ---------------- */
const dlg = $('[data-lightbox-dialog]');
if (dlg) {
  const img = $('[data-lightbox-img]', dlg);
  $$('[data-lightbox]').forEach((b) => b.addEventListener('click', () => { img.src = b.dataset.lightbox; img.alt = b.dataset.lightboxAlt; dlg.showModal(); lenis?.stop(); }));
  dlg.addEventListener('close', () => lenis?.start());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}
$('[data-copy-cite]')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try { await navigator.clipboard.writeText($('[data-cite]').textContent.trim()); btn.querySelector('span').textContent = 'Copied'; }
  catch { btn.querySelector('span').textContent = 'Select and copy the text above'; }
  setTimeout(() => (btn.querySelector('span').textContent = 'Copy citation'), 2200);
});

/* refresh after images/fonts settle */
addEventListener('load', () => ScrollTrigger.refresh());
if (location.hash) setTimeout(() => scrollToHash(location.hash), 300);
