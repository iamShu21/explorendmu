// Find any place: live search over the app's own info cards, and the walked route drawn for the chosen place.
import { gsap, env, $, $$, EASE } from '../core.js';

export function initFind() {
  const root = $('[data-find]');
  const raw = $('[data-find-data]');
  if (!root || !raw) return;
  const { entries, gates } = JSON.parse(raw.textContent);
  const input = $('[data-find-input]', root), status = $('[data-find-status]', root), list = $('[data-find-list]', root);
  const items = $$('[data-find-item]', root), filters = $$('[data-find-filter]', root);
  const el = (name) => $(`[data-find-${name}]`);
  const route = el('route'), halo = el('halo'), start = el('start'), end = el('end');
  let filter = 'all';

  const text = entries.map((e) => `${e.name} ${e.where} ${e.about} ${e.services.join(' ')}`.toLowerCase());
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach((b) => {
      const e = entries[+b.dataset.findItem];
      const ok = (filter === 'all' || e.route || e.gate) && words.every((w) => text[e.id].includes(w));
      b.parentElement.hidden = !ok;
      if (ok) shown++;
    });
    status.textContent = shown === 0
      ? `No place matches “${input.value.trim()}”. Try a building or an office name.`
      : shown === entries.length ? `${shown} places` : `${shown} of ${entries.length} places`;
  };
  input.addEventListener('input', apply);
  filters.forEach((f) => f.addEventListener('click', () => { filter = f.dataset.findFilter; filters.forEach((x) => x.setAttribute('aria-pressed', String(x === f))); apply(); }));

  const fill = (node, tag, values, cls) => { node.textContent = ''; values.forEach((v) => { const c = document.createElement(tag); if (cls) c.className = cls; c.textContent = v; node.appendChild(c); }); };
  const select = (id, animate = true) => {
    const e = entries[id];
    items.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.findItem === id)));
    el('name').textContent = e.name;
    el('where').textContent = e.where;
    el('where').hidden = !e.where;
    $('span', el('routetext')).textContent = e.routeText;
    el('about').textContent = e.about;
    const hours = el('hours'); hours.textContent = '';
    e.schedule.forEach((line) => { const i = line.indexOf(':'); const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = i > 0 ? line.slice(0, i) : line; dd.textContent = i > 0 ? line.slice(i + 1).trim() : ''; hours.append(dt, dd); });
    el('hours-wrap').hidden = !e.schedule.length;
    fill(el('services'), 'li', e.services, 'app-chip');
    el('services-wrap').hidden = !e.services.length;

    // the route on the campus art
    const has = !!e.route;
    [route, halo, end].forEach((n) => n.style.display = has ? '' : 'none');
    start.style.display = has || e.gate ? '' : 'none';
    if (e.gate) { const g = Object.entries(gates).find(([name]) => e.name.includes(name) || (name === 'Gate 02' && /Alunan/.test(e.where))); if (g) start.setAttribute('transform', `translate(${g[1][0]} ${g[1][1]})`); }
    if (has) {
      route.setAttribute('d', e.route.d); halo.setAttribute('d', e.route.d);
      const [gx, gy] = gates[e.route.from];
      start.setAttribute('transform', `translate(${gx} ${gy})`);
      const last = e.route.d.match(/(-?[\d.]+) (-?[\d.]+)$/);
      end.setAttribute('transform', `translate(${last[1]} ${last[2]})`);
      if (animate && !env.reduced) {
        gsap.fromTo(route, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.3, ease: EASE.inOut, overwrite: true });
        gsap.fromTo(halo, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.5, overwrite: true });
        gsap.fromTo(end, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 1.1, overwrite: true });
      } else gsap.set([route, halo, end], { strokeDashoffset: 0, opacity: 1 });
    }
    if (animate && !env.reduced) gsap.fromTo('[data-find-card] > *', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: EASE.out, stagger: 0.04, overwrite: true });
  };
  list.addEventListener('click', (ev) => { const b = ev.target.closest('[data-find-item]'); if (b) select(+b.dataset.findItem); });
}
