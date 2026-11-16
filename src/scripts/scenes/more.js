// The later scenes: places gallery, built from real walks, the film, and the arrival at the end of the route.
import { gsap, ScrollTrigger, env, $, $$, on, onVisibleOnce, EASE } from '../core.js';

/* ---------------------------------------------------------------- 10 places on campus */
export function initPlaces() {
  const section = $('#places');
  if (!section || env.reduced) return;
  const track = $('[data-places-track]', section), viewport = $('[data-places-viewport]', section), pin = $('.pin', section);
  const mm = gsap.matchMedia();
  // Wide screens: the scroll moves the row sideways while the scene is pinned.
  mm.add('(min-width: 60rem)', () => {
    const tween = gsap.to(track, {
      x: () => -Math.max(0, track.scrollWidth - viewport.clientWidth), ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); gsap.set(track, { clearProps: 'transform' }); };
  });
}

/* ---------------------------------------------------------------- 11 built from real walks */
export function initWalks() {
  const section = $('#walks');
  if (!section) return;
  const lines = $$('[data-walks-line]', section), nums = $$('[data-count]', section);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  if (env.reduced) return;
  gsap.set(lines, { strokeDashoffset: 1 });
  nums.forEach((n) => (n.textContent = '0'));
  onVisibleOnce($('[data-walks-map]', section), () => {
    gsap.to(lines, { strokeDashoffset: 0, duration: 1.6, ease: EASE.inOut, stagger: { each: 0.035, from: 'random' } });
    gsap.fromTo($$('[data-walks-dot]', section), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.02, delay: 1.2 });
  }, '0px 0px -20% 0px');
  nums.forEach((n) => onVisibleOnce(n, () => {
    const o = { v: 0 };
    gsap.to(o, { v: Number(n.dataset.count), duration: 1.8, ease: 'power2.out', onUpdate: () => (n.textContent = fmt(o.v)) });
  }));
  // safety: never leave a counter on zero
  setTimeout(() => nums.forEach((n) => { if (n.textContent === '0' && n.getBoundingClientRect().top < innerHeight) n.textContent = fmt(Number(n.dataset.count)); }), 6000);
}

/* ---------------------------------------------------------------- 12 watch the film */
export function initFilm() {
  const box = $('[data-film]');
  if (!box) return;
  const btn = $('[data-film-play]', box), video = $('video', box);
  btn.addEventListener('click', () => {
    // nothing of the film is downloaded before this tap
    video.src = video.dataset.src;
    video.controls = true;
    box.classList.add('is-playing');
    video.play().catch(() => {});
    video.focus();
  });
  video.addEventListener('error', () => { if (video.src) box.classList.add('is-broken'); });
  on('visibility', (v) => { if (!v && !video.paused) video.pause(); });
}

/* ---------------------------------------------------------------- 15 live APK download count */
// The real total from GitHub Releases: every ExploreNDMU.apk across all releases.
// Shown only when GitHub answers with a number above zero; otherwise the line stays hidden.
export function initApkCount() {
  const el = $('[data-apk-count]');
  if (!el) return;
  const KEY = 'ndmu-apk-count', TTL = 10 * 60 * 1000;
  const render = (n) => { if (!(n > 0)) return; el.textContent = `Downloaded ${n.toLocaleString('en-US')} ${n === 1 ? 'time' : 'times'}`; el.hidden = false; };
  const load = async () => {
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < TTL) return render(c.n); } catch {}
    try {
      const res = await fetch(el.dataset.apkCount, { headers: { accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      const releases = await res.json();
      const n = releases.flatMap((r) => r.assets || []).filter((a) => a.name === 'ExploreNDMU.apk').reduce((s, a) => s + (a.download_count || 0), 0);
      try { localStorage.setItem(KEY, JSON.stringify({ n, t: Date.now() })); } catch {}
      render(n);
    } catch {}
  };
  onVisibleOnce(el.closest('[data-scene]') || el, load, '0px 0px 50% 0px');
}

/* ---------------------------------------------------------------- 15 you have arrived */
export function initArrival() {
  const card = $('[data-arrival]');
  if (!card || env.reduced) return;
  gsap.set(card, { opacity: 0, y: 40, scale: 0.94 });
  let shown = false;
  const show = () => { if (shown) return; shown = true; gsap.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'back.out(1.4)' }); gsap.from($$('[data-arrival-part]', card), { opacity: 0, y: 12, duration: 0.6, ease: EASE.out, stagger: 0.08, delay: 0.25 }); };
  // The card pops up when the chevron reaches the end of the route...
  on('arrived', (done) => done && show());
  // ...and in any case once it is well inside the screen.
  onVisibleOnce(card, show, '0px 0px -35% 0px');
  setTimeout(() => { if (card.getBoundingClientRect().top < innerHeight) show(); }, 3000);
}
