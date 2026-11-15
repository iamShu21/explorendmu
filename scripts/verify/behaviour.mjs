// Behaviour checks on the built site (start scripts/verify/serve.mjs first):
// the auto-scroll tour, defense mode, the sound toggle, reduced motion, WebGL off, and text contrast over the gradient.
//   node scripts/verify/behaviour.mjs
import { chromium, devices } from 'playwright';

const base = process.env.SITE ?? 'http://localhost:4173/explorendmu/';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  (' + detail + ')' : ''}`); };
const open = async (query = '', context = { viewport: { width: 1440, height: 900 } }, lazy = false) => {
  const ctx = await browser.newContext(context);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?nointro${lazy ? '' : '&eager'}${query}`, { waitUntil: 'load' });
  if (!lazy) await page.waitForFunction(() => window.__site?.ready, null, { timeout: 20000 });
  await page.waitForTimeout(lazy ? 1500 : 400);
  return { ctx, page, errors };
};
const y = (page) => page.evaluate(() => Math.round(window.scrollY));
const state = (page) => page.evaluate(() => ({ ...window.__site.tour.state, total: window.__site.tour.total }));

/* ---------- tour ---------- */
{
  const { ctx, page, errors } = await open();
  const t = await page.evaluate(() => window.__tour);
  console.log(`     tour length: Normal ${Math.floor(t.normalSeconds / 60)} min ${t.normalSeconds % 60} s, Fast ${Math.floor(t.fastSeconds / 60)} min ${t.fastSeconds % 60} s, ${t.scenes} scenes`);
  check('tour is idle until Start is pressed', !(await state(page)).playing && (await y(page)) === 0);
  await page.click('[data-tour-toggle]');
  await page.waitForTimeout(7000);
  const y1 = await y(page);
  check('Start plays and the page moves', (await state(page)).playing && y1 > 200, `scrolled to ${y1}`);
  check('button says Pause and is pressed', (await page.getAttribute('[data-tour-toggle]', 'aria-pressed')) === 'true' && /Pause/.test(await page.textContent('[data-tour-label]')));
  // speed: compare tour time advanced over the same wall time
  const a = (await state(page)).t; await page.waitForTimeout(2000); const normalRate = ((await state(page)).t - a) / 2;
  await page.click('[data-tour-speed="fast"]');
  const b = (await state(page)).t; await page.waitForTimeout(2000); const fastRate = ((await state(page)).t - b) / 2;
  check('Fast is about 2.5 times Normal', Math.abs(fastRate / normalRate - 2.5) < 0.35, `ratio ${(fastRate / normalRate).toFixed(2)}`);
  check('status announces Fast mode', /Fast/.test(await page.textContent('[data-tour-status]')));
  // any wheel pauses it
  await page.mouse.move(700, 400); await page.mouse.wheel(0, 120); await page.waitForTimeout(500);
  check('wheel pauses the tour', !(await state(page)).playing && /paused/i.test(await page.textContent('[data-tour-status]')));
  const yp = await y(page); await page.waitForTimeout(1500);
  check('it stays paused', Math.abs((await y(page)) - yp) < 40);
  await page.keyboard.press('p'); await page.waitForTimeout(1200);
  check('P resumes', (await state(page)).playing);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);
  check('another key pauses', !(await state(page)).playing);
  // jump with a scene dot, then finish and replay
  await page.click('.tourbar__dots li:nth-child(12) button'); await page.waitForTimeout(1800);
  check('scene dot jumps to that scene', /12 \/ 15/.test(await page.textContent('[data-tour-count]')), await page.textContent('[data-tour-count]'));
  await page.evaluate(() => { const t = window.__site.tour; t.state.t = t.total - 3; t.state.lastY = -1; t.state.playing = true; });
  await page.waitForTimeout(3500);
  check('at the end the button offers Replay', /Replay/.test(await page.textContent('[data-tour-label]')) && !(await state(page)).playing);
  await page.click('[data-tour-toggle]'); await page.waitForTimeout(2500);
  check('Replay starts again from the top', (await state(page)).playing && (await y(page)) < 1500, `y ${await y(page)}`);
  // hidden tab
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  check('hiding the tab pauses', !(await state(page)).playing);
  check('no console errors during the tour', errors.length === 0, errors[0]?.slice(0, 120));
  await ctx.close();
}
{ // touch
  const { ctx, page } = await open('', devices['Pixel 7']);
  await page.tap('[data-tour-toggle]'); await page.waitForTimeout(2500);
  const playing = (await state(page)).playing;
  await page.touchscreen.tap(200, 300); await page.waitForTimeout(400);
  check('on a phone: Start plays, a touch pauses', playing && !(await state(page)).playing);
  const box = await page.locator('[data-tourbar]').boundingBox();
  const sizes = await page.$$eval('[data-tourbar] button', (bs) => bs.filter((b) => b.offsetParent).map((b) => Math.round(Math.min(b.getBoundingClientRect().height, 99))));
  check('tour buttons are at least 39 px tall on a phone', sizes.every((h) => h >= 39), `heights ${sizes.join(',')}; bar ${Math.round(box.width)}x${Math.round(box.height)}`);
  await ctx.close();
}
{ // the page sets itself up on the first interaction; the press that wakes it must still count
  const { ctx, page } = await open('', { viewport: { width: 1440, height: 900 } }, true);
  const before = await page.evaluate(() => window.__site.ready);
  await page.click('[data-tour-toggle]'); await page.waitForTimeout(2500);
  check('lazy start: idle until touched, and the first press on Start tour plays', before === false && (await state(page)).playing);
  await ctx.close();
}
{ // ?tour=1
  const { ctx, page } = await open('&tour=1');
  await page.waitForTimeout(2500);
  check('?tour=1 starts the tour by itself', (await state(page)).playing);
  await ctx.close();
}

/* ---------- defense mode ---------- */
{
  const { ctx, page, errors } = await open('&defense=1');
  check('defense: large type and no cursor', await page.evaluate(() => document.documentElement.classList.contains('defense') && parseFloat(getComputedStyle(document.documentElement).fontSize) > 17 && getComputedStyle(document.body).cursor === 'none'));
  check('defense: QR card is shown', await page.locator('.hero__qr').isVisible());
  check('defense: tour waits for a key', !(await state(page)).playing);
  await page.keyboard.press('PageDown'); await page.waitForTimeout(1200);
  check('defense: first key starts the tour', (await state(page)).playing);
  const c0 = await page.textContent('[data-tour-count]');
  await page.keyboard.press('PageDown'); await page.waitForTimeout(1800);
  const c1 = await page.textContent('[data-tour-count]');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1800);
  const c2 = await page.textContent('[data-tour-count]');
  await page.keyboard.press('PageUp'); await page.waitForTimeout(1800);
  const c3 = await page.textContent('[data-tour-count]');
  check('defense: PageDown / arrows / PageUp step scene by scene', c1 !== c0 && c2 !== c1 && c3 === c1, `${c0} > ${c1} > ${c2} > ${c3}`);
  await page.keyboard.press('b'); await page.waitForTimeout(200);
  const blank = await page.locator('[data-blank]').isVisible();
  await page.keyboard.press('b'); await page.waitForTimeout(200);
  check('defense: B blanks and restores the screen', blank && !(await page.locator('[data-blank]').isVisible()));
  await page.keyboard.press('f'); await page.waitForTimeout(600);
  const fs = await page.evaluate(() => !!document.fullscreenElement);
  await page.keyboard.press('f'); await page.waitForTimeout(400);
  check('defense: F toggles fullscreen', fs && !(await page.evaluate(() => !!document.fullscreenElement)));
  check('defense: no console errors', errors.length === 0, errors[0]?.slice(0, 120));
  await ctx.close();
}

/* ---------- sound ---------- */
{
  const { ctx, page, errors } = await open();
  const requested = [];
  page.on('request', (r) => { if (/\.mp3/.test(r.url())) requested.push(r.url()); });
  await page.evaluate(() => document.getElementById('hear').scrollIntoView()); await page.waitForTimeout(1500);
  check('sound is off by default and no audio was fetched', (await page.getAttribute('[data-sound]', 'aria-pressed')) === 'false' && requested.length === 0);
  await page.click('[data-sound]'); await page.waitForTimeout(2000);
  check('pressing Sound turns it on and loads the 4 voice lines', (await page.getAttribute('[data-sound]', 'aria-pressed')) === 'true' && requested.length === 4 && /Sound on/.test(await page.textContent('[data-sound-label]')), `${requested.length} files`);
  check('audio context is running', await page.evaluate(() => window.__site.sound.on));
  await page.click('[data-sound]');
  check('pressing again turns it off', (await page.getAttribute('[data-sound]', 'aria-pressed')) === 'false');
  check('sound: no console errors', errors.length === 0, errors[0]?.slice(0, 120));
  await ctx.close();
}

/* ---------- reduced motion ---------- */
{
  const { ctx, page, errors } = await open('', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const r = await page.evaluate(() => ({
    cls: document.documentElement.classList.contains('reduced'),
    lenis: document.documentElement.classList.contains('lenis'),
    pinned: getComputedStyle(document.querySelector('#walk .pin')).position,
    startHidden: getComputedStyle(document.querySelector('[data-tour-toggle]')).display === 'none',
    hidden: [...document.querySelectorAll('.rv, [data-split]')].filter((el) => +getComputedStyle(el).opacity < 0.9).length,
    autoplay: [...document.querySelectorAll('video')].filter((v) => !v.paused).length,
  }));
  check('reduced motion: no smooth scroll, no pinned scenes, no Start button', r.cls && !r.lenis && r.pinned !== 'sticky' && r.startHidden, JSON.stringify(r));
  check('reduced motion: nothing hidden, no video autoplays', r.hidden === 0 && r.autoplay === 0);
  const before = await page.evaluate(() => window.__site.gradient.state.t); await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ t: window.__site.gradient.state.t, live: window.__site.gradient.live }));
  check('reduced motion: the gradient is still', before === after.t && !after.live);
  check('reduced motion: no console errors', errors.length === 0, errors[0]?.slice(0, 120));
  await ctx.close();
}

/* ---------- WebGL off ---------- */
{
  const { ctx, page, errors } = await open('&nowebgl');
  await page.evaluate(() => document.getElementById('walk').scrollIntoView()); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({
    cls: document.documentElement.classList.contains('no-webgl'),
    still: document.querySelector('[data-gradient]').classList.contains('is-still'),
    heroLive: document.querySelector('[data-hero-art]').classList.contains('is-live'),
    poster: document.querySelector('.hero__poster').naturalWidth > 0,
    map: getComputedStyle(document.querySelector('.walk__map')).display !== 'none',
  }));
  check('no WebGL: still gradient, hero still, flat route drawing', r.cls && r.still && !r.heroLive && r.poster && r.map, JSON.stringify(r));
  check('no WebGL: no console errors', errors.length === 0, errors[0]?.slice(0, 120));
  await ctx.close();
}

/* ---------- contrast of text over the gradient, at its lightest and darkest, morning to night ---------- */
{
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const ink = lum([6, 48, 29]), forest = lum([10, 90, 49]), mute = lum([63, 91, 76]), goldDeep = lum([138, 90, 0]);
  let worst = { forest: 99, mute: 99, gold: 99, ink: 99 };
  for (const hour of [7, 13, 16.5, 20, 2]) {
    const { ctx, page } = await open(`&hour=${hour}`, { viewport: { width: 900, height: 700 } });
    // sample the whole canvas across every scene look and several moments of the drift
    const range = await page.evaluate(async () => {
      const g = window.__site.gradient; if (!g || !(await g.boot())) return null;
      const gl = g.gl, w = g.canvas.width, h = g.canvas.height, px = new Uint8Array(w * h * 4);
      let lo = [255, 255, 255], hi = [0, 0, 0], loL = 999, hiL = -1;
      const L = (r, gg, b) => 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      const looks = [[1, 1], [0.55, 1.25], [1.15, 0.6], [1.25, 0.8], [0.6, 1.3], [1.3, 0.7], [0.5, 0.9]];
      for (const [gg, m] of looks) for (let k = 0; k < 6; k++) {
        Object.assign(g.state, { g: gg, m, x: k * 0.7 - 1, y: k * 0.9, z: 0.9 + (k % 3) * 0.2, t: 10 + k * 7.3, bloom: 1 });
        g.draw(); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let i = 0; i < px.length; i += 16) { const l = L(px[i], px[i + 1], px[i + 2]); if (l < loL) { loL = l; lo = [px[i], px[i + 1], px[i + 2]]; } if (l > hiL) { hiL = l; hi = [px[i], px[i + 1], px[i + 2]]; } }
      }
      return { lo, hi };
    });
    if (!range) { check(`contrast at ${hour}h`, false, 'gradient not running'); await ctx.close(); continue; }
    const c = { forest: Math.min(ratio(lum(range.lo), forest), ratio(lum(range.hi), forest)), mute: Math.min(ratio(lum(range.lo), mute), ratio(lum(range.hi), mute)), gold: Math.min(ratio(lum(range.lo), goldDeep), ratio(lum(range.hi), goldDeep)), ink: Math.min(ratio(lum(range.lo), ink), ratio(lum(range.hi), ink)) };
    for (const k of Object.keys(worst)) worst[k] = Math.min(worst[k], c[k]);
    console.log(`     ${String(hour).padStart(4)}h  darkest rgb(${range.lo}) lightest rgb(${range.hi})  body ${c.ink.toFixed(1)}  headline ${c.forest.toFixed(1)}  secondary ${c.mute.toFixed(1)}  gold text ${c.gold.toFixed(1)}`);
    await ctx.close();
  }
  check('body text is at least 4.5:1 over the gradient at every hour', worst.ink >= 4.5 && worst.mute >= 4.5, `body ${worst.ink.toFixed(2)}, secondary ${worst.mute.toFixed(2)}`);
  check('headlines and gold text are at least 4.5:1', worst.forest >= 4.5 && worst.gold >= 4.5, `headline ${worst.forest.toFixed(2)}, gold ${worst.gold.toFixed(2)}`);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} check(s) failed` : `all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
