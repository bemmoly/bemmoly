// Scene 1: the sprawl. A dozen unnamed tools float in depth, price tags and paywalls pop onto them,
// the links between them snap, and everything collapses into the point of light the mark comes from.
import { h, tf, E, ep, prog, spring, lerp, clamp, drift, css, rand } from '../engine.js';
import { icon, words, revealWords } from '../components.js';

const P = 2200; // stage perspective
const TOOLS = [
  { name: 'Issues', kind: 'list', c: '#e5484d' },
  { name: 'Wiki', kind: 'doc', c: '#3b82f6' },
  { name: 'HR', kind: 'form', c: '#c2536a' },
  { name: 'Timesheets', kind: 'grid', c: '#0e9bb0' },
  { name: 'Expenses', kind: 'receipt', c: '#2f9e6e' },
  { name: 'Helpdesk', kind: 'chat', c: '#d46a2e' },
  { name: 'CI/CD', kind: 'pipeline', c: '#71717a' },
  { name: 'Logins', kind: 'keys', c: '#6e56cf' },
  { name: 'Assets', kind: 'list', c: '#b7791f' },
  { name: 'Hiring', kind: 'kanban', c: '#d46a2e' },
  { name: 'Reviews', kind: 'chart', c: '#2356c9' },
  { name: 'Licences', kind: 'grid', c: '#9b4f96' },
];
// Loose ellipse around the headline; z spreads them in depth.
const POS = TOOLS.map((_, i) => {
  const a = (i / TOOLS.length) * Math.PI * 2 - Math.PI / 2 + 0.18;
  const rx = 790 + rand(i + 3) * 90, ry = 370 + rand(i + 9) * 60;
  return { x: Math.cos(a) * rx, y: Math.sin(a) * ry, z: -520 + rand(i + 21) * 620, rz: (rand(i + 5) - 0.5) * 14, ry: (rand(i + 7) - 0.5) * 30 };
});
const TAGS = [
  [0, '$12 / seat / month', 'red'], [1, 'Upgrade to unlock', 'amber'], [2, 'Contact sales', 'red'], [3, 'Seat limit reached', 'red'],
  [4, '+$6 per add-on', 'amber'], [5, 'Pro plan required', 'amber'], [6, 'Trial ends in 3 days', 'red'], [7, 'Enterprise only', 'amber'],
  [8, '$9 / user / month', 'red'], [9, 'Premium feature', 'amber'], [10, '$8 / seat', 'red'], [11, 'Licence key expired', 'red'],
];
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0], [0, 6], [3, 9], [1, 7]];

function bar(w, c = '#e3e6ec', hh = 7) { return `<div style="height:${hh}px;width:${w}%;border-radius:4px;background:${c}"></div>`; }
function miniUI(kind, c) {
  const rows = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  switch (kind) {
    case 'list': return rows(5, (i) => `<div style="display:flex;gap:8px;align-items:center"><div style="width:10px;height:10px;border-radius:3px;background:${i % 2 ? c : '#cfd4dc'}"></div>${bar(40 + ((i * 17) % 45))}</div>`);
    case 'doc': return `${bar(70, '#cfd4dc', 11)}${bar(95)}${bar(88)}${bar(92)}${bar(60)}${bar(80)}`;
    case 'form': return rows(3, () => `<div>${bar(30, '#cfd4dc', 5)}<div style="margin-top:5px;height:18px;border:1.5px solid #e3e6ec;border-radius:5px"></div></div>`);
    case 'grid': return `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px">${rows(18, (i) => `<div style="height:14px;border-radius:3px;background:${(i * 7) % 5 === 0 ? c : '#eef0f3'};opacity:${(i * 7) % 5 === 0 ? 0.7 : 1}"></div>`)}</div>`;
    case 'receipt': return `<div style="display:flex;gap:10px"><div style="width:52px;height:72px;border-radius:5px;background:#eef0f3;border:1.5px dashed #cfd4dc"></div><div style="flex:1;display:flex;flex-direction:column;gap:7px">${bar(80)}${bar(50)}${bar(65, c)}</div></div>`;
    case 'chat': return rows(3, (i) => `<div style="display:flex;justify-content:${i % 2 ? 'flex-end' : 'flex-start'}"><div style="width:${55 + i * 10}%;height:16px;border-radius:8px;background:${i % 2 ? c : '#eef0f3'};opacity:${i % 2 ? 0.75 : 1}"></div></div>`);
    case 'pipeline': return `<div style="display:flex;align-items:center;gap:6px;margin-top:8px">${rows(4, (i) => `<div style="width:26px;height:26px;border-radius:50%;border:2px solid ${i < 2 ? '#1f9d55' : i === 2 ? '#e5484d' : '#cfd4dc'}"></div>${i < 3 ? '<div style="flex:1;height:2px;background:#e3e6ec"></div>' : ''}`)}</div>${bar(70)}`;
    case 'keys': return rows(3, () => `<div style="display:flex;gap:8px;align-items:center"><div style="width:18px;height:18px;border-radius:50%;background:#eef0f3"></div>${bar(45)}<div style="margin-left:auto;font:600 11px PlexMono;color:#9aa1ae">••••••</div></div>`);
    case 'kanban': return `<div style="display:flex;gap:6px">${rows(3, (k) => `<div style="flex:1;background:#f5f6f8;border-radius:5px;padding:5px;display:flex;flex-direction:column;gap:4px">${rows(3 - k, () => `<div style="height:16px;border-radius:3px;background:#fff;box-shadow:0 0 0 1px #e3e6ec"></div>`)}</div>`)}</div>`;
    case 'chart': return `<div style="display:flex;align-items:flex-end;gap:7px;height:78px">${rows(7, (i) => `<div style="flex:1;border-radius:3px 3px 0 0;height:${30 + ((i * 37) % 60)}%;background:${i === 5 ? c : '#dfe3ea'}"></div>`)}</div>`;
  }
  return '';
}

let group, scrim, lines = [], wins = [], tags = [], heads = [], point, svg;

export default {
  id: 'sprawl',
  build(root) {
    // Flat group: each window carries its own perspective and is depth-sorted by z-index, so no
    // two planes ever intersect (Chrome splits intersecting planes inside preserve-3d).
    group = h('div', { class: 'abs', style: { inset: 0, zIndex: 0 } });
    svg = h('svg', { class: 'abs', width: 1920, height: 1080, style: { left: 0, top: 0, overflow: 'visible' } });
    lines = LINKS.map(() => {
      const a = h('line', { stroke: 'rgba(200,212,235,.85)', 'stroke-width': 2.5, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' });
      const b = h('line', { stroke: 'rgba(200,212,235,.85)', 'stroke-width': 2.5, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' });
      const spark = h('circle', { r: 5, fill: '#ff6b6b' });
      svg.append(a, b, spark);
      return { a, b, spark };
    });

    wins = TOOLS.map((tl, i) => {
      const w = h('div', { class: 'abs will', style: { left: '-150px', top: '-100px', width: '300px', borderRadius: '12px', background: '#fff', color: '#161b26',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05)', overflow: 'visible' } });
      const head = h('div', { style: { height: '34px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', borderBottom: '1px solid #eef0f3', background: '#f7f8fa', borderRadius: '12px 12px 0 0', fontSize: '13px', fontWeight: 600 } },
        h('div', { style: { width: '16px', height: '16px', borderRadius: '4px', background: tl.c } }), tl.name,
        h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '5px' } }, ...[0, 1, 2].map(() => h('div', { style: { width: '8px', height: '8px', borderRadius: '50%', background: '#dfe3ea' } }))));
      const body = h('div', { style: { padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '128px' } }, miniUI(tl.kind, tl.c));
      w.append(head, body);
      const wrap = h('div', { class: 'center' }, w);
      group.append(wrap);
      return { wrap, w };
    });

    tags = TAGS.map(([wi, label, tone]) => {
      const red = tone === 'red';
      const t = h('div', { class: 'abs', style: { right: '-26px', top: '-18px', display: 'flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 14px', borderRadius: '17px', whiteSpace: 'nowrap',
        fontSize: '15px', fontWeight: 600, color: red ? '#fff' : '#3a2a00', background: red ? '#e5484d' : '#f5b72b', boxShadow: '0 10px 24px -8px rgba(0,0,0,.6)' } },
        icon(label.startsWith('$') || label.startsWith('+') ? 'dollar-sign' : 'lock', 15, 2.4), label);
      wins[wi].w.append(t);
      return t;
    });

    scrim = h('div', { class: 'abs', style: { left: '360px', top: '340px', width: '1200px', height: '400px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(5,7,10,.85) 0%, rgba(5,7,10,.55) 45%, rgba(5,7,10,0) 72%)' } });
    const flat = h('div', { class: 'abs', style: { inset: 0 } }, scrim);

    const lineTexts = ['Your team runs on a dozen tools.', 'A dozen logins. A dozen bills.', 'And none of them talk to each other.'];
    heads = lineTexts.map((s) => {
      const el = h('div', { class: 'abs display', style: { left: 0, width: '1920px', top: '492px', textAlign: 'center', fontSize: '72px', color: '#fff' } });
      flat.append(el);
      return words(el, s);
    });

    point = h('div', { class: 'abs', style: { left: '960px', top: '540px', width: '240px', height: '240px', marginLeft: '-120px', marginTop: '-120px', borderRadius: '50%',
      background: 'radial-gradient(circle, #fff 0%, rgba(170,195,255,.8) 12%, rgba(91,123,229,.3) 35%, transparent 70%)', mixBlendMode: 'screen' } });
    flat.append(point);
    // Lines, scrim, type and the light live in screen space, on flat layers above the 3D group
    // (planes inside a preserve-3d group get split against each other).
    root.append(group, h('div', { class: 'abs', style: { inset: 0 } }, svg), flat);
  },
  update(t) {
    const collapse = Math.pow(prog(t, 7.6, 9.0), 3.2);
    const apart = E.inOutCubic(prog(t, 6.55, 7.6)) * (1 - collapse);
    const dim = E.inOutCubic(prog(t, 6.6, 7.4));
    const orbit = drift(t, 2, 0.35) * 4;

    const screen = [];
    wins.forEach(({ wrap, w }, i) => {
      const p = POS[i];
      const k = spring(t - 0.55 - i * 0.11, { stiffness: 70, damping: 14 });
      const bob = Math.sin(t * 0.9 + i) * 10;
      const spread = 1 + apart * 0.14;
      const z0 = lerp(-3200, p.z, k);
      let x = p.x * spread, y = p.y * spread + bob, z = z0;
      // Collapse: everything rushes to the centre and away.
      x = lerp(x, 0, collapse); y = lerp(y, 0, collapse); z = lerp(z, -300, collapse);
      const s = lerp(1, 0.04, collapse);
      const rz = p.rz + collapse * (i % 2 ? 140 : -140);
      css(wrap, 'transform', `perspective(${P}px) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${(p.ry + orbit).toFixed(3)}deg) rotate(${rz.toFixed(3)}deg)`);
      css(wrap, 'z-index', String(Math.round(z + 4000)));
      tf(w, { s, o: prog(t, 0.55 + i * 0.11, 0.95 + i * 0.11) * (1 - prog(t, 8.7, 9.0)), blur: Math.max(0, (1 - clamp(k)) * 16) + collapse * 6, bright: lerp(1, 0.55, dim) * lerp(1, 2.2, collapse), sat: lerp(1, 0.25, dim) });
      const f = P / (P - z);
      screen.push([960 + x * f, 540 + y * f]);
    });

    tags.forEach((tg, i) => {
      const st = 3.25 + i * 0.13;
      const k = spring(t - st, { stiffness: 320, damping: 15 });
      tf(tg, { s: Math.max(0, k), rz: (1 - k) * 18 + (i % 2 ? 4 : -4), o: prog(t, st, st + 0.05) });
    });

    // Links draw in, then snap: each half retracts toward its own window with a spark at the break.
    lines.forEach(({ a, b, spark }, i) => {
      const [i0, i1] = LINKS[i];
      // Start and end at the windows' edges, not their centres.
      let [x0, y0] = screen[i0], [x1, y1] = screen[i1];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      const edge = (dx, dy) => Math.min(150 / Math.max(Math.abs(dx), 1e-3), 105 / Math.max(Math.abs(dy), 1e-3));
      const e = edge(ux, uy);
      x0 += ux * e; y0 += uy * e; x1 -= ux * e; y1 -= uy * e;
      const draw = E.outCubic(prog(t, 5.85 + i * 0.04, 6.35 + i * 0.04));
      const snap = E.outExpo(prog(t, 6.55 + (i % 5) * 0.05, 7.3 + (i % 5) * 0.05));
      const mx = lerp(x0, x1, 0.5), my = lerp(y0, y1, 0.5);
      const ea = lerp(1, 0.18, snap), eb = lerp(1, 0.18, snap);
      const ax = lerp(x0, mx, draw * ea), ay = lerp(y0, my, draw * ea);
      const bx = lerp(x1, mx, draw * eb), by = lerp(y1, my, draw * eb);
      a.setAttribute('x1', x0.toFixed(1)); a.setAttribute('y1', y0.toFixed(1)); a.setAttribute('x2', ax.toFixed(1)); a.setAttribute('y2', ay.toFixed(1));
      b.setAttribute('x1', x1.toFixed(1)); b.setAttribute('y1', y1.toFixed(1)); b.setAttribute('x2', bx.toFixed(1)); b.setAttribute('y2', by.toFixed(1));
      const lo = (draw > 0 ? 1 : 0) * (1 - prog(t, 7.2, 7.8));
      css(a, 'opacity', lo.toFixed(3)); css(b, 'opacity', lo.toFixed(3));
      const sp = prog(t, 6.55 + (i % 5) * 0.05, 6.95 + (i % 5) * 0.05);
      spark.setAttribute('cx', mx.toFixed(1)); spark.setAttribute('cy', my.toFixed(1));
      spark.setAttribute('r', (3 + sp * 14).toFixed(1));
      css(spark, 'opacity', (sp > 0 && sp < 1 ? (1 - sp) * 0.9 : 0).toFixed(3));
    });

    tf(scrim, { o: 1 - collapse });
    revealWords(heads[0], t, 0.45, { stagger: 0.07, out: 2.85 });
    revealWords(heads[1], t, 3.2, { stagger: 0.07, out: 5.45 });
    revealWords(heads[2], t, 5.75, { stagger: 0.06, out: 7.5 });

    // The point of light the next scene blooms from.
    const pt = E.inExpo(prog(t, 8.2, 9.05));
    tf(point, { s: lerp(0.05, 1.2, pt), o: pt });
  },
};
