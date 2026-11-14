// A clay-style, low-poly campus island built from the real walked routes (src/data/campus-network.json).
// It is art, not a map: walkways follow the data, buildings and trees are stylised, and there are no labels.
// Used twice: the hero (slow orbit, gold chevrons gliding along a route) and scroll-to-walk (camera flies a route).
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Vector3, Color, Shape, ExtrudeGeometry, BufferGeometry, Float32BufferAttribute,
  Mesh, MeshStandardMaterial, MeshBasicMaterial, InstancedMesh, Object3D, BoxGeometry, IcosahedronGeometry, CylinderGeometry,
  HemisphereLight, DirectionalLight, PCFSoftShadowMap, SRGBColorSpace, CatmullRomCurve3, CanvasTexture, PlaneGeometry, DoubleSide,
} from 'three';

const W = 1080, H = 694, S = 100; // plane units -> world units
const world = (p, y = 0) => new Vector3((p[0] - W / 2) / S, y, (p[1] - H / 2) / S);
const parse = (d) => { const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number); const o = []; for (let i = 0; i < n.length; i += 2) o.push([n[i], n[i + 1]]); return o; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const C = {
  grass: 0xcfe6cc, soil: 0xf3e8cb, soil2: 0xe6d6ae, path: 0xfffaf0, wall: 0xfffcf3, roof: 0x0f6a3c, roofGold: 0xf0c552,
  tree: [0x0a5a31, 0x2f8f5b, 0x5fb88a], trunk: 0xb9a37a, gold: 0xffc20e, goldDeep: 0xc98a00,
};

/** A flat ribbon along a polyline (x/z plane). Returns positions and indices. */
function ribbon(pts, width, y) {
  const pos = [], idx = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz * width * 0.5, nz = tx * width * 0.5;
    pos.push(pts[i].x + nx, y, pts[i].z + nz, pts[i].x - nx, y, pts[i].z - nz);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  return { pos, idx };
}
function mergeRibbons(lines, width, y) {
  const pos = [], idx = [];
  for (const pts of lines) { const r = ribbon(pts, width, y); const base = pos.length / 3; pos.push(...r.pos); idx.push(...r.idx.map((i) => i + base)); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const hull = (pts) => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
/** A soft island outline around the routes. */
function islandShape(points, grow, scale = 1) {
  const h = hull(points);
  const cx = h.reduce((s, p) => s + p[0], 0) / h.length, cz = h.reduce((s, p) => s + p[1], 0) / h.length;
  const ring = h.map((p) => { const dx = p[0] - cx, dz = p[1] - cz, l = Math.hypot(dx, dz) || 1; return new Vector3((cx + (dx / l) * (l + grow)) * scale, 0, (cz + (dz / l) * (l + grow)) * scale); });
  // drop points that sit too close together, then smooth
  const thin = ring.filter((p, i) => i === 0 || p.distanceTo(ring[i - 1]) > 0.5);
  const curve = new CatmullRomCurve3(thin, true, 'centripetal');
  const shape = new Shape();
  curve.getPoints(96).forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)));
  return shape;
}
const slab = (shape, depth, bevel) => {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 });
  g.rotateX(-Math.PI / 2); g.translate(0, -depth - bevel, 0);
  return g;
};
/** The app's AR arrow: a flat "^" 0.9 wide, 0.7 long, arms 0.25 thick, notch 0.3 (ChevronMeshes.cs). Points along +Z. */
function chevronGeometry(size) {
  const hw = 0.45 * size, hl = 0.35 * size, th = 0.25 * size, notch = 0.3 * size;
  const s = new Shape();
  s.moveTo(0, hl); s.lineTo(hw, -hl); s.lineTo(hw - th, -hl); s.lineTo(0, hl - notch); s.lineTo(-hw + th, -hl); s.lineTo(-hw, -hl); s.closePath();
  const g = new ExtrudeGeometry(s, { depth: size * 0.07, bevelEnabled: false });
  g.rotateX(Math.PI / 2); // lie flat; shape +y becomes +z
  g.translate(0, size * 0.07, 0);
  return g;
}

export function createCampus(canvas, { net, mode = 'hero', route, phone = false, shadows = true, dpr = 1 } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: mode === 'hero' ? 'high-performance' : 'default' });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // the island and the light never move, so the shadow is drawn once

  const scene = new Scene();
  const camera = new PerspectiveCamera(mode === 'hero' ? 26 : 46, 1, 0.1, 100);
  const island = new Group();
  scene.add(island);

  /* ---------- data ---------- */
  const rand = rng(20261030);
  const lines2d = net.walks.map((w) => parse(w.d));
  const lines = lines2d.map((l) => l.map((p) => world(p)));
  const all2d = lines2d.flat().map((p) => [(p[0] - W / 2) / S, (p[1] - H / 2) / S]);
  const segs = []; // every walkway segment, for "is this spot free?"
  lines.forEach((l) => { for (let i = 1; i < l.length; i++) segs.push([l[i - 1], l[i]]); });
  const distToPaths = (x, z) => {
    let best = Infinity;
    for (const [a, b] of segs) {
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
      if (d < best) best = d;
    }
    return best;
  };

  /* ---------- island ---------- */
  const clay = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, ...extra });
  const top = new Mesh(slab(islandShape(all2d, 0.62), 0.16, 0.06), clay(C.grass));
  top.receiveShadow = true;
  const mid = new Mesh(slab(islandShape(all2d, 0.5, 0.97), 0.42, 0.12), clay(C.soil));
  mid.position.y = -0.2;
  const low = new Mesh(slab(islandShape(all2d, 0.1, 0.8), 0.4, 0.16), clay(C.soil2));
  low.position.y = -0.72;
  island.add(top, mid, low);

  const paths = new Mesh(mergeRibbons(lines, 0.1, 0.004), new MeshStandardMaterial({ color: C.path, roughness: 1 }));
  paths.receiveShadow = true;
  island.add(paths);

  /* ---------- buildings: one clay block near each place, set back from the walkway ---------- */
  const dummy = new Object3D();
  const places = net.places.filter((p) => !/^Gate/.test(p.name));
  const built = [];
  const boxes = new InstancedMesh(new BoxGeometry(1, 1, 1), clay(C.wall), places.length);
  const roofs = new InstancedMesh(new BoxGeometry(1, 1, 1), clay(0xffffff), places.length);
  let nb = 0;
  for (const pl of places) {
    const p = world([pl.x, pl.y]);
    let w = 0.42 + rand() * 0.5, d = 0.3 + rand() * 0.28; const hgt = 0.16 + rand() * 0.34;
    let spot = null;
    for (let tries = 0; tries < 40 && !spot; tries++) {
      const ang = rand() * Math.PI * 2, r = 0.2 + tries * 0.022;
      const x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r;
      const need = Math.max(w, d) * 0.5 + 0.07;
      if (distToPaths(x, z) < need) continue;
      if (built.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + need)) continue;
      spot = { x, z, r: need };
      if (tries > 24) { w *= 0.8; d *= 0.8; }
    }
    if (!spot) continue;
    built.push(spot);
    const rot = Math.atan2(p.x - spot.x, p.z - spot.z);
    dummy.position.set(spot.x, hgt / 2, spot.z); dummy.rotation.set(0, rot, 0); dummy.scale.set(w, hgt, d); dummy.updateMatrix();
    boxes.setMatrixAt(nb, dummy.matrix);
    dummy.position.y = hgt + 0.022; dummy.scale.set(w + 0.05, 0.044, d + 0.05); dummy.updateMatrix();
    roofs.setMatrixAt(nb, dummy.matrix);
    roofs.setColorAt(nb, new Color(rand() < 0.2 ? C.roofGold : C.roof));
    nb++;
  }
  boxes.count = roofs.count = nb;
  boxes.castShadow = roofs.castShadow = true; boxes.receiveShadow = true;
  island.add(boxes, roofs);

  /* ---------- trees ---------- */
  const treeCount = phone ? 46 : 78;
  const crowns = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), treeCount);
  const trunks = new InstancedMesh(new CylinderGeometry(0.02, 0.028, 1, 5), clay(C.trunk), treeCount);
  const xs = all2d.map((p) => p[0]), zs = all2d.map((p) => p[1]);
  const box = { x0: Math.min(...xs) - 0.4, x1: Math.max(...xs) + 0.4, z0: Math.min(...zs) - 0.4, z1: Math.max(...zs) + 0.4 };
  let nt = 0;
  for (let tries = 0; tries < 1400 && nt < treeCount; tries++) {
    const x = box.x0 + rand() * (box.x1 - box.x0), z = box.z0 + rand() * (box.z1 - box.z0);
    const dp = distToPaths(x, z);
    if (dp < 0.13 || dp > 0.75) continue; // trees line the walks
    if (built.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 0.1)) continue;
    const s = 0.09 + rand() * 0.09, th = 0.1 + rand() * 0.08;
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3); dummy.position.set(x, th + s * 0.8, z); dummy.scale.set(s, s * (1 + rand() * 0.35), s); dummy.updateMatrix();
    crowns.setMatrixAt(nt, dummy.matrix); crowns.setColorAt(nt, new Color(C.tree[Math.floor(rand() * C.tree.length)]));
    dummy.rotation.set(0, 0, 0); dummy.position.set(x, th / 2, z); dummy.scale.set(1, th, 1); dummy.updateMatrix();
    trunks.setMatrixAt(nt, dummy.matrix);
    nt++;
  }
  crowns.count = trunks.count = nt;
  crowns.castShadow = true;
  island.add(crowns, trunks);

  /* ---------- the gold route ---------- */
  const routePts = route.map((p) => world(p, 0));
  const curve = new CatmullRomCurve3(routePts, false, 'centripetal', 0.5);
  const N = 240;
  const dense = curve.getSpacedPoints(N);
  const goldMat = new MeshBasicMaterial({ color: C.gold });
  const routeGeo = mergeRibbons([dense], mode === 'hero' ? 0.12 : 0.085, 0.012);
  const routeMesh = new Mesh(routeGeo, goldMat);
  const haloMesh = new Mesh(mergeRibbons([dense], mode === 'hero' ? 0.42 : 0.28, 0.008), new MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.22, depthWrite: false }));
  island.add(haloMesh, routeMesh);
  const at = (t, target = new Vector3()) => curve.getPointAt(Math.max(0, Math.min(1, t)), target);

  // gates and the destination pin
  const pin = new Group();
  const beacon = new Mesh(new CylinderGeometry(0.03, 0.11, 0.95, 4), new MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.9 }));
  beacon.position.y = 0.475;
  const ring = new Mesh(new CylinderGeometry(0.26, 0.26, 0.012, 32, 1, true), new MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.5, side: DoubleSide }));
  ring.position.y = 0.02;
  pin.add(beacon, ring);
  pin.position.copy(at(1));
  island.add(pin);

  // chevrons
  const chevCount = mode === 'hero' ? 9 : 5;
  const chevs = new InstancedMesh(chevronGeometry(mode === 'hero' ? 0.3 : 0.15), new MeshBasicMaterial({ color: C.gold }), chevCount);
  const chevEdge = new InstancedMesh(chevronGeometry(mode === 'hero' ? 0.3 : 0.15), new MeshBasicMaterial({ color: C.goldDeep }), chevCount);
  island.add(chevEdge, chevs);
  const tmp = new Vector3(), tmp2 = new Vector3();
  const placeChevron = (i, t, lift, scale) => {
    at(t, tmp); at(t + 0.004, tmp2);
    dummy.position.set(tmp.x, lift, tmp.z);
    dummy.rotation.set(0, Math.atan2(tmp2.x - tmp.x, tmp2.z - tmp.z), 0);
    dummy.scale.setScalar(scale); dummy.updateMatrix();
    chevs.setMatrixAt(i, dummy.matrix);
    dummy.position.y = lift - 0.012; dummy.updateMatrix();
    chevEdge.setMatrixAt(i, dummy.matrix);
  };

  /* ---------- light ---------- */
  scene.add(new HemisphereLight(0xfffdf6, 0xb9d8b4, 1.55));
  const sun = new DirectionalLight(0xfff3d6, 2.1);
  sun.position.set(-4.5, 7, 3.5);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 1, far: 20 });
  sun.shadow.bias = -0.0006; sun.shadow.radius = 5;
  scene.add(sun);

  // soft shadow under the floating island (hero only)
  let floorShadow = null;
  if (mode === 'hero') {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, 'rgba(6,48,29,.34)'); grad.addColorStop(0.55, 'rgba(6,48,29,.1)'); grad.addColorStop(1, 'rgba(6,48,29,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    floorShadow = new Mesh(new PlaneGeometry(15, 10), new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false }));
    floorShadow.rotation.x = -Math.PI / 2; floorShadow.position.y = -2.1;
    scene.add(floorShadow);
  }

  /* ---------- state and drawing ---------- */
  const state = { t: 0, progress: 0, pointerX: 0, pointerY: 0, scroll: 0, active: false, dirty: true, lost: false };
  const look = new Vector3(), camPos = new Vector3(), smoothLook = new Vector3(), smoothPos = new Vector3();
  let first = true;

  const frameHero = (dt) => {
    state.t += dt;
    // chevrons glide from the gate to the pin, fading in and out at the ends
    for (let i = 0; i < chevCount; i++) {
      const t = (state.t * 0.055 + i / chevCount) % 1;
      const fade = Math.min(1, t / 0.06, (1 - t) / 0.06);
      placeChevron(i, t, 0.035 + Math.sin((state.t * 2 + i) * 1.3) * 0.004, Math.max(0.001, fade));
    }
    chevs.instanceMatrix.needsUpdate = chevEdge.instanceMatrix.needsUpdate = true;
    ring.scale.setScalar(1 + (state.t * 0.5 % 1) * 0.9); ring.material.opacity = 0.5 * (1 - (state.t * 0.5 % 1));
    island.position.y = Math.sin(state.t * 0.6) * 0.045;
    // a slow turn, nudged by the pointer (desktop) or the scroll (phones)
    const az = -0.55 + Math.sin(state.t * 0.12) * 0.22 + state.pointerX * 0.3 + state.scroll * 0.7;
    const pol = 0.98 - state.pointerY * 0.1 - state.scroll * 0.22;
    const aspect = camera.aspect;
    const dist = aspect < 1.2 ? 21 / Math.max(0.6, aspect) : 21.5;
    camera.position.set(Math.sin(az) * Math.sin(pol) * dist, Math.cos(pol) * dist, Math.cos(az) * Math.sin(pol) * dist);
    camera.lookAt(0, -0.35, 0);
  };
  const frameWalk = () => {
    const p = state.progress;
    // a chase camera: behind and above the walker, looking down the route
    at(p, tmp); at(Math.min(1, p + 0.06), look); at(Math.max(0, p - 0.05), tmp2);
    const dx = look.x - tmp2.x, dz = look.z - tmp2.z, l = Math.hypot(dx, dz) || 1;
    camPos.set(tmp.x - (dx / l) * 1.05, 0.92, tmp.z - (dz / l) * 1.05);
    look.set(tmp.x + (dx / l) * 0.55, 0.04, tmp.z + (dz / l) * 0.55);
    if (first) { smoothPos.copy(camPos); smoothLook.copy(look); first = false; }
    smoothPos.lerp(camPos, 0.14); smoothLook.lerp(look, 0.18);
    camera.position.copy(smoothPos); camera.lookAt(smoothLook);
    // the walked part is solid gold; arrows lead the way ahead
    routeGeo.setDrawRange(0, Math.max(6, Math.round(p * N) * 6));
    for (let i = 0; i < chevCount; i++) { const t = p + 0.035 + i * 0.045; placeChevron(i, t, 0.03, t > 1 ? 0.001 : 1); }
    chevs.instanceMatrix.needsUpdate = chevEdge.instanceMatrix.needsUpdate = true;
    if (smoothPos.distanceTo(camPos) > 0.004 || smoothLook.distanceTo(look) > 0.004) state.dirty = true;
  };
  if (mode === 'walk') { routeGeo.setDrawRange(0, 6); haloMesh.material.opacity = 0.3; }

  let lastW = 0, lastH = 0;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    state.dirty = true;
  };
  let shadowDone = false;
  const render = (dt = 0.016) => {
    if (state.lost) return;
    resize();
    if (mode === 'hero') frameHero(dt);
    else { if (!state.dirty) return; state.dirty = false; frameWalk(); }
    if (!shadowDone && shadows) { renderer.shadowMap.needsUpdate = true; shadowDone = true; }
    renderer.render(scene, camera);
  };

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); state.lost = true; canvas.dispatchEvent(new CustomEvent('campus-lost')); });
  canvas.addEventListener('webglcontextrestored', () => { state.lost = false; shadowDone = false; state.dirty = true; });

  return {
    render,
    setProgress(p) { if (Math.abs(p - state.progress) > 1e-4) { state.progress = p; state.dirty = true; } },
    setPointer(x, y) { state.pointerX = x; state.pointerY = y; },
    setScroll(s) { state.scroll = s; },
    invalidate() { state.dirty = true; },
    dispose() { renderer.dispose(); renderer.forceContextLoss?.(); },
    state,
  };
}
