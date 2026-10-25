// Scene 9: the roadmap. The kernel glows at the centre of a 3D orbit; Work, Docs and AI ride the
// inner ring, Pipelines and the nine suite products assemble on the outer ring, a light carries
// one new hire through every product, and the products part and snap back together.
// Everything is projected by hand (a camera with yaw, pitch and zoom), so labels stay upright and
// depth drives scale, stacking and focus blur.
import { h, tf, E, ep, prog, spring, lerp, clamp, css, keys } from '../engine.js';
import { tile, icon, markSvg, caption, avatar } from '../components.js';

const R_IN = 285;
const R_OUT = 560;
const DEG = Math.PI / 180;

// Outer ring, in the order the new hire meets them (slot i sits at i × 36°).
const OUTER = [
  { id: 'hiring', name: 'Hiring', icon: 'user-round-plus', ev: 'Offer signed', meta: 'Her record goes to People' },
  { id: 'people', name: 'People', icon: 'contact-round', ev: 'Record created', meta: 'Role, team, manager, start date' },
  { id: 'assets', name: 'Assets', icon: 'laptop', ev: 'Laptop ships', meta: 'Standard engineering kit' },
  { id: 'access', name: 'Access', icon: 'shield-check', ev: 'Apps ready on day one', meta: 'Access that follows her role' },
  { id: 'licences', name: 'Licences', icon: 'key-round', ev: 'Seat from the pool', meta: 'Nothing new to buy' },
  { id: 'performance', name: 'Performance', icon: 'target', ev: '30-60-90 goals', meta: 'Drafted from her onboarding plan' },
  { id: 'time', name: 'Time', icon: 'timer', ev: 'Timesheet ready', meta: 'Her projects, already there' },
  { id: 'expenses', name: 'Expenses', icon: 'receipt', ev: 'Expenses ready', meta: 'Her approver, card and limits' },
  { id: 'helpdesk', name: 'Helpdesk', icon: 'life-buoy', ev: 'Help that knows her', meta: 'Her device, her apps, her team' },
  { id: 'pipelines', name: 'Pipelines', icon: 'git-branch' },
];
const INNER = [
  { id: 'work', name: 'Work', icon: 'square-kanban', color: 'var(--m-work)', a: 0 },
  { id: 'docs', name: 'Docs', icon: 'file-text', color: 'var(--m-docs)', a: 120 },
  { id: 'ai', name: 'AI', icon: 'sparkles', color: 'var(--brand-3)', a: 240 },
];
const KERNEL = ['One sign-in', 'One person record', 'One approval engine', 'One AI layer'];

// Beat timings (local seconds).
const PIPE_IN = 3.0;
const SUITE_IN = 6.0;
const STEP0 = 10.6; // first journey step; one step per beat
const STEP = 0.5;
const STEPS = 8;
const SEP_IN = 15.3;
const SNAP = 17.25;
const EXIT = 19.55;

// ---------- Camera ----------

function journeySteps(t) {
  let s = 0;
  for (let k = 0; k < STEPS; k++) s += E.inOutCubic(prog(t, STEP0 + k * STEP, STEP0 + k * STEP + 0.36));
  return s;
}

function camera(t) {
  let yaw;
  // The active product sits just right of front (yaw +10) while the light carries her along.
  if (t < STEP0) yaw = keys(t, [[0, 74], [SUITE_IN - 0.4, 34, E.inOutCubic], [STEP0, 10, E.inOutCubic]]);
  else if (t < STEP0 + STEPS * STEP) yaw = 10 - 36 * journeySteps(t);
  else yaw = 10 - 36 * STEPS - (t - (STEP0 + STEPS * STEP)) * 6;
  const pull = E.inOutQuint(prog(t, 4.6, 7.0));
  // During the journey the ring slides left to make room for her activity feed.
  const feed = E.inOutQuint(prog(t, 9.2, 10.4)) * (1 - E.inOutQuint(prog(t, 15.1, 15.9)));
  // Pull back a touch while the products part, so nothing leaves the frame.
  const part = E.inOutCubic(prog(t, SEP_IN, SEP_IN + 0.8)) * (1 - E.inOutCubic(prog(t, SNAP - 0.1, SNAP + 0.5)));
  return {
    yaw,
    pitch: lerp(17, 20, pull),
    F: lerp(2450, 2000, pull) * lerp(1, 0.9, feed) * (1 - 0.14 * part) * (1 + 0.025 * Math.sin(t * 0.6)),
    D: 2100,
    cx: lerp(lerp(1250, 960, pull), 720, feed),
    cy: lerp(lerp(560, 640, pull), 655, feed) - 30 * part,
  };
}

function project(c, x, y, z) {
  const a = c.yaw * DEG, p = c.pitch * DEG;
  const x1 = x * Math.cos(a) - z * Math.sin(a);
  const z1 = x * Math.sin(a) + z * Math.cos(a);
  const depth = c.D + z1 * Math.cos(p) - y * Math.sin(p);
  const v = y * Math.cos(p) + z1 * Math.sin(p);
  const s = c.F / depth;
  return { x: c.cx + x1 * s, y: c.cy - v * s, s, depth };
}

const onRing = (r, aDeg, y = 0) => [r * Math.sin(aDeg * DEG), y, -r * Math.cos(aDeg * DEG)];

const focusBlur = (depth, c) => clamp((depth - c.D * 0.86) / 700, 0, 1) * 4.2;

// ---------- Build ----------

let root, svg, orbitIn, orbitOut, shock, trailWide, trailCore, core, coreGlow, coreRing, coreFlare, pulseHead, kavyaChip, pipeCard, topPill;
let caps = {};
const nodes = [];
const spokes = [];
const kernelChips = [];
const cards = [];
const connectors = [];

function makeNode(p, { size, color, sub, subColor, border }) {
  const el = h('div', { class: 'abs', style: { left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0' } });
  const inner = h('div', { class: 'abs', style: { left: '-110px', top: -size / 2 + 'px', width: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center' } });
  const t = tile(p.icon, color, size, Math.round(size * 0.46));
  t.style.boxShadow = `0 0 0 1px ${border || 'rgba(255,255,255,.14)'} inset, 0 14px 44px -10px color-mix(in srgb, ${color} 85%, transparent), 0 0 60px -12px color-mix(in srgb, ${color} 60%, transparent)`;
  const label = h('div', { style: { marginTop: '14px', fontSize: '21px', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap' } }, p.name);
  const subEl = sub ? h('div', { style: { marginTop: '4px', fontSize: '14px', fontWeight: 500, color: subColor, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' } }, sub) : null;
  inner.append(t, label);
  if (subEl) inner.append(subEl);
  el.append(inner);
  root.append(el);
  return { el, tileEl: t, subEl };
}

const FEED_X = 1372;
const FEED_Y = 372;
const FEED_GAP = 66;
function makeCard(p) {
  const el = h('div', { class: 'abs', style: { left: FEED_X + 'px', top: 0, width: '440px', transformOrigin: '0 50%', zIndex: 20000 } });
  const box = h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px 8px 8px', borderRadius: '13px', whiteSpace: 'nowrap',
    background: 'rgba(16,20,28,.88)', border: '1px solid rgba(255,255,255,.11)', boxShadow: '0 18px 40px -12px rgba(0,0,0,.7)' } },
  tile(p.icon, `var(--m-${p.id})`, 38, 19),
  h('div', {}, h('div', { style: { fontSize: '17px', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' } }, p.ev),
    h('div', { style: { fontSize: '13.5px', color: '#9aa6bf', marginTop: '1px' } }, `${p.name} · ${p.meta}`)));
  el.append(box);
  el.box = box;
  root.append(el);
  return el;
}

export default {
  id: 'roadmap',
  build(r) {
    // Flat on purpose: every position is projected by hand, so z-index (not 3D sorting) stacks things.
    root = h('div', { class: 'layer', style: { transformStyle: 'flat' } });
    r.append(root);

    svg = h('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080', class: 'abs', style: { left: 0, top: 0, overflow: 'visible', zIndex: 1 } });
    svg.innerHTML = `<defs>
      <radialGradient id="rm-dot"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#cfdaff" stop-opacity=".9"/><stop offset="1" stop-color="#5b7be5" stop-opacity="0"/></radialGradient>
    </defs>`;
    orbitIn = h('polyline', { fill: 'none', stroke: 'rgba(160,180,255,.22)', 'stroke-width': 1.5 });
    orbitOut = h('polyline', { fill: 'none', stroke: 'rgba(160,180,255,.2)', 'stroke-width': 1.5, 'stroke-dasharray': '2 7' });
    shock = h('polyline', { fill: 'none', stroke: 'rgba(200,215,255,.9)', 'stroke-width': 3 });
    svg.append(orbitIn, orbitOut, shock);
    OUTER.forEach((p) => {
      const line = h('line', { 'stroke-linecap': 'round', style: { stroke: `var(--m-${p.id})` } });
      const dot = h('circle', { r: 7, fill: 'url(#rm-dot)' });
      svg.append(line, dot);
      spokes.push({ line, dot });
    });
    trailWide = h('polyline', { fill: 'none', stroke: 'rgba(140,170,255,.28)', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    trailCore = h('polyline', { fill: 'none', stroke: '#e6ecff', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.append(trailWide, trailCore);
    OUTER.slice(0, 9).forEach(() => { const l = h('path', { fill: 'none', stroke: 'rgba(200,215,255,.75)', 'stroke-width': 1.6, 'stroke-dasharray': '3 5' }); svg.append(l); connectors.push(l); });
    root.append(svg);

    // The kernel: the mark inside a glowing disc.
    core = h('div', { class: 'abs', style: { left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0' } });
    coreGlow = h('div', { class: 'abs', style: { left: '-260px', top: '-260px', width: '520px', height: '520px', borderRadius: '50%', mixBlendMode: 'screen',
      background: 'radial-gradient(circle, rgba(140,165,255,.55) 0%, rgba(91,123,229,.25) 25%, rgba(35,86,201,0) 62%)' } });
    coreRing = h('div', { class: 'abs', style: { left: '-86px', top: '-86px', width: '172px', height: '172px', borderRadius: '50%',
      background: 'conic-gradient(from 0deg, rgba(91,123,229,0), rgba(154,133,234,.9), rgba(91,123,229,0) 40%, rgba(35,86,201,.9) 70%, rgba(91,123,229,0))',
      maskImage: 'radial-gradient(circle, transparent 62%, #000 64%, #000 70%, transparent 72%)', WebkitMaskImage: 'radial-gradient(circle, transparent 62%, #000 64%, #000 70%, transparent 72%)' } });
    const disc = h('div', { class: 'abs', style: { left: '-66px', top: '-66px', width: '132px', height: '132px', borderRadius: '50%', display: 'grid', placeItems: 'center',
      background: 'radial-gradient(circle at 50% 35%, #1d2436 0%, #0d1119 70%)', boxShadow: '0 0 0 1px rgba(160,180,255,.35), 0 0 60px rgba(91,123,229,.55), inset 0 0 30px rgba(91,123,229,.25)' } }, markSvg(64));
    coreFlare = h('div', { class: 'abs', style: { left: '-400px', top: '-400px', width: '800px', height: '800px', borderRadius: '50%', mixBlendMode: 'screen',
      background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(200,215,255,.6) 10%, rgba(91,123,229,.2) 30%, rgba(35,86,201,0) 60%)' } });
    core.append(coreGlow, coreRing, disc, coreFlare);
    root.append(core);

    INNER.forEach((p) => nodes.push({ p, ring: 'in', ...makeNode(p, { size: 84, color: p.color, sub: 'Shipping today', subColor: '#7fd9a5' }) }));
    OUTER.forEach((p, i) => {
      const isPipe = p.id === 'pipelines';
      const sub = isPipe
        ? `<span style="display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:12px;background:rgba(229,160,13,.16);color:#f2bf4c;font-size:13.5px;font-weight:600"><span style="width:7px;height:7px;border-radius:50%;background:#f2bf4c"></span>In progress</span>`
        : `<span style="width:6px;height:6px;border-radius:50%;background:#8b96ad"></span>Coming soon`;
      nodes.push({ p, ring: 'out', slot: i, ...makeNode(p, { size: 72, color: `var(--m-${p.id})`, sub, subColor: '#9aa6bf', border: isPipe ? 'rgba(255,255,255,.28)' : null }) });
    });

    KERNEL.forEach((k) => {
      const el = h('div', { class: 'abs', style: { left: 0, top: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 16px 0 12px', borderRadius: '19px',
        fontSize: '17px', fontWeight: 500, color: '#dfe6f5', background: 'rgba(20,26,38,.82)', border: '1px solid rgba(140,165,255,.28)', zIndex: 20000 } },
      icon('check', 16, 2.4, '#8fa6f2'), k);
      root.append(el);
      kernelChips.push(el);
    });

    pipeCard = h('div', { class: 'abs', style: { left: 0, top: 0, zIndex: 20000, padding: '14px 18px', borderRadius: '14px', background: 'rgba(16,20,28,.9)', border: '1px solid rgba(255,255,255,.12)', whiteSpace: 'nowrap', boxShadow: '0 18px 40px -12px rgba(0,0,0,.7)' } },
      h('div', { style: { fontSize: '13.5px', color: '#9aa6bf', fontWeight: 500 } }, 'Pipelines · CI/CD and environments'),
      h('div', { style: { fontSize: '19px', color: '#fff', fontWeight: 600, marginTop: '3px', letterSpacing: '-0.01em' } }, 'Build, release and promote to production'));
    root.append(pipeCard);

    OUTER.slice(0, 9).forEach((p) => cards.push(makeCard(p)));

    pulseHead = h('div', { class: 'abs', style: { left: 0, top: 0, width: 0, height: 0, zIndex: 5000 } });
    const glow = h('div', { class: 'abs', style: { left: '-46px', top: '-46px', width: '92px', height: '92px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,230,255,.85) 0%, rgba(91,123,229,.35) 40%, rgba(91,123,229,0) 70%)', mixBlendMode: 'screen' } });
    const av = avatar('KN', '#c2536a', 36);
    Object.assign(av.style, { position: 'absolute', left: '10px', top: '-62px', boxShadow: '0 0 0 2.5px #fff, 0 6px 16px rgba(0,0,0,.5)', fontSize: '14px' });
    pulseHead.append(glow, av);
    root.append(pulseHead);

    kavyaChip = h('div', { class: 'abs', style: { left: FEED_X + 'px', top: FEED_Y - 66 + 'px', zIndex: 20000, display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap', transformOrigin: '50% 50%' } },
      (() => { const a = avatar('KN', '#c2536a', 40); a.style.fontSize = '15px'; a.style.boxShadow = '0 0 0 2px rgba(255,255,255,.9)'; return a; })(),
      h('div', {}, h('div', { style: { fontSize: '19px', fontWeight: 600, color: '#fff' } }, 'Kavya Nair'), h('div', { style: { fontSize: '14px', color: '#9aa6bf' } }, 'Joins as a frontend engineer · one record, every product')));
    root.append(kavyaChip);

    topPill = h('div', { class: 'abs', style: { left: '960px', top: '58px', display: 'flex', alignItems: 'center', gap: '10px', height: '36px', padding: '0 16px', borderRadius: '18px', whiteSpace: 'nowrap',
      background: 'rgba(91,123,229,.14)', border: '1px solid rgba(143,166,242,.35)', color: '#c9d4f5', fontSize: '16px', fontWeight: 600, zIndex: 20000 } },
    h('span', { class: 'rm-dot', style: { width: '8px', height: '8px', borderRadius: '50%', background: '#8fa6f2' } }), 'On the roadmap · Coming soon');
    root.append(topPill);

    const top = { left: 160, top: 108, width: 1600, align: 'center', size: 58 };
    caps.c1 = caption({ eyebrow: "What's next", title: 'This is just the beginning.', sub: 'Work, Docs and AI ship today. The kernel under them is built to carry a whole company.', left: 120, top: 330, width: 660, size: 70 });
    caps.c2 = caption({ title: 'A whole company. One platform.', ...top });
    caps.c3 = caption({ title: 'Change it once. Every product knows.', ...top });
    caps.c4 = caption({ title: 'Use one. Or all of them.', sub: 'Each product stands on its own. Together they share one platform.', ...top });
    for (const c of Object.values(caps)) { c.el.style.zIndex = 20000; root.append(c.el); }
  },

  update(t) {
    const c = camera(t);
    const exit = E.inExpo(prog(t, EXIT, EXIT + 0.75));
    const sepK = E.inOutCubic(prog(t, SEP_IN, SEP_IN + 0.8));
    const snapK = spring(t - SNAP, { stiffness: 260, damping: 15 });
    const sep = sepK * (1 - snapK); // overshoots below zero: the snap
    const snapFlash = t > SNAP ? Math.exp(-(t - SNAP) * 3.2) : 0;
    const steps = journeySteps(t);

    // Core.
    const cp = project(c, 0, 0, 0);
    const coreK = spring(t - 0.05, { stiffness: 150, damping: 14 });
    const breathe = 1 + Math.sin(t * 2.4) * 0.03;
    tf(core, { x: cp.x, y: cp.y, s: cp.s * Math.max(0, coreK) * (1 - exit * 0.85) });
    css(core, 'z-index', Math.round(10000 - cp.depth));
    tf(coreGlow, { s: breathe * (1 + snapFlash * 0.8), o: ep(t, 0.1, 0.9, E.outCubic) });
    tf(coreRing, { rz: t * 70, o: ep(t, 0.4, 1.2, E.outCubic) });
    const flare = Math.max(1 - E.outCubic(prog(t, 0.05, 0.9)), snapFlash * 0.7, E.outCubic(prog(t, EXIT + 0.35, EXIT + 0.62)) * (1 - prog(t, EXIT + 0.62, 20.5)));
    tf(coreFlare, { s: 0.4 + flare * 0.9, o: flare });

    // Orbit guides.
    const ptsAt = (rad, n = 120) => {
      let s = '';
      for (let i = 0; i <= n; i++) { const q = project(c, ...onRing(rad, (i / n) * 360)); s += `${q.x.toFixed(1)},${q.y.toFixed(1)} `; }
      return s;
    };
    const inK = ep(t, 0.3, 1.6, E.outCubic) * (1 - exit);
    orbitIn.setAttribute('points', ptsAt(R_IN * lerp(0.6, 1, inK)));
    css(orbitIn, 'opacity', inK.toFixed(3));
    const outK = ep(t, PIPE_IN - 0.2, PIPE_IN + 1.4, E.outCubic) * (1 - exit);
    orbitOut.setAttribute('points', ptsAt(R_OUT * lerp(0.85, 1, outK) * (1 + sep * 0.22)));
    css(orbitOut, 'opacity', (outK * (1 - clamp(sep) * 0.6)).toFixed(3));

    // Shockwave on the snap.
    const sw = prog(t, SNAP + 0.02, SNAP + 1.1);
    if (sw > 0 && sw < 1) { shock.setAttribute('points', ptsAt(80 + E.outCubic(sw) * 900, 90)); css(shock, 'opacity', ((1 - sw) * 0.85).toFixed(3)); }
    else css(shock, 'opacity', '0');

    // Nodes.
    nodes.forEach((n, idx) => {
      let a, rad, y = 0, k, appear;
      if (n.ring === 'in') {
        appear = 0.45 + idx * 0.14;
        k = spring(t - appear, { stiffness: 160, damping: 14 });
        a = n.p.a; rad = R_IN * clamp(k, 0, 1.2);
      } else {
        a = n.slot * 36;
        const isPipe = n.p.id === 'pipelines';
        appear = isPipe ? PIPE_IN : SUITE_IN + n.slot * 0.14;
        k = spring(t - appear, { stiffness: isPipe ? 110 : 170, damping: isPipe ? 15 : 15 });
        const kk = clamp(k, 0, 1.3);
        rad = R_OUT + (1 - kk) * (isPipe ? 1100 : 320);
        y = (1 - kk) * (isPipe ? 520 : 300);
        // Products part (each stands alone) and snap back.
        rad += sep * (120 + 45 * Math.sin(n.slot * 1.7));
        y += sep * (Math.sin(t * 2.1 + n.slot * 1.3) * 26 + 40 + 24 * Math.sin(n.slot * 2.3));
      }
      rad *= 1 - exit;
      const q = project(c, ...onRing(rad, a, y));
      // The active journey tile lifts and glows.
      let lift = 0;
      if (n.ring === 'out' && n.slot < 9) {
        const arrive = n.slot === 0 ? STEP0 - 0.25 : STEP0 + (n.slot - 1) * STEP + 0.3;
        const d = t - arrive;
        if (d > 0) lift = Math.exp(-d * 2.6) * Math.min(1, d * 12);
      }
      const scale = q.s * Math.max(0, Math.min(k, 1.15)) * (1 - exit * 0.7) * (1 + lift * 0.18);
      const o = prog(t, appear, appear + 0.2) * lerp(0.62, 1, clamp(1.6 - q.depth / c.D * 0.75 - 0.45, 0, 1)) * (1 - prog(t, EXIT + 0.4, EXIT + 0.7));
      tf(n.el, { x: q.x, y: q.y, s: scale, o, blur: focusBlur(q.depth, c) });
      css(n.el, 'z-index', Math.round(10000 - q.depth));
      if (lift > 0.01 || snapFlash > 0.01) tf(n.tileEl, { bright: 1 + lift * 0.5 + snapFlash * 0.35 });
      else tf(n.tileEl, {});
      n.q = q; n.k = k;
    });

    // Spokes from the kernel, with light travelling outward.
    const spokeVis = (1 - clamp(sep * 1.3)) * (1 - exit);
    OUTER.forEach((p, i) => {
      const n = nodes[INNER.length + i];
      const isPipe = p.id === 'pipelines';
      const appear = isPipe ? PIPE_IN : SUITE_IN + i * 0.14;
      const draw = E.outExpo(prog(t, appear + 0.25, appear + 1.0));
      const { line, dot } = spokes[i];
      const ex = lerp(cp.x, n.q.x, draw), ey = lerp(cp.y, n.q.y, draw);
      line.setAttribute('x1', cp.x.toFixed(1)); line.setAttribute('y1', cp.y.toFixed(1));
      line.setAttribute('x2', ex.toFixed(1)); line.setAttribute('y2', ey.toFixed(1));
      line.setAttribute('stroke-width', (1.6 + snapFlash * 2.5).toFixed(2));
      css(line, 'opacity', (draw * spokeVis * (0.42 + snapFlash * 0.5)).toFixed(3));
      const ph = (t * 0.55 + i * 0.137) % 1;
      const burst = t > SNAP ? clamp((t - SNAP) / 0.7) : -1;
      const f = burst >= 0 && burst < 1 ? E.outCubic(burst) : ph;
      dot.setAttribute('cx', lerp(cp.x, n.q.x, f).toFixed(1));
      dot.setAttribute('cy', lerp(cp.y, n.q.y, f).toFixed(1));
      dot.setAttribute('r', (5 + 5 * n.q.s).toFixed(1));
      css(dot, 'opacity', (draw * spokeVis * Math.sin(f * Math.PI) * (burst >= 0 && burst < 1 ? 1 : 0.85)).toFixed(3));
    });

    // Kernel chips: a 2 × 2 under the core, then absorbed into it.
    kernelChips.forEach((el, i) => {
      const appear = 1.15 + i * 0.13;
      const k = spring(t - appear, { stiffness: 200, damping: 18 });
      const bx = 120 + (i % 2) * 262;
      const by = 690 + (i < 2 ? 0 : 52);
      const ab = E.inBack(prog(t, 4.9 + i * 0.05, 5.55 + i * 0.05), 1.4);
      const x = lerp(bx, cp.x - el.offsetWidth / 2, ab), y = lerp(by + (1 - k) * 30, cp.y - 19, ab);
      tf(el, { x, y, s: lerp(1, 0.2, ab), o: clamp(k) * (1 - prog(t, 5.3 + i * 0.05, 5.55 + i * 0.05)) });
    });

    // Pipelines detail card.
    const pn = nodes[INNER.length + 9];
    const pc = spring(t - (PIPE_IN + 0.85), { stiffness: 200, damping: 18 });
    const pOut = E.inCubic(prog(t, 5.4, 5.8));
    tf(pipeCard, { x: pn.q.x - 70 * pn.q.s - 18 - pipeCard.offsetWidth, y: pn.q.y - 40 + (1 - pc) * 18, s: 0.92 + 0.08 * clamp(pc), o: clamp(pc) * (1 - pOut) });

    // The journey: a light carries Kavya from product to product along the ring.
    const jOn = prog(t, STEP0 - 0.5, STEP0 - 0.2) * (1 - prog(t, 15.1, 15.5));
    if (jOn > 0) {
      const aHead = 36 * steps;
      tf(pulseHead, { ...(() => { const q = project(c, ...onRing(R_OUT, aHead, 0)); return { x: q.x, y: q.y - 4, s: q.s * (0.9 + 0.1 * Math.sin(t * 9)) }; })(), o: jOn });
      css(pulseHead, 'z-index', 20001);
      const tail = Math.max(0, aHead - 120);
      let s = '';
      const nPts = Math.max(2, Math.ceil((aHead - tail) / 3));
      for (let i = 0; i <= nPts; i++) { const q = project(c, ...onRing(R_OUT, lerp(tail, aHead, i / nPts))); s += `${q.x.toFixed(1)},${q.y.toFixed(1)} `; }
      trailWide.setAttribute('points', s); trailCore.setAttribute('points', s);
      css(trailWide, 'opacity', (jOn * 0.9).toFixed(3)); css(trailCore, 'opacity', jOn.toFixed(3));
    } else {
      tf(pulseHead, { o: 0 });
      css(trailWide, 'opacity', '0'); css(trailCore, 'opacity', '0');
    }

    // Her activity feed: one card per product as the light arrives, linked to its tile for a beat.
    cards.forEach((el, i) => {
      const n = nodes[INNER.length + i];
      const arrive = i === 0 ? STEP0 - 0.2 : STEP0 + (i - 1) * STEP + 0.3;
      const k = spring(t - arrive, { stiffness: 230, damping: 18 });
      const out = prog(t, 15.05 + i * 0.025, 15.4 + i * 0.025);
      const age = t - arrive;
      const o = clamp(k * 1.5) * (1 - out);
      const cy = FEED_Y + i * FEED_GAP;
      tf(el, { x: (1 - clamp(k, 0, 1.2)) * 60, y: cy, o, s: 1 });
      tf(el.box, { bright: 1 + Math.exp(-Math.max(0, age) * 3) * 0.25 * (age > 0 ? 1 : 0) });
      const line = connectors[i];
      const lo = age > 0 ? Math.min(1, age * 8) * (1 - prog(age, 0.55, 0.95)) : 0;
      if (lo > 0.01 && n.q) {
        const x0 = n.q.x + 40 * n.q.s, y0 = n.q.y, x1 = FEED_X - 6, y1 = cy + 28;
        const mx = (x0 + x1) / 2;
        line.setAttribute('d', `M${x0.toFixed(1)},${y0.toFixed(1)} C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`);
        css(line, 'opacity', lo.toFixed(3));
      } else css(line, 'opacity', '0');
    });

    // Kavya's name under the caption.
    const kc = spring(t - (STEP0 - 0.6), { stiffness: 200, damping: 18 });
    tf(kavyaChip, { x: (1 - clamp(kc)) * 40, o: clamp(kc) * (1 - prog(t, 15.0, 15.35)) });

    // Top pill: on from the suite's arrival to the end.
    const tp = spring(t - (SUITE_IN - 0.2), { stiffness: 200, damping: 18 });
    tf(topPill, { x: -topPill.offsetWidth / 2, y: (1 - tp) * -12, o: clamp(tp) * (1 - prog(t, 19.2, 19.6)) });
    const dot = topPill.firstChild;
    tf(dot, { s: 1 + 0.35 * Math.max(0, Math.sin(t * Math.PI * 2)), o: 0.7 + 0.3 * Math.sin(t * Math.PI * 2) });

    caps.c1.update(t, 0.35, 5.0);
    caps.c2.update(t, SUITE_IN - 0.1, 9.5);
    caps.c3.update(t, 9.85, 14.95);
    caps.c4.update(t, SEP_IN + 0.05, 19.25);

    tf(root, { o: 1 - prog(t, 20.15, 20.5) });
  },
};
