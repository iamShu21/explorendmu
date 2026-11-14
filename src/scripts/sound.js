// Optional sound: the app's own pre-generated voice lines ("Turn left now.", "You have arrived...").
// Off by default. Nothing is fetched and nothing plays until the visitor presses the Sound button.
import { $, on, emit } from './core.js';

const CLIPS = {
  follow: 'audio/follow-the-arrows.mp3',
  left: 'audio/turn-left-now.mp3',
  right: 'audio/turn-right-now.mp3',
  arrive: 'audio/arrive-university-library.mp3',
};

export function initSound() {
  const btn = $('[data-sound]');
  const state = { on: false, ctx: null, buffers: {}, source: null };
  const ui = () => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(state.on));
    const label = $('[data-sound-label]', btn), icon = $('[data-sound-icon]', btn);
    if (label) label.textContent = state.on ? 'Sound on' : 'Sound off';
    if (icon) icon.className = state.on ? 'fi-rr-volume' : 'fi-rr-volume-slash';
    document.documentElement.classList.toggle('sound-on', state.on);
  };
  const stop = () => { try { state.source?.stop(); } catch {} state.source = null; };
  const load = async (name) => {
    if (state.buffers[name]) return state.buffers[name];
    const data = await (await fetch(CLIPS[name])).arrayBuffer();
    // Safari needs the callback form of decodeAudioData
    state.buffers[name] = await new Promise((res, rej) => state.ctx.decodeAudioData(data, res, rej));
    return state.buffers[name];
  };
  const say = async (name) => {
    if (!state.on || !state.ctx || document.hidden || !CLIPS[name]) return;
    try {
      const buffer = await load(name);
      if (!state.on) return;
      stop();
      const src = state.ctx.createBufferSource();
      src.buffer = buffer; src.connect(state.ctx.destination); src.start();
      state.source = src;
    } catch {}
  };
  const enable = async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    state.ctx ||= new AC();
    try { await state.ctx.resume(); } catch {}
    state.on = true; ui(); emit('sound', true);
    Object.keys(CLIPS).forEach((n) => load(n).catch(() => {}));
  };
  const disable = () => { state.on = false; stop(); ui(); emit('sound', false); };
  btn?.addEventListener('click', () => (state.on ? disable() : enable()));
  $$all('[data-sound-on]').forEach((b) => b.addEventListener('click', () => { if (!state.on) enable(); }));
  on('visibility', (v) => { if (!v) stop(); });
  ui();
  return { say, stop, get on() { return state.on; } };
}
const $$all = (s) => Array.from(document.querySelectorAll(s));
