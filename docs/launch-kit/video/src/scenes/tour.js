// Scenes 4–6, one continuous take: Work (board, roadmap, automation), Docs, then AI.
// Local t runs 0 → 38.5 (film 25.0 → 63.5).
import { h, tf, keys, spring, E, ep, prog, css, text, clamp, lerp, window01 } from '../engine.js';
import { appWindow, cursor, caption, icon, tile, statusGlyph } from '../components.js';
import { workHeader, board, roadmap, docPage, askPanel, CARD_STEP, typing, typedCount, ANSWER, LABEL_W } from './tour-views.js';

const WIN_W = 1440, WIN_H = 860;

// Camera: the window's centre on screen (cx, cy), its scale and tilt. F() frames a window point.
const F = (fx, fy, s, sx = 960, sy = 540, rx = 0, ry = 0) => [sx - s * (fx - WIN_W / 2), sy - s * (fy - WIN_H / 2), s, rx, ry];
const CAM = [
  [0, [1300, 545, 0.74, 18, -26]],
  [1.7, [1300, 545, 0.74, 5, -9], E.outCubic],
  [3.5, [1292, 545, 0.76, 0, -2], E.inOutCubic],
  [4.9, F(1137, 300, 1.85, 1270, 520), E.inOutQuint],
  [6.9, F(1165, 300, 1.88, 1320, 520), E.inOutCubic],
  [8.2, [960, 560, 0.92, 0, 0], E.inOutQuint],
  [9.3, [952, 556, 0.94, 0, 0], E.inOutCubic],
  [10.5, F(780, 290, 1.55, 980, 540), E.inOutQuint],
  [12.6, F(805, 300, 1.59, 960, 540), E.inOutCubic],
  [13.8, [700, 565, 0.68, 2, 13], E.inOutQuint],
  [16.0, [688, 556, 0.69, 1, 10], E.inOutCubic],
  [17.3, [1300, 545, 0.74, 0, -4], E.inOutQuint],
  [21.0, [1296, 545, 0.765, 0, 0], E.inOutCubic],
  [22.2, F(800, 520, 1.5, 940, 540), E.inOutQuint],
  [24.1, F(822, 526, 1.52, 930, 540), E.inOutCubic],
  [25.1, F(1050, 605, 1.45, 960, 540), E.inOutCubic],
  [27.1, F(1062, 600, 1.47, 948, 540), E.inOutCubic],
  [28.3, [1300, 545, 0.74, 0, -3], E.inOutQuint],
  [33.0, [1290, 545, 0.775, 0, 0], E.inOutCubic],
  [34.3, F(844, 425, 1.32, 960, 540), E.inOutQuint],
  [36.3, F(846, 432, 1.36, 960, 540), E.inOutCubic],
  [37.5, [960, 545, 0.9, 0, 0], E.inOutQuint],
  [38.5, [960, 545, 0.86, 0, 0], E.inOutCubic],
];

let flat, cam, glow, win, header, bd, rm, doc, ask, cur, capWork, capAuto, capDocs, capAi, autoCard, hookCard, auto, hook;
let marks = null; // UI positions measured once, after the first layout.

/** Offset of el inside ancestor, ignoring transforms (layout only, so it never changes with t). */
function offsetIn(el, anc) {
  let x = 0, y = 0, n = el;
  while (n && n !== anc) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return [x + el.offsetWidth / 2, y + el.offsetHeight / 2];
}

/** perspective() inside the transform, so the 3D planes never share one context (no plane splitting). */
function persp(el, { x = 0, y = 0, z = 0, s = 1, rx = 0, ry = 0, rz = 0, o = 1, blur = 0 }) {
  el.style.transform = `perspective(2200px) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotate(${rz.toFixed(3)}deg) scale(${s.toFixed(4)})`;
  el.style.opacity = clamp(o).toFixed(3);
  el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
}

// ---------- Automation and webhook cards (screen space, beside the window) ----------

function buildAutomation() {
  const node = (ic, color, kind, label) => {
    const ring = h('div', { class: 'abs', style: { inset: '-5px', borderRadius: '12px', border: `2px solid ${color}`, opacity: 0 } });
    const t = h('div', { style: { position: 'relative', width: '38px', height: '38px', borderRadius: '10px', background: color, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' } }, ring, icon(ic, 19));
    const el = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', height: '62px' } }, t,
      h('div', {}, h('div', { style: { fontSize: '12px', color: 'var(--tx-3)', fontWeight: 500 } }, kind), h('div', { style: { fontSize: '16px', fontWeight: 600, color: 'var(--tx)' } }, label)));
    return { el, ring, t };
  };
  const n1 = node('circle-check', 'var(--done)', 'When', 'An issue moves to Done');
  const n2 = node('bell', 'var(--acc-fill)', 'Then', 'Notify the reporter');
  const n3 = node('list-checks', 'var(--brand-2)', 'And', 'Close linked doc tasks');
  const line = h('div', { class: 'abs', style: { left: '19px', top: '50px', width: '2px', height: '124px', background: 'var(--line)' } });
  const pulse = h('div', { class: 'abs', style: { left: '14px', top: '44px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--acc)', boxShadow: '0 0 0 5px rgba(35,86,201,.18)' } });
  const flow = h('div', { style: { position: 'relative', padding: '4px 0' } }, line, pulse, n1.el, n2.el, n3.el);
  const toggle = h('div', { style: { width: '34px', height: '20px', borderRadius: '10px', background: 'var(--acc-fill)', position: 'relative' } }, h('div', { class: 'abs', style: { right: '2px', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff' } }));
  const ran = h('span', {}, 'Just ran for PLT-204 · 2 actions');
  const el = h('div', { class: 'abs ui-light', style: { left: '1080px', top: '300px', width: '560px', background: 'var(--card)', color: 'var(--tx)', borderRadius: '14px', padding: '18px 22px 16px', boxShadow: '0 0 0 1px rgba(255,255,255,.1), 0 40px 90px -20px rgba(0,0,0,.6)' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } }, tile('zap', 'var(--acc-fill)', 28, 15), h('b', { style: { fontSize: '15px', fontWeight: 600 } }, 'Automation rule'), h('span', { style: { fontSize: '13px', color: 'var(--tx-3)' } }, '· Platform Core'), h('div', { style: { flex: 1 } }), toggle),
    flow,
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line-2)', fontSize: '13px', color: 'var(--tx-2)' } }, statusGlyph('done', 14), ran));
  return { el, nodes: [n1, n2, n3], pulse, ran };
}

function buildWebhook() {
  const sig = h('span', { class: 'mono' });
  const ok = h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '24px', padding: '0 9px', borderRadius: '12px', background: 'rgba(63,182,122,.16)', color: '#3fb67a', fontSize: '12.5px', fontWeight: 600 } }, statusGlyph('done', 12), '200 OK · 84 ms');
  const el = h('div', { class: 'abs ui-dark', style: { left: '1160px', top: '690px', width: '540px', background: 'var(--card)', color: 'var(--tx)', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 0 0 1px rgba(255,255,255,.1), 0 40px 90px -20px rgba(0,0,0,.7)', fontSize: '13px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } }, tile('webhook', '#27272a', 28, 15), h('b', { style: { fontSize: '15px', fontWeight: 600 } }, 'Outgoing webhook'), h('div', { style: { flex: 1 } }), ok),
    h('div', { class: 'mono', style: { color: 'var(--tx-2)', lineHeight: '22px', fontSize: '13px' } },
      h('div', {}, h('span', { style: { color: '#7b95ec' } }, 'POST '), 'https://hooks.acmelabs.dev/bemmoly'),
      h('div', {}, h('span', { style: { color: 'var(--tx-3)' } }, 'signature  '), sig)),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', marginTop: '10px', color: 'var(--tx-3)', fontSize: '12.5px' } }, icon('lock', 13), 'Signed with HMAC-SHA256'));
  return { el, sig, ok };
}

export default {
  id: 'tour',
  build(root) {
    flat = h('div', { class: 'abs', style: { inset: 0, transformStyle: 'flat' } });

    cam = h('div', { class: 'abs will', style: { left: (1920 - WIN_W) / 2 + 'px', top: (1080 - WIN_H) / 2 + 'px', width: WIN_W + 'px', height: WIN_H + 'px', transformOrigin: '50% 50%' } });
    glow = h('div', { class: 'abs', style: { inset: 0, borderRadius: '14px', boxShadow: '0 0 0 2px rgba(154,133,234,.65), 0 0 80px 8px rgba(154,133,234,.45), 0 0 220px 40px rgba(154,133,234,.18)', opacity: 0 } });
    win = appWindow({
      w: WIN_W, h: WIN_H, active: 'Board',
      nav: [
        { section: 'Work' },
        { label: 'Platform Core', tileColor: '#2f9e6e' },
        { icon: 'square-kanban', label: 'Board', indent: 18 },
        { icon: 'list-todo', label: 'Backlog', indent: 18 },
        { icon: 'milestone', label: 'Roadmap', indent: 18 },
        { icon: 'zap', label: 'Automation', indent: 18 },
        { label: 'Mobile App', tileColor: '#d46a2e' },
        { label: 'Support Desk', tileColor: '#0e9bb0' },
        { section: 'Docs' },
        { label: 'Engineering', tileColor: '#0e9bb0' },
        { icon: 'file-text', label: 'RFC: Move sessions to…', indent: 18, id: 'rfc' },
        { icon: 'file-text', label: 'On-call handbook', indent: 18 },
        { label: 'Product', tileColor: '#9b4f96' },
      ],
    });
    win.el.style.left = '0'; win.el.style.top = '0';
    header = workHeader();
    bd = board();
    rm = roadmap();
    doc = docPage();
    ask = askPanel();
    win.content.append(bd.el, rm.el, header.el, doc.el, ask.scrim, ask.el);
    cur = cursor();
    cam.append(glow, win.el, cur.el);

    capWork = caption({ eyebrow: 'Work', tileIcon: 'square-kanban', tileColor: 'var(--m-work)', title: 'Plan it. Ship it. See it coming.', sub: 'Boards, sprints, a roadmap that forecasts from your team’s own pace, and automation.', left: 112, top: 336, width: 600, size: 62 });
    capAuto = caption({ eyebrow: 'Automation', tileIcon: 'zap', tileColor: 'var(--m-work)', title: 'Rules that run themselves.', left: 1080, top: 120, width: 720, size: 52 });
    capDocs = caption({ eyebrow: 'Docs', tileIcon: 'file-text', tileColor: 'var(--m-docs)', title: 'Pages that live next to the work.', sub: 'Real-time editing, revisions, comments and live issue links.', left: 112, top: 350, width: 600, size: 62 });
    capAi = caption({ eyebrow: 'AI, on your terms', tileIcon: 'sparkles', tileColor: 'var(--ai)', title: 'Off until you turn it on.', sub: 'Bring your own provider, or a model on your own network. Answers cite their sources.', left: 112, top: 350, width: 600, size: 62 });

    auto = buildAutomation(); hook = buildWebhook();
    autoCard = auto.el; hookCard = hook.el;
    flat.append(cam, autoCard, hookCard, capWork.el, capAuto.el, capDocs.el, capAi.el);
    root.append(flat);
  },

  update(t) {
    if (!marks && win.el.offsetWidth) {
      const tab = offsetIn(header.tabs.Roadmap, win.el);
      const rfc = offsetIn(win.navEls.rfc, win.el);
      const askB = offsetIn(doc.askBtn, win.el);
      marks = { tab, rfc: [rfc[0] - 30, rfc[1]], ask: askB };
    }
    const M = marks || { tab: [662, 66], rfc: [120, 560], ask: [1238, 66] };

    // ----- Camera -----
    const [cx, cy, s, rx, ry] = keys(t, CAM);
    const arrive = E.outExpo(prog(t, 0.15, 1.9));
    const exit = E.inOutCubic(prog(t, 37.9, 38.5));
    persp(cam, { x: cx - 960, y: cy - 540, z: lerp(-1900, 0, arrive), s: s * (1 - exit * 0.1), rx, ry, o: prog(t, 0.15, 0.6) * (1 - exit), blur: (1 - E.outCubic(prog(t, 0.15, 1.4))) * 22 + exit * 14 });
    tf(glow, { o: ep(t, 28.6, 29.8, E.inOutCubic) * (0.85 + Math.sin(t * 2.4) * 0.15) });

    // ----- Captions -----
    capWork.update(t, 0.9, 3.75);
    capAuto.update(t, 13.55, 16.55);
    capDocs.update(t, 17.55, 21.0);
    capAi.update(t, 29.15, 33.0);

    // ----- Views: which one shows -----
    const toRm = ep(t, 8.62, 9.05, E.outCubic), toDoc = ep(t, 16.92, 17.45, E.outCubic);
    tf(bd.el, { x: -30 * toRm, o: (1 - toRm) });
    tf(rm.el, { x: 30 * (1 - ep(t, 8.68, 9.15, E.outCubic)), o: ep(t, 8.68, 9.05, E.outCubic) * (1 - toDoc) });
    tf(header.el, { o: 1 - toDoc });
    tf(doc.el, { y: 16 * (1 - ep(t, 16.98, 17.6, E.outCubic)), o: ep(t, 16.98, 17.45, E.outCubic) });
    header.setTab(t < 8.6 ? 'Board' : 'Roadmap');
    win.setActive(t < 8.6 ? 'Board' : t < 16.88 ? 'Roadmap' : 'rfc');

    // ----- Cursor -----
    const P = [
      [4.35, 1250, 650], [5.25, 1000, 236], [5.55, 1000, 236], [6.15, 1146, 214], [6.75, 1292, 236], [6.98, 1292, 238],
      [7.7, 1080, 300], [8.45, M.tab[0], M.tab[1] + 2], [8.8, M.tab[0] + 6, M.tab[1] + 4], [9.7, 760, 430], [11.2, 690, 372], [12.7, 760, 392],
      [15.85, 720, 610], [16.75, M.rfc[0], M.rfc[1]], [17.3, M.rfc[0] + 26, M.rfc[1] + 46],
      [28.2, 1040, 430], [29.1, M.ask[0], M.ask[1] + 2], [29.7, M.ask[0] - 24, M.ask[1] + 60],
    ];
    let px = P[0][1], py = P[0][2];
    for (let i = 1; i < P.length; i++) {
      if (t <= P[i - 1][0]) break;
      const k = E.inOutCubic(prog(t, P[i - 1][0], P[i][0]));
      px = lerp(P[i - 1][1], P[i][1], k); py = lerp(P[i - 1][2], P[i][2], k);
    }
    const co = Math.max(window01(t, 4.35, 12.9, 0.3, 0.35), window01(t, 15.85, 17.7, 0.3, 0.35), window01(t, 28.2, 29.95, 0.3, 0.35));
    cur.update(t, [[0, px, py]], [5.42, 6.86, 8.58, 16.86, 29.2], { o: co });

    // ----- Board: drag PLT-204 from In review to Done -----
    const lift = spring(t - 5.4, { stiffness: 260, damping: 20 });
    const settle = spring(t - 6.82, { stiffness: 320, damping: 17 });
    const L = t < 6.82 ? clamp(lift, 0, 1.2) : 1 - settle;
    const dx = t < 5.55 ? 0 : (t < 6.82 ? px - 1000 : 292);
    const dy = t < 5.55 ? 0 : (t < 6.82 ? py - 236 : 0);
    const lean = t > 5.55 && t < 6.9 ? Math.sin(Math.PI * prog(t, 5.55, 6.85)) * 3.2 : 0;
    tf(bd.drag, { x: dx, y: dy - 6 * Math.max(0, L), s: 1 + 0.045 * L, rz: 2 * L + lean });
    css(bd.drag, 'box-shadow', `0 0 0 1px rgba(35,86,201,${(0.28 * clamp(L)).toFixed(3)}), 0 ${(1 + 24 * clamp(L)).toFixed(1)}px ${(3 + 46 * clamp(L)).toFixed(1)}px -12px rgba(16,24,40,${(0.08 + 0.32 * clamp(L)).toFixed(3)}), 0 1px 2px rgba(16,24,40,.06)`);
    const tick = spring(t - 6.95, { stiffness: 300, damping: 16 });
    tf(bd.doneTick, { s: Math.max(0, tick), o: prog(t, 6.95, 7.05) });
    const up = spring(t - 5.7, { stiffness: 200, damping: 22 });
    bd.cards[2].slice(1).forEach((c) => tf(c, { y: -CARD_STEP * up }));
    const down = spring(t - 6.15, { stiffness: 200, damping: 21 });
    bd.cards[3].forEach((c) => tf(c, { y: CARD_STEP * down }));
    bd.counts[2].update(t, 5.65, 3, 2);
    bd.counts[3].update(t, 6.86, 5, 6);
    const hot = window01(t, 6.1, 6.95, 0.2, 0.15);
    css(bd.cols[3], 'background', hot > 0.01 ? `color-mix(in srgb, var(--acc-50) ${Math.round(hot * 100)}%, var(--sunken))` : 'var(--sunken)');
    css(bd.cols[3], 'border-color', hot > 0.01 ? `rgba(35,86,201,${(0.45 * hot).toFixed(3)})` : 'transparent');
    css(bd.cols[3], 'border-style', 'dashed');

    // ----- Roadmap -----
    rm.bars.forEach((b, i) => {
      const g = E.outExpo(prog(t, 9.0 + i * 0.09, 10.0 + i * 0.09));
      css(b, 'clip-path', `inset(-4px ${((1 - g) * 100).toFixed(2)}% -4px -10px)`);
    });
    rm.rows.forEach((r, i) => tf(r, { x: -12 * (1 - ep(t, 8.9 + i * 0.06, 9.6 + i * 0.06)), o: ep(t, 8.9 + i * 0.06, 9.4 + i * 0.06) }));
    tf(rm.today, { sy: ep(t, 9.5, 10.2, E.outExpo), o: prog(t, 9.5, 9.6) });
    const bn = ep(t, 10.75, 11.3, E.outCubic);
    tf(rm.banner, { y: -12 * (1 - bn), o: bn });
    tf(rm.grid, { y: 50 * ep(t, 10.65, 11.2, E.inOutCubic) });
    css(rm.forecast, 'clip-path', `inset(-3px ${((1 - ep(t, 11.4, 12.0, E.outCubic)) * 100).toFixed(2)}% -3px 0)`);
    tf(rm.forecastLbl, { x: -8 * (1 - ep(t, 11.85, 12.3)), o: ep(t, 11.85, 12.2) });
    rm.dep.setAttribute('stroke-dashoffset', (120 * (1 - ep(t, 12.0, 12.55, E.inOutCubic))).toFixed(1));
    tf(rm.depDot, { o: prog(t, 11.95, 12.05) });

    // ----- Automation and webhook cards -----
    const a = spring(t - 13.25, { stiffness: 120, damping: 18 });
    const ax = 1 - E.inCubic(prog(t, 16.4, 17.0));
    persp(autoCard, { x: 120 * (1 - a), z: -500 * (1 - a) - 300 * (1 - ax), ry: -10 - 24 * (1 - a), rx: 4 * (1 - a), o: prog(t, 13.25, 13.55) * ax, blur: (1 - clamp(a)) * 10 + (1 - ax) * 10 });
    const w = spring(t - 13.95, { stiffness: 120, damping: 18 });
    persp(hookCard, { x: 120 * (1 - w), y: 30 * (1 - w), z: -500 * (1 - w) - 300 * (1 - ax), ry: -10 - 24 * (1 - w), rx: 4 * (1 - w), o: prog(t, 13.95, 14.25) * ax, blur: (1 - clamp(w)) * 10 + (1 - ax) * 10 });
    const pulseK = ep(t, 14.15, 15.35, E.inOutCubic);
    tf(auto.pulse, { y: 124 * pulseK, o: window01(t, 14.1, 15.6, 0.1, 0.25) });
    auto.nodes.forEach((n, i) => {
      const at = 14.15 + i * 0.6;
      const r = prog(t, at, at + 0.7);
      tf(n.ring, { s: 1 + r * 0.25, o: r > 0 ? 1 - r : 0 });
      tf(n.t, { s: 1 + 0.12 * Math.sin(Math.PI * prog(t, at - 0.05, at + 0.3)) });
    });
    tf(auto.ran, { o: ep(t, 15.4, 15.8) });
    const SIG = 'sha256=9f2c41e8…b07de41a';
    text(hook.sig, SIG.slice(0, Math.round(SIG.length * prog(t, 14.6, 15.3))));
    tf(hook.ok, { s: Math.max(0, spring(t - 15.45, { stiffness: 300, damping: 16 })), o: prog(t, 15.45, 15.55) });

    // ----- Docs: two people write at once -----
    const P1 = 'Sessions live in a Redis cluster today, so a cache eviction signs people out. Postgres keeps them durable and lets us query them for audit.';
    const p1Times = typing(P1, 17.85, 36, 11);
    text(doc.p1Text, P1.slice(0, typedCount(p1Times, t)));
    const SEG = ['Dual-write behind ', 'auth_pg_sessions', ' in ', 'PLT-211'];
    const L1 = SEG.join('');
    const l1Times = typing(L1, 18.95, 21, 57);
    let n = typedCount(l1Times, t);
    const chipT = l1Times[l1Times.length - 1] + 0.25;
    const parts = SEG.map((sg) => { const k = Math.max(0, Math.min(sg.length, n)); n -= sg.length; return sg.slice(0, k); });
    text(doc.l1Text, parts[0]);
    text(doc.l1Code, parts[1]);
    css(doc.l1Code, 'display', parts[1] ? 'inline' : 'none');
    text(doc.l1After, parts[2]);
    const chipK = spring(t - chipT, { stiffness: 260, damping: 18 });
    text(doc.l1Key, t < chipT ? parts[3] : '');
    css(doc.chip.el, 'display', t < chipT ? 'none' : 'inline-flex');
    tf(doc.chip.el, { s: 0.7 + 0.3 * chipK, o: prog(t, chipT, chipT + 0.12) });
    const flip = ep(t, chipT + 1.1, chipT + 1.45, E.outCubic);
    tf(doc.chip.gProg, { o: 1 - flip, s: 1 - flip * 0.4 });
    tf(doc.chip.gDone, { o: flip, s: 0.6 + 0.4 * Math.max(0, spring(t - chipT - 1.1, { stiffness: 300, damping: 15 })) });
    tf(doc.chip.lProg, { y: -18 * flip, o: 1 - flip });
    tf(doc.chip.lDone, { y: 18 * (1 - flip), o: flip });
    css(doc.chip.label, 'width', (LABEL_W.prog + (LABEL_W.done - LABEL_W.prog) * flip).toFixed(2) + 'px');
    const ping = prog(t, chipT + 1.15, chipT + 1.95);
    tf(doc.chip.ping, { s: 0.6 + ping * 1.1, o: ping > 0 ? 1 - ping : 0 });
    // Carets: Priya writes the paragraph, then edits the plan; Daniel writes item 1.
    tf(doc.p1Caret, { o: window01(t, 17.6, 26.25, 0.2, 0.2) });
    tf(doc.p1Caret.lastChild, { o: 1 - ep(t, p1Times[p1Times.length - 1] + 0.7, p1Times[p1Times.length - 1] + 1.0) });
    tf(doc.l1Caret, { o: window01(t, 18.75, 24.9, 0.2, 0.3) });
    tf(doc.l3Caret, { o: window01(t, 26.25, 28.6, 0.2, 0.3) });
    // Comment and the edit it asks for.
    tf(doc.hlBg, { sx: ep(t, 24.65, 25.1, E.outCubic) });
    const c = ep(t, 24.9, 25.5, E.outExpo);
    tf(doc.comment, { x: 30 * (1 - c), o: c });
    const r = ep(t, 25.85, 26.3, E.outCubic);
    tf(doc.reply, { y: 8 * (1 - r), o: r });
    text(doc.days, t < 26.75 ? '7' : t < 26.88 ? '1' : '14');
    css(doc.days, 'background', t > 26.45 && t < 26.75 ? 'rgba(214,69,122,.25)' : 'transparent');
    text(doc.saved, t < 27.05 ? 'Saved · revision 14' : 'Saved · revision 15');

    // ----- AI: ask, and an answer with sources -----
    const open = spring(t - 29.3, { stiffness: 220, damping: 22 });
    tf(ask.scrim, { o: ep(t, 29.3, 29.7, E.outCubic) });
    tf(ask.el, { y: 14 * (1 - open), s: 0.965 + 0.035 * open, o: prog(t, 29.3, 29.5) });
    const Q = 'What did we ship this sprint?';
    const qTimes = typing(Q, 29.8, 24, 91);
    const qn = typedCount(qTimes, t);
    text(ask.qText, Q.slice(0, qn));
    tf(ask.qCaret, { o: t < 29.4 ? 0 : t > 31.45 ? 0 : (t - (qn ? qTimes[qn - 1] : 29.8) > 0.35 ? (Math.floor(t * 2.4) % 2 ? 0.15 : 1) : 1) });
    const press = Math.sin(Math.PI * prog(t, 31.3, 31.5));
    tf(ask.enter, { s: 1 - press * 0.08 });
    css(ask.enter, 'background', press > 0.05 ? 'var(--ai-100)' : 'var(--ai-50)');
    css(ask.thinking, 'background-position', `${(-50 + 250 * prog(t, 31.45, 32.05)).toFixed(1)}% 0`);
    tf(ask.thinking, { o: window01(t, 31.45, 32.1, 0.1, 0.15) });
    tf(ask.ansHead, { o: ep(t, 31.95, 32.25), y: 6 * (1 - ep(t, 31.95, 32.35)) });
    if (!ask.geo && ask.el.offsetWidth) {
      const lines = [];
      ask.tokens.forEach((tok, i) => { const top = tok.offsetTop; if (!lines.length || top > lines[lines.length - 1][0] + 4) lines.push([top, i]); });
      ask.geo = { q: ask.thinking.offsetTop + 4, head: ask.ans.offsetTop, lines: lines.map(([, i]) => i), lineH: 27, tail: ask.srcWrap.offsetHeight + ask.actions.offsetHeight + 4 };
    }
    if (ask.geo) {
      const g = ask.geo;
      let hh = g.q + (g.head - g.q) * ep(t, 31.95, 32.3, E.outCubic);
      for (const i of g.lines) { const at = 32.05 + i * 0.05; hh += g.lineH * ep(t, at - 0.05, at + 0.3, E.outCubic); }
      hh += 4 + g.tail * ep(t, 34.95, 35.55, E.inOutCubic);
      css(ask.el, 'height', hh.toFixed(1) + 'px');
    }
    ask.tokens.forEach((tok, i) => {
      const at = 32.05 + i * 0.05;
      const k = E.outCubic(prog(t, at, at + 0.28));
      const isCite = typeof ANSWER[i] === 'object';
      tf(tok, isCite ? { s: 0.5 + 0.5 * Math.max(0, spring(t - at, { stiffness: 320, damping: 16 })), o: k } : { y: 6 * (1 - k), o: k, blur: (1 - k) * 4 });
    });
    ask.sources.forEach((sr, i) => {
      const k = ep(t, 35.05 + i * 0.09, 35.6 + i * 0.09, E.outExpo);
      tf(sr, { y: 14 * (1 - k), o: k });
    });
    tf(ask.actions, { o: ep(t, 35.5, 35.9) });
  },
};
