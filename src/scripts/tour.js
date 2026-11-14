// Auto-scroll tour. It drives the page through Lenis (so two scroll systems never fight), rests on each scene,
// lingers through the pinned ones, and stops the moment the visitor touches anything.
import { gsap, ScrollTrigger, env, lenis, $, $$, clamp, on, emit, scrollTo, maxScroll } from './core.js';

const FAST = 2.5;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // smooth in and out
// Steady through the middle with a soft start and stop (e = share of the time spent easing at each end).
const glide = (k, e = 0.12) => {
  const v = 1 / (1 - e);
  if (k < e) return (v * k * k) / (2 * e);
  if (k > 1 - e) return 1 - (v * (1 - k) * (1 - k)) / (2 * e);
  return v * (k - e / 2);
};

export function initTour() {
  const bar = $('[data-tourbar]');
  const sceneEls = $$('[data-scene]');
  if (!bar || !sceneEls.length) return null;
  const btn = $('[data-tour-toggle]'), label = $('[data-tour-label]'), icon = $('[data-tour-icon]');
  const status = $('[data-tour-status]'), progress = $('[data-tour-progress]'), count = $('[data-tour-count]');
  const list = $('[data-tour-list]'), listBtn = $('[data-tour-list-toggle]');
  const speedBtns = $$('[data-tour-speed]');
  const say = (text) => { if (status) status.textContent = text; };

  /* ---------- the plan: a list of segments {t0, t1, y0, y1, scene} at Normal pace ---------- */
  let segs = [], total = 0, starts = [];
  const plan = () => {
    segs = []; starts = [];
    let t = 0, y = 0;
    const max = maxScroll();
    sceneEls.forEach((el, i) => {
      const top = clamp(Math.round(el.getBoundingClientRect().top + window.scrollY), 0, max);
      const pin = el.querySelector(':scope > .pin');
      const pinned = !!pin && getComputedStyle(pin).position === 'sticky';
      const viewH = pinned ? pin.offsetHeight : innerHeight;
      const run = clamp(Math.round(el.offsetHeight - viewH), 0, max - top); // how far the scene itself scrolls
      // travel to the scene
      if (top !== y) { const d = clamp(Math.abs(top - y) / 900, 1.1, 2.4); segs.push({ t0: t, t1: t + d, y0: y, y1: top, scene: i, kind: 'travel' }); t += d; y = top; }
      starts[i] = t;
      // rest on it, or move through it
      const travel = Number(el.dataset.travel || 0), dwell = Number(el.dataset.dwell || 6);
      if (pinned && run > 0) { const d = travel || 12; segs.push({ t0: t, t1: t + d, y0: y, y1: y + run, scene: i, kind: 'through' }); t += d; y += run; }
      else {
        // a scene taller than the screen is read top to bottom during its dwell time
        const d = Math.max(dwell, run / 110);
        segs.push({ t0: t, t1: t + d, y0: y, y1: y + run, scene: i, kind: 'rest' }); t += d; y += run;
      }
    });
    total = t;
    window.__tour = { normalSeconds: Math.round(total), fastSeconds: Math.round(total / FAST), scenes: sceneEls.length };
  };
  const yAt = (t) => {
    const s = segs.find((g) => t < g.t1) || segs[segs.length - 1];
    if (!s) return 0;
    const k = clamp((t - s.t0) / (s.t1 - s.t0));
    return s.y0 + (s.y1 - s.y0) * (s.kind === 'travel' ? ease(k) : glide(k));
  };
  // Where in the plan does a scroll position belong? (used to resume after the visitor has moved)
  const tAt = (y) => {
    let best = 0, bd = Infinity;
    for (const s of segs) {
      const lo = Math.min(s.y0, s.y1), hi = Math.max(s.y0, s.y1);
      if (y >= lo - 1 && y <= hi + 1 && s.kind !== 'travel') return s.y1 === s.y0 ? s.t0 : s.t0 + ((y - s.y0) / (s.y1 - s.y0)) * (s.t1 - s.t0);
      const dd = Math.min(Math.abs(y - s.y0), Math.abs(y - s.y1));
      if (dd < bd) { bd = dd; best = Math.abs(y - s.y0) < Math.abs(y - s.y1) ? s.t0 : s.t1; }
    }
    return best;
  };

  /* ---------- state ---------- */
  const state = { playing: false, t: 0, rate: 1, ended: false, lastY: -1, gliding: false };
  const ui = () => {
    btn.setAttribute('aria-pressed', String(state.playing));
    label.textContent = state.playing ? 'Pause' : state.ended ? 'Replay' : state.t > 0.5 ? 'Resume' : 'Start tour';
    icon.className = state.playing ? 'fi-rr-pause' : state.ended ? 'fi-rr-rotate-right' : 'fi-rr-play';
    bar.classList.toggle('is-playing', state.playing);
    if (progress) progress.style.transform = `scaleX(${total ? clamp(state.t / total) : 0})`;
  };
  const tick = (time, dt) => {
    if (!state.playing || state.gliding) return;
    // Someone moved the page (scrollbar, keyboard, anything we did not catch): stop.
    if (state.lastY >= 0 && Math.abs(window.scrollY - state.lastY) > 8) return pause('Tour paused');
    state.t += (Math.min(dt, 100) / 1000) * state.rate;
    if (state.t >= total) { state.t = total; move(); state.playing = false; state.ended = true; ui(); say('Tour finished'); emit('tour', 'end'); return; }
    move();
    if (progress) progress.style.transform = `scaleX(${clamp(state.t / total)})`;
  };
  const move = () => { const y = Math.round(yAt(state.t)); scrollTo(y, { immediate: true }); state.lastY = y; };
  gsap.ticker.add(tick);

  const play = () => {
    if (env.reduced) return;
    plan();
    if (state.ended) { state.ended = false; state.t = 0; }
    else state.t = tAt(window.scrollY);
    state.lastY = -1; state.playing = true; ui();
    say(state.rate > 1 ? 'Tour playing, fast' : 'Tour playing'); emit('tour', 'play');
  };
  const pause = (msg = 'Tour paused') => { if (!state.playing) return; state.playing = false; ui(); say(msg); emit('tour', 'pause'); };
  const toggle = () => (state.playing ? pause() : play());
  const setSpeed = (fast) => {
    state.rate = fast ? FAST : 1;
    speedBtns.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.tourSpeed === 'fast') === fast)));
    say(fast ? 'Fast mode' : 'Normal pace');
  };
  // Jump to a scene. The tour keeps its play state.
  const jump = (index) => {
    plan();
    const i = clamp(index, 0, sceneEls.length - 1);
    const target = segs.find((s) => s.scene === i && s.kind !== 'travel');
    if (!target) return;
    state.ended = false; state.gliding = true; state.t = starts[i];
    scrollTo(target.y0, { duration: env.reduced ? 0 : 1.1, immediate: env.reduced });
    setTimeout(() => { state.gliding = false; state.lastY = -1; ui(); }, env.reduced ? 0 : 1200);
    closeList();
  };
  const current = () => { let c = 0; sceneEls.forEach((el, i) => { if (el.getBoundingClientRect().top <= innerHeight * 0.5) c = i; }); return c; };

  /* ---------- controls ---------- */
  btn.addEventListener('click', toggle);
  speedBtns.forEach((b) => b.addEventListener('click', () => setSpeed(b.dataset.tourSpeed === 'fast')));
  const closeList = () => { if (list && !list.hidden) { list.hidden = true; listBtn?.setAttribute('aria-expanded', 'false'); } };
  listBtn?.addEventListener('click', () => { list.hidden = !list.hidden; listBtn.setAttribute('aria-expanded', String(!list.hidden)); });
  $$('[data-tour-jump]').forEach((b) => b.addEventListener('click', () => jump(sceneEls.findIndex((el) => el.id === b.dataset.tourJump))));
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-tour-list], [data-tour-list-toggle]')) closeList(); });
  $$('[data-tour-start]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); if (!state.playing) play(); }));

  /* ---------- anything the visitor does pauses the tour; only a press on the button resumes it ---------- */
  const mine = (e) => e.target?.closest?.('[data-tourbar], [data-tour-list], [data-tour-start]');
  const stop = (e) => { if (state.playing && !mine(e)) pause(); };
  addEventListener('wheel', stop, { passive: true });
  addEventListener('touchstart', stop, { passive: true });
  addEventListener('pointerdown', stop, { passive: true });
  on('visibility', (visible) => { if (!visible) pause(); });
  on('user-nav', () => pause());
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) { stop(e); return; }
    if (e.key === 'Escape') { closeList(); return; }
    if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggle(); return; }
    if (env.defense) return; // presenter keys are handled in defense.js
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
    stop(e);
  });

  /* ---------- scene tracking: counter, dots, gradient, sound ---------- */
  const dotBtns = $$('.tourbar__dots [data-tour-jump]'), listBtns = $$('[data-tour-list] [data-tour-jump]');
  let active = -1;
  const setScene = (i) => {
    if (i === active) return;
    active = i;
    if (count) count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(sceneEls.length).padStart(2, '0')}`;
    dotBtns.forEach((b, k) => { b.classList.toggle('is-past', k < i); k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'); });
    listBtns.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    emit('scene', sceneEls[i].id);
  };
  sceneEls.forEach((el, i) => ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && setScene(i) }));
  setScene(current());
  ScrollTrigger.addEventListener('refresh', plan);
  plan(); ui();

  return { play, pause, toggle, jump, setSpeed, state, next: () => jump(current() + 1), prev: () => jump(current() - 1), get total() { return total; } };
}
