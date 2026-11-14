// The living gradient: one full-screen WebGL fragment shader, written for this site (no library).
// Soft water-like drift of white, cream, gold and green. It stays mostly cream so text is always readable,
// its look shifts a little per scene, and it follows the real time of day in the Philippines.
import { gsap, env, on, perf, $, $$, clamp, lerp, EASE } from './core.js';

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime, uGold, uGreen, uDeep, uZoom, uBloom, uFloor;
uniform vec2 uCam;
uniform vec3 uPaper, uGoldC, uMintC, uForestC;

// Simplex noise (Ian McEwan, Ashima Arts; MIT licence)
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=(uv-.5)*vec2(uRes.x/uRes.y,1.)*uZoom+uCam;
  float t=uTime;
  // a tilted, slowly rolling surface: two warped layers of noise
  vec2 q=vec2(p.x*.82+p.y*.32,p.y*1.18-p.x*.12);
  float n1=snoise(vec3(q*.62+vec2(0.,t*.35),t*.22));
  float n2=snoise(vec3(q*1.05+n1*.55+vec2(3.7,-t*.28),t*.18+4.));
  float n3=snoise(vec3(q*.48-n2*.4+vec2(-2.1,t*.2),t*.14+9.));
  vec3 col=uPaper;
  col=mix(col,uGoldC,smoothstep(.02,.92,n1*.5+.5)*uGold);
  col=mix(col,uMintC,smoothstep(.3,1.,n2*.5+.5)*uGreen);
  col=mix(col,uForestC,smoothstep(.5,1.05,n3*.5+.5)*uDeep);
  // soft light falling from the upper right
  col+=vec3(.05,.045,.02)*smoothstep(-.2,1.1,uv.x*.6+uv.y*.7)*(1.-uDeep);
  // never let it get darker than the floor, so dark green text keeps its contrast everywhere
  float L=lum(col);
  col=mix(col,uPaper,clamp((uFloor-L)/max(uFloor-L+.25,.001)*1.6,0.,1.));
  // the intro "bloom": the page opens white and the colour flows in
  col=mix(vec3(1.,.992,.965),col,uBloom);
  gl_FragColor=vec4(col,1.);
}`;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const PAPER = '#FFFDF6', GOLD = '#FFC20E', MINT = '#5FD395', FOREST = '#0A5A31';

/* ---------- campus time of day (Asia/Manila) ---------- */
// '?hour=19.5' pins the campus time, to check the morning, afternoon and night looks.
const forcedHour = new URLSearchParams(location.search).get('hour');
const manila = () => {
  if (forcedHour !== null && forcedHour !== '') { const h = Number(forcedHour) % 24, hh = Math.floor(h), mm = String(Math.round((h - hh) * 60)).padStart(2, '0'); return { hours: h, label: `${hh % 12 || 12}:${mm} ${hh >= 12 ? 'PM' : 'AM'}` }; }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  let h = Number(get('hour')) % 12; if (/pm/i.test(get('dayPeriod'))) h += 12;
  return { hours: h + Number(get('minute')) / 60, label: `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}` };
};
// Three looks, blended over an hour around each change.
const LOOKS = {
  morning: { paper: '#FFFEFB', gold: '#FFCB2E', gold_: 0.52, green: 0.3, deep: 0.05 },   // bright white and gold
  afternoon: { paper: '#FFF9E8', gold: '#FFBD0A', gold_: 0.74, green: 0.2, deep: 0.06 }, // warmer gold
  night: { paper: '#F6F3DF', gold: '#F2B200', gold_: 0.5, green: 0.46, deep: 0.3 },      // deeper green and gold
};
const mixLook = (a, b, t) => ({
  paper: hex(a.paper).map((v, i) => lerp(v, hex(b.paper)[i], t)),
  gold: hex(a.gold).map((v, i) => lerp(v, hex(b.gold)[i], t)),
  gold_: lerp(a.gold_, b.gold_, t), green: lerp(a.green, b.green, t), deep: lerp(a.deep, b.deep, t),
});
export const lookAt = (h) => {
  const s = (edge) => clamp((h - edge + 0.5) / 1, 0, 1); // 1 hour blend centred on the edge
  if (h >= 4.5 && h < 10.5) return mixLook(LOOKS.night, LOOKS.morning, s(5));
  if (h >= 10.5 && h < 17) return mixLook(LOOKS.morning, LOOKS.afternoon, s(11));
  if (h >= 17) return mixLook(LOOKS.afternoon, LOOKS.night, s(17.5));
  return mixLook(LOOKS.night, LOOKS.night, 0);
};

/* ---------- per-scene shifts (palette weight and "camera") ---------- */
const SCENE = {
  top: { g: 1, m: 1, x: 0, y: 0, z: 1 },
  problem: { g: 0.55, m: 1.25, x: 0.5, y: 0.25, z: 1.25 },
  follow: { g: 1.1, m: 0.7, x: -0.4, y: 0.5, z: 0.95 },
  walk: { g: 0.8, m: 1.2, x: 0.3, y: 0.9, z: 1.15 },
  hear: { g: 1.15, m: 0.6, x: -0.6, y: 1.2, z: 1.0 },
  arrive: { g: 1.25, m: 0.8, x: 0.2, y: 1.6, z: 0.9 },
  find: { g: 0.6, m: 1.3, x: 0.7, y: 1.9, z: 1.2 },
  tour: { g: 1.0, m: 1.0, x: -0.3, y: 2.3, z: 1.05 },
  statues: { g: 0.5, m: 0.9, x: 0, y: 2.6, z: 1.3 },
  places: { g: 1.1, m: 0.8, x: 0.5, y: 3.0, z: 1.0 },
  walks: { g: 0.9, m: 1.2, x: -0.5, y: 3.4, z: 1.2 },
  film: { g: 0.6, m: 0.8, x: 0.1, y: 3.7, z: 1.3 },
  how: { g: 0.7, m: 1.1, x: 0.6, y: 4.1, z: 1.15 },
  team: { g: 0.9, m: 0.9, x: -0.2, y: 4.5, z: 1.1 },
  download: { g: 1.3, m: 0.7, x: 0, y: 4.9, z: 0.9 },
};

export function initGradient() {
  const canvas = $('[data-gradient]');
  const now = manila();
  const label = $('[data-light]');
  const setLabel = () => {
    const m = manila();
    const t = $('[data-light-time]');
    if (t) { t.textContent = m.label; t.setAttribute('datetime', new Date().toISOString()); }
    if (label) label.hidden = false;
  };
  setLabel();
  setInterval(setLabel, 30000);

  // Weak devices and browsers without WebGL get the still image (set in CSS on the canvas).
  if (!canvas || !env.webgl || env.weak) { canvas?.classList.add('is-still'); return null; }

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) { canvas.classList.add('is-still'); return null; }

  let program, uni = {};
  const build = () => {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    program = gl.createProgram();
    gl.attachShader(program, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uTime', 'uGold', 'uGreen', 'uDeep', 'uZoom', 'uBloom', 'uFloor', 'uCam', 'uPaper', 'uGoldC', 'uMintC', 'uForestC'].forEach((n) => (uni[n] = gl.getUniformLocation(program, n)));
  };
  try { build(); } catch (e) { canvas.classList.add('is-still'); return null; }

  // The gradient is soft, so a small buffer is enough: a third of the CSS size on phones, half on desktop.
  let scale = env.phone ? 0.34 : 0.5;
  const resize = () => {
    const w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  resize();
  addEventListener('resize', resize, { passive: true });

  const base = lookAt(now.hours);
  const state = { g: 1, m: 1, x: 0, y: 0, z: 1, bloom: document.documentElement.classList.contains('intro-on') ? 0 : 1, t: Math.random() * 40 };
  const draw = () => {
    gl.uniform2f(uni.uRes, canvas.width, canvas.height);
    gl.uniform1f(uni.uTime, state.t);
    gl.uniform1f(uni.uGold, clamp(base.gold_ * state.g, 0, 0.95));
    gl.uniform1f(uni.uGreen, clamp(base.green * state.m, 0, 0.7));
    gl.uniform1f(uni.uDeep, clamp(base.deep * state.m, 0, 0.4));
    gl.uniform1f(uni.uZoom, state.z);
    gl.uniform1f(uni.uBloom, state.bloom);
    gl.uniform1f(uni.uFloor, 0.6);
    gl.uniform2f(uni.uCam, state.x, state.y);
    gl.uniform3fv(uni.uPaper, base.paper);
    gl.uniform3fv(uni.uGoldC, base.gold);
    gl.uniform3fv(uni.uMintC, hex(MINT));
    gl.uniform3fv(uni.uForestC, hex(FOREST));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // 30 fps is plenty for a slow drift. Stops while the tab is hidden; a still frame with reduced motion.
  let running = false, lost = false, last = 0, acc = 0;
  const frame = (time, dt) => {
    if (lost) return;
    acc += dt;
    if (acc < 33) return;
    state.t += (acc / 1000) * 0.11;
    acc = 0;
    draw();
  };
  const start = () => { if (!running && !env.reduced && !lost) { running = true; gsap.ticker.add(frame); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(frame); } };
  draw();
  canvas.classList.add('is-live');
  start();
  on('visibility', (v) => (v ? start() : stop()));
  on('slow', () => { scale *= 0.6; resize(); draw(); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; stop(); canvas.classList.remove('is-live'); canvas.classList.add('is-still'); });
  canvas.addEventListener('webglcontextrestored', () => { try { build(); lost = false; canvas.classList.remove('is-still'); canvas.classList.add('is-live'); resize(); draw(); start(); } catch {} });

  // Each scene nudges the palette and the camera.
  const go = (id) => {
    const s = SCENE[id];
    if (!s) return;
    if (env.reduced) { Object.assign(state, s); draw(); return; }
    gsap.to(state, { ...s, duration: 2.2, ease: EASE.soft, overwrite: 'auto' });
  };
  on('scene', go);

  return {
    gl, canvas,
    bloom: (duration = 0.9) => (env.reduced ? ((state.bloom = 1), draw()) : gsap.to(state, { bloom: 1, duration, ease: 'power2.out' })),
    state, draw,
  };
}
