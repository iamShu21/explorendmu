// The four pinned story scenes: follow the arrows, scroll to walk, hear every turn, arrive and learn.
// Each one is a timeline scrubbed by the scroll, with a clear start, middle and end.
import { gsap, ScrollTrigger, env, perf, $, $$, on, onNear, onVisible, clamp, lerp, EASE } from '../core.js';
import net from '../../data/campus-network.json';
import routes from '../../data/routes.gen.json';

const pinned = (el) => { const p = el?.querySelector(':scope > .pin'); return !!p && getComputedStyle(p).position === 'sticky'; };
const scrub = (section, onUpdate, extra = {}) => ScrollTrigger.create({ trigger: section, start: 'top top', end: 'bottom bottom', onUpdate: (self) => onUpdate(self.progress, self), ...extra });

/* ---------------------------------------------------------------- 03 follow the arrows */
// Where the tablet's screen sits inside the camera frame at the matched moment (fractions of the frame).
const TABLET = { x: 0.333, y: 0.463, w: 0.26, h: 0.74, tilt: 5 };
export function initFollow() {
  const section = $('#follow');
  if (!section || env.reduced || !pinned(section)) return;
  const cam = $('[data-follow-cam]', section), wipe = $('[data-follow-wipe]', section), wipeIn = $('.wipe__in', wipe);
  const device = $('.follow__device .device', section), screen = $('.device__screen', device);
  const match = $('[data-follow-match]', cam);
  const camVideo = $('video', cam), screenVideo = $('video', wipe), steps = $$('[data-follow-step]', section);
  let fit = { x: 0, y: 0, s: 1 };
  const measure = () => {
    gsap.set([cam, device], { clearProps: 'transform' });
    const c = cam.getBoundingClientRect(), d = screen.getBoundingClientRect();
    const cx = c.left + (TABLET.x + TABLET.w / 2) * c.width, cy = c.top + (TABLET.y + TABLET.h / 2) * c.height;
    fit = { x: d.left + d.width / 2 - cx, y: d.top + d.height / 2 - cy, s: d.width / (TABLET.w * c.width) };
    gsap.set(cam, { transformOrigin: `${(TABLET.x + TABLET.w / 2) * 100}% ${(TABLET.y + TABLET.h / 2) * 100}%` });
  };
  const tl = gsap.timeline({ paused: true, defaults: { ease: EASE.none } });
  const build = () => {
    measure();
    tl.clear();
    // 1. push in on the tablet in the walker's hands
    tl.fromTo(match, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.07)
      .fromTo(cam, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, { x: fit.x, y: fit.y, scale: fit.s, rotation: TABLET.tilt, duration: 0.42, ease: 'power2.inOut' }, 0.12)
      // 2. the real device appears around it and the screen recording wipes in
      .fromTo(device, { opacity: 0, scale: 0.94, rotationY: -10, rotationX: 0 }, { opacity: 1, scale: 1, duration: 0.16, ease: 'power1.out' }, 0.4)
      .fromTo(wipe, { xPercent: -101 }, { xPercent: 0, duration: 0.22 }, 0.46)
      .fromTo(wipeIn, { xPercent: 101 }, { xPercent: 0, duration: 0.22 }, 0.46)
      .to(cam, { opacity: 0, duration: 0.14 }, 0.54)
      // 3. settle
      .to(device, { rotationY: 7, rotationX: 2, duration: 0.3, ease: 'power1.inOut' }, 0.68)
      .to({}, { duration: 0.02 }, 0.98);
  };
  build();
  ScrollTrigger.addEventListener('refreshInit', () => { const p = tl.progress(); tl.progress(0); build(); tl.progress(p); });
  let phase = 0;
  scrub(section, (p) => {
    tl.progress(p);
    const now = p > 0.62 ? 1 : 0;
    steps.forEach((s, i) => s.classList.toggle('is-on', i === now));
    if (now !== phase) {
      phase = now;
      screenVideo.dataset.hold = now ? '' : '1';
      if (now) screenVideo.play().catch(() => {}); else { screenVideo.pause(); try { screenVideo.currentTime = 0; } catch {} }
    }
  });
}

/* ---------------------------------------------------------------- 04 scroll to walk */
// Metres still to go, read off the app's own HUD ("About N m to go") in every fourth frame of the recording.
// Frame k was recorded 2k seconds into the walk. The counter shows the route length minus this.
const LEFT = [[0, 192], [4, 185], [8, 178], [12, 171], [16, 162], [20, 153], [24, 145], [28, 140], [32, 133], [36, 125], [40, 118], [44, 109], [48, 102], [52, 98],
  [56, 93], [60, 86], [64, 78], [68, 71], [72, 63], [76, 55], [80, 47], [84, 38], [88, 29], [92, 22], [96, 14], [100, 8], [103, 0]];
const FRAMES = 104;
const leftAt = (f) => { for (let i = 1; i < LEFT.length; i++) if (f <= LEFT[i][0]) { const [a, la] = LEFT[i - 1], [b, lb] = LEFT[i]; return lerp(la, lb, (f - a) / (b - a)); } return 0; };

export function initWalk() {
  const section = $('#walk');
  if (!section) return;
  const total = routes.walk.recordedMetres;
  const numEl = $('[data-walk-metres]', section), leftEl = $('[data-walk-left]', section), bar = $('[data-walk-bar]', section);
  const line = $('[data-walk-line]', section), dot = $('[data-walk-dot]', section);
  const frameCanvas = $('[data-walk-frames]', section), ctx = frameCanvas?.getContext('2d');
  if (env.reduced || !pinned(section)) { if (numEl) numEl.textContent = String(total); if (leftEl) leftEl.textContent = 'You have arrived.'; return; }

  /* frames of the real recording, drawn to a canvas so scrubbing is smooth on iOS too */
  const imgs = new Array(FRAMES);
  let want = 0, shown = -1;
  const ready = (k) => imgs[k]?.complete && imgs[k].naturalWidth > 0;
  const draw = () => {
    // the wanted frame, or the nearest one that has arrived
    let f = -1;
    for (let d = 0; d < FRAMES; d++) {
      if (want - d >= 0 && ready(want - d)) { f = want - d; break; }
      if (want + d < FRAMES && ready(want + d)) { f = want + d; break; }
    }
    if (f < 0 || f === shown) return;
    shown = f; ctx.drawImage(imgs[f], 0, 0, frameCanvas.width, frameCanvas.height);
  };
  const loadFrames = () => {
    // every 4th first, so there is something to show across the whole walk quickly
    const order = [...Array(FRAMES).keys()].sort((a, b) => (a % 4 === 0 ? 0 : 1) - (b % 4 === 0 ? 0 : 1) || a - b);
    let i = 0;
    const next = () => { if (i >= order.length) return; const k = order[i++]; const im = new Image(); im.decoding = 'async'; im.onload = im.onerror = () => { draw(); next(); }; im.src = `seq/walk/${String(k + 1).padStart(3, '0')}.webp`; imgs[k] = im; };
    for (let n = 0; n < 6; n++) next();
  };
  onNear(section, loadFrames, '150% 0px');

  /* the 3D campus: only where it runs well; otherwise the flat route drawing takes its place */
  let campus = null, visible = false, running = false;
  const loop = () => campus?.render();
  const start = () => { if (campus && visible && !running && !document.hidden) { running = true; gsap.ticker.add(loop); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(loop); } };
  const canvas = $('[data-walk-canvas]', section);
  const boot = async () => {
    if (!env.webgl || env.weak || perf.slow || campus) return;
    const { createCampus } = await import('../three/campus.js');
    try { campus = createCampus(canvas, { net, mode: 'walk', route: routes.walk.pts, phone: env.phone, shadows: !env.touch, dpr: env.dpr }); } catch { return; }
    campus.setProgress(state.metres / total); campus.render();
    section.classList.add('is-live'); start();
    canvas.addEventListener('campus-lost', () => { stop(); section.classList.remove('is-live'); });
  };
  onNear(section, boot, '120% 0px');
  onVisible(section, () => { visible = true; start(); }, () => { visible = false; stop(); });
  on('visibility', (v) => (v ? start() : stop()));
  on('slow', () => { stop(); section.classList.remove('is-live'); campus?.dispose(); campus = null; });

  /* flat fallback: position of the dot along the route by distance */
  const pts = routes.walk.pts, cum = routes.walk.cum, end = cum[cum.length - 1];
  const pointAt = (m) => { const mm = clamp(m / total) * end; for (let i = 1; i < cum.length; i++) if (mm <= cum[i]) { const t = (mm - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]; } return pts[pts.length - 1]; };

  const state = { metres: 0 };
  let lastText = -1;
  scrub(section, (p) => {
    // start: a beat at the gate. end: a beat at the Library.
    const k = clamp((p - 0.06) / 0.86);
    const f = k * (FRAMES - 1);
    want = Math.round(f); draw();
    const walked = total - leftAt(f);
    state.metres = walked;
    campus?.setProgress(walked / total);
    const shownM = Math.round(walked);
    if (shownM !== lastText) {
      lastText = shownM;
      numEl.textContent = String(shownM);
      leftEl.textContent = shownM >= total ? 'You have arrived.' : `About ${total - shownM} m to go.`;
    }
    bar.style.transform = `scaleX(${walked / total})`;
    if (line) line.style.strokeDashoffset = String(1 - walked / total);
    if (dot) { const [x, y] = pointAt(walked); dot.setAttribute('cx', x); dot.setAttribute('cy', y); }
  });
}

/* ---------------------------------------------------------------- 05 hear every turn */
export function initHear({ sound }) {
  const section = $('#hear');
  if (!section || env.reduced || !pinned(section)) return;
  const lines = $$('[data-hear-line]', section), clips = $$('.hear__clip', section), device = $('.device', section);
  // where in each clip the HUD changes to the spoken line (seconds)
  const CUE = { left: 7.6, right: 6.4 };
  let active = -1;
  const set = (i, speak) => {
    if (i === active) return;
    active = i;
    lines.forEach((l, k) => l.classList.toggle('is-on', k === i));
    const useRight = i === 2;
    clips.forEach((c, k) => { const on = (k === 1) === useRight; c.classList.toggle('is-on', on); c.dataset.hold = on ? '' : '1'; if (on) c.play().catch(() => {}); else c.pause(); });
    const clip = clips[useRight ? 1 : 0];
    try { if (i === 0) clip.currentTime = 0; if (i === 1) clip.currentTime = CUE.left; if (i === 2) clip.currentTime = CUE.right; } catch {}
    if (speak) sound?.say(lines[i].dataset.hearLine);
  };
  gsap.set(device, { rotationY: 9, rotationX: 2 });
  scrub(section, (p, self) => {
    // a line is spoken only when the visitor scrolls down into it
    set(p < 0.3 ? 0 : p < 0.64 ? 1 : 2, self.isActive && self.direction > 0);
    gsap.set(device, { rotationY: lerp(9, -7, p), rotationX: 2 });
  }, { onLeave: () => { active = -1; }, onLeaveBack: () => { active = -1; } });
}

/* ---------------------------------------------------------------- 06 arrive and learn */
export function initArrive({ sound }) {
  const section = $('#arrive');
  if (!section || env.reduced || !pinned(section)) return;
  const card = $('[data-arrive-card]', section), parts = $$('[data-arrive-part]', section), device = $('.device', section);
  const mobile = () => innerWidth < 960;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  tl.fromTo(device, { rotationY: -8, rotationX: 2 }, { rotationY: 6, duration: 1, ease: 'none' }, 0)
    .fromTo(card, { opacity: 0, y: () => (mobile() ? 90 : 60), scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.2 }, 0.3)
    .fromTo(parts, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.12, stagger: 0.09 }, 0.36)
    .to({}, { duration: 0.1 }, 0.9);
  let spoke = false;
  scrub(section, (p, self) => {
    tl.progress(p);
    if (p > 0.08 && p < 0.9 && !spoke && self.direction > 0) { spoke = true; sound?.say('arrive'); }
    if (p < 0.02) spoke = false;
  });
}
