// Scene 7: the platform. One window morphs through every theme on the beat, a custom theme
// flows from one brand colour, then the features a team expects cascade in as a 3D grid.
import { h, tf, E, ep, prog, spring, lerp, css, keys, drift, clamp } from '../engine.js';
import { appWindow, caption, cursor, icon, tile, typeGlyph, statusGlyph, avatar } from '../components.js';

// ---------- Themes (docs/design/system/tokens.md, "Themes and modes") ----------
const BASE_LIGHT = {
  '--canvas': '#ffffff', '--side': '#f7f8fa', '--sunken': '#f5f6f8', '--card': '#ffffff', '--line': '#e3e6ec', '--line-2': '#eef0f3',
  '--tx': '#161b26', '--tx-2': '#4b5264', '--tx-3': '#697181', '--acc': '#2356c9', '--acc-fill': '#2356c9', '--on-acc': '#ffffff',
  '--acc-500': '#5b7be5', '--acc-100': '#dfe7fb', '--acc-50': '#eef2fd', '--hover': 'rgba(22,27,38,.045)',
  '--e1': '0 0 0 1px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.06)', '--prog': '#2356c9',
};
const THEMES = [
  { name: 'Bemmoly', swatch: '#2356c9', vars: BASE_LIGHT },
  { name: 'Graphite', swatch: '#27272a', vars: { ...BASE_LIGHT, '--side': '#f6f6f7', '--sunken': '#f4f4f5', '--line': '#e4e4e7', '--line-2': '#efeff1',
    '--tx': '#18181b', '--tx-2': '#52525b', '--tx-3': '#71717a', '--acc-fill': '#27272a', '--acc-500': '#52525b', '--acc-100': '#e4e4e7', '--acc-50': '#f4f4f5' } },
  { name: 'Sand', swatch: '#c9b48f', vars: { ...BASE_LIGHT, '--canvas': '#fbfaf7', '--side': '#f4f1ea', '--sunken': '#f1ede4', '--card': '#fffdf9', '--line': '#e6dfd2', '--line-2': '#efe9de',
    '--tx': '#1f1b16', '--tx-2': '#57504a', '--tx-3': '#756d64', '--acc-50': '#edf0f8', '--acc-100': '#dbe2f5' } },
  { name: 'Pine', swatch: '#17675a', vars: { ...BASE_LIGHT, '--side': '#f5f8f7', '--sunken': '#f1f5f4', '--line': '#dde6e3', '--line-2': '#ebf1ef',
    '--tx': '#14201d', '--tx-2': '#46544f', '--tx-3': '#64716c', '--acc': '#17675a', '--acc-fill': '#17675a', '--acc-500': '#3c8f80', '--acc-100': '#cfe6e0', '--acc-50': '#e8f3f0', '--prog': '#17675a' } },
  { name: 'High contrast', swatch: '#1a44a6', vars: { ...BASE_LIGHT, '--side': '#ffffff', '--sunken': '#f3f4f6', '--line': '#6b7280', '--line-2': '#9ca3af',
    '--tx': '#000000', '--tx-2': '#1f2937', '--tx-3': '#374151', '--acc': '#1a44a6', '--acc-fill': '#1a44a6', '--acc-500': '#1a44a6', '--acc-100': '#c7d4f5', '--acc-50': '#e8eefc', '--prog': '#1a44a6',
    '--e1': '0 0 0 1.5px #374151' } },
  { name: 'Dark', swatch: '#111418', vars: { '--canvas': '#111418', '--side': '#0c0f13', '--sunken': '#0e1115', '--card': '#181c22', '--line': '#2a2f38', '--line-2': '#20242b',
    '--tx': '#e8ebf1', '--tx-2': '#a8b0be', '--tx-3': '#858c9a', '--acc': '#7b95ec', '--acc-fill': '#4a68d0', '--on-acc': '#ffffff', '--acc-500': '#7b95ec',
    '--acc-100': 'rgba(91,123,229,.24)', '--acc-50': 'rgba(91,123,229,.14)', '--hover': 'rgba(255,255,255,.05)', '--e1': '0 0 0 1px rgba(255,255,255,.06), 0 1px 2px rgba(0,0,0,.4)', '--prog': '#6f8ff0' } },
  { name: 'Custom', swatch: '#0b7fa8', vars: { ...BASE_LIGHT, '--acc': '#0b7fa8', '--acc-fill': '#0b7fa8', '--acc-500': '#3aa0c4', '--acc-100': '#c9e7f2', '--acc-50': '#e6f4f9', '--prog': '#0b7fa8' } },
];
// [start, from, to, kind] — diagonal wipes on the beat, then a circular reveal from the swatch.
const SWITCHES = [[1.0, 0, 1, 'wipe'], [1.5, 1, 2, 'wipe'], [2.0, 2, 3, 'wipe'], [2.5, 3, 4, 'wipe'], [3.0, 4, 5, 'wipe'], [4.05, 5, 6, 'circle']];
const WIPE = 0.42, CIRCLE = 0.75;

// Window geometry (window-local px; drawn at 1440 × 860, scaled on stage).
const WW = 1440, WH = 860, WS = 0.7;
const WCX = 1215, WCY = 548; // stage centre of the window

// ---------- Window content: a compact Work list that shows the accent everywhere ----------
const ISSUES = [
  ['PLT-212', 'task', 'Rate limits per account', 'prog', ['AS', '#2f9e6e']],
  ['PLT-208', 'bug', 'Webhook retries skip the backoff', 'todo', ['LK', '#d46a2e']],
  ['PLT-204', 'story', 'Single sign-on with SAML', 'done', ['PR', '#9b4f96']],
  ['PLT-199', 'task', 'Nightly backup verification', 'prog', ['DM', '#0e9bb0']],
  ['PLT-196', 'story', 'Custom theme from a brand colour', 'done', ['JO', '#c2536a']],
  ['PLT-190', 'task', 'Import pages with their history', 'todo', ['RH', '#b7791f']],
  ['PLT-188', 'bug', 'Board keeps scroll after a drop', 'done', ['AS', '#2f9e6e']],
  ['PLT-185', 'task', 'Saved filters in the sidebar', 'prog', ['PR', '#9b4f96']],
  ['PLT-181', 'story', 'Roadmap forecast from team pace', 'done', ['DM', '#0e9bb0']],
  ['PLT-177', 'task', 'Signed images for every release', 'done', ['LK', '#d46a2e']],
  ['PLT-172', 'bug', 'Focus ring lost in the palette', 'todo', ['JO', '#c2536a']],
  ['PLT-169', 'task', 'Automation: notify on Done', 'prog', ['RH', '#b7791f']],
];

function workContent() {
  const c = h('div', { style: { position: 'absolute', inset: 0, padding: '22px 30px', fontSize: '13px', color: 'var(--tx)' } });
  const head = h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
    h('div', { class: 'tile', style: { width: '28px', height: '28px', background: '#2f9e6e', fontSize: '14px', fontWeight: 600 } }, 'P'),
    h('div', { style: { fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em' } }, 'Platform Core'),
    h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px' } },
      h('div', { style: { height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--card)', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--tx-2)', fontWeight: 500 } }, icon('filter', 14), 'Filter'),
      h('div', { style: { height: '32px', padding: '0 14px', borderRadius: '6px', background: 'var(--acc-fill)', color: 'var(--on-acc)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 } }, icon('plus', 14), 'New issue')));
  const tabs = h('div', { style: { display: 'flex', gap: '22px', marginTop: '18px', borderBottom: '1px solid var(--line)', color: 'var(--tx-2)', fontWeight: 500 } },
    ...['Board', 'Backlog', 'Roadmap', 'List'].map((n) => h('div', { style: { padding: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px', color: n === 'List' ? 'var(--acc)' : 'var(--tx-2)', boxShadow: n === 'List' ? 'inset 0 -2px 0 var(--acc)' : 'none' } },
      icon({ Board: 'square-kanban', Backlog: 'list-todo', Roadmap: 'chart-column', List: 'list' }[n], 14), n)));
  const sprint = h('div', { style: { marginTop: '18px', padding: '14px 16px', borderRadius: '8px', background: 'var(--card)', boxShadow: 'var(--e1)', display: 'flex', alignItems: 'center', gap: '16px' } },
    h('div', { style: { fontWeight: 600 } }, 'Sprint 14'),
    h('div', { style: { color: 'var(--tx-3)' } }, '12 Oct – 26 Oct'),
    h('div', { style: { flex: 1, height: '6px', borderRadius: '3px', background: 'var(--line-2)', overflow: 'hidden' } }, h('div', { style: { width: '64%', height: '100%', background: 'var(--acc-500)' } })),
    h('div', { style: { color: 'var(--tx-2)', fontWeight: 500 } }, '64% done'),
    h('div', { style: { height: '24px', padding: '0 10px', borderRadius: '12px', background: 'var(--acc-50)', color: 'var(--acc)', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '12px' } }, 'Active'));
  const list = h('div', { style: { marginTop: '16px', borderRadius: '8px', border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--card)' } });
  ISSUES.forEach(([key, type, title, st, [ini, col]], i) => {
    const sel = i === 0;
    list.append(h('div', { style: { height: '44px', display: 'flex', alignItems: 'center', gap: '14px', padding: '0 16px', borderTop: i ? '1px solid var(--line-2)' : 'none',
      background: sel ? 'var(--acc-50)' : 'transparent', boxShadow: sel ? 'inset 3px 0 0 var(--acc)' : 'none' } },
      typeGlyph(type, 16),
      h('span', { class: 'mono', style: { color: 'var(--tx-3)', fontSize: '12px', width: '62px' } }, key),
      h('span', { style: { fontWeight: 500, flex: 1 } }, title),
      statusGlyph(st, 14),
      h('span', { style: { color: 'var(--tx-2)', width: '84px' } }, { prog: 'In progress', todo: 'To do', done: 'Done' }[st]),
      avatar(ini, col, 22)));
  });
  c.append(head, tabs, sprint, list);
  return c;
}

function buildWindow() {
  const w = appWindow({ w: WW, h: WH, nav: [{ section: 'Work' }, { label: 'Platform Core', tileColor: '#2f9e6e', id: 'plat' }, { icon: 'list', label: 'List', indent: 20, id: 'list' },
    { icon: 'chart-column', label: 'Roadmap', indent: 20 }, { label: 'Mobile App', tileColor: '#d46a2e' }, { section: 'Docs' }, { icon: 'book-open', label: 'Engineering' }, { icon: 'book-open', label: 'Handbook' }], active: 'list' });
  w.content.append(workContent());
  w.el.style.left = '0px'; w.el.style.top = '0px';
  // The wordmark in the sidebar lockup follows the theme's text colour (the mark keeps its own).
  w.el.querySelectorAll('svg path[fill="var(--tx)"]').forEach((p) => { p.style.fill = 'var(--tx)'; });
  return w;
}

function applyTheme(el, vars) {
  for (const [k, v] of Object.entries(vars)) css(el, k, v);
}

// ---------- Feature cards ----------
const CARDS = [
  ['download', '#2356c9', 'Import from Jira, Confluence or CSV', 'Bring projects, pages and history with you.'],
  ['shield-check', '#0e9bb0', 'Single sign-on', 'OIDC and SAML, with SCIM provisioning.'],
  ['plug', '#6e56cf', 'Built-in MCP server', 'Connect AI assistants to your workspace.'],
  ['webhook', '#2f9e6e', 'Signed webhooks', 'Every event signed with HMAC-SHA256.'],
  ['git-pull-request', '#27272a', 'GitHub and GitLab links', 'Branches, commits and pull requests on the issue.'],
  ['palette', '#5b7be5', 'Five themes, light and dark', 'Or a custom theme from your brand colour.'],
  ['badge-check', '#d46a2e', 'WCAG 2.2 AA', 'Checked for keyboard, focus and contrast.'],
  ['file-text', '#c2536a', 'PDF export', 'Docs pages, print-ready, in one click.'],
];
const CW = 386, CH = 214, GAP = 26;
const GRID_W = 4 * CW + 3 * GAP;
const GX = 960 - GRID_W / 2, GY = 418;

let scene, winRig, base, top, wipeEdge, chips = [], chipRow, cap1, cap2, picker, swatches = [], hexText, cur, cardGrid, cards = [], winGlow;

export default {
  id: 'platform',
  build(root) {
    // Flat scene with its own perspective: siblings composite in DOM order, so no plane splitting
    // between the window, its glow, the captions and the grid.
    scene = h('div', { class: 'layer', style: { transformStyle: 'flat', perspective: '2200px' } });

    // Window rig: two stacked copies, the top one revealed by the wipe.
    winRig = h('div', { class: 'abs', style: { left: WCX - WW / 2 + 'px', top: WCY - WH / 2 + 'px', width: WW + 'px', height: WH + 'px', transformStyle: 'flat' } });
    winGlow = h('div', { class: 'abs', style: { left: '-200px', top: '-160px', width: WW + 400 + 'px', height: WH + 320 + 'px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(91,123,229,.35) 0%, rgba(35,86,201,0) 62%)' } });
    base = buildWindow();
    top = buildWindow();
    wipeEdge = h('div', { class: 'abs', style: { top: '-40px', height: WH + 80 + 'px', width: '6px', left: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.95), rgba(160,185,255,.9), rgba(255,255,255,0))',
      boxShadow: '0 0 24px 6px rgba(140,170,255,.55)', borderRadius: '3px', transformOrigin: '50% 50%' } });
    // The brand colour picker, anchored to the window (above both copies).
    picker = h('div', { class: 'abs ui-light', style: { right: '36px', top: '96px', width: '300px', padding: '16px', borderRadius: '12px', background: '#fff', color: '#161b26',
      boxShadow: '0 0 0 1px rgba(16,24,40,.08), 0 24px 60px -12px rgba(16,24,40,.45)', fontSize: '14px', transformOrigin: '85% 0%' } });
    picker.append(h('div', { style: { fontWeight: 600, fontSize: '15px' } }, 'Custom theme'), h('div', { style: { color: '#697181', fontSize: '13px', marginTop: '4px' } }, 'Start from one brand colour.'));
    const sw = h('div', { style: { display: 'flex', gap: '10px', marginTop: '14px' } });
    ['#2356c9', '#3949ab', '#0b7fa8', '#0f766e', '#27272a', '#7a5c2e'].forEach((c) => {
      const s = h('div', { style: { width: '34px', height: '34px', borderRadius: '9px', background: c, boxShadow: '0 0 0 1px rgba(0,0,0,.08)' } });
      swatches.push(s); sw.append(s);
    });
    hexText = h('span', { class: 'mono' }, '#2356C9');
    picker.append(sw, h('div', { style: { marginTop: '14px', height: '34px', borderRadius: '6px', border: '1px solid #e3e6ec', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 10px', color: '#4b5264', fontSize: '13px' } },
      'Brand colour', h('span', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#161b26' } }, hexText)));
    cur = cursor();
    // The cursor is drawn 1.5× so it reads at the window's on-stage scale.
    const curWrap = h('div', { class: 'abs', style: { left: 0, top: 0, width: '1px', height: '1px', transform: 'scale(1.5)', transformOrigin: '0 0' } }, cur.el);
    winRig.append(winGlow, base.el, top.el, wipeEdge, picker, curWrap);

    // Left column: the caption and the theme chips.
    cap1 = caption({ eyebrow: 'Make it yours', tileIcon: 'palette', tileColor: '#5b7be5', title: 'Your colours, everywhere.', sub: 'Five themes in light and dark, or a custom theme from one brand colour. The logo never changes.', left: 110, top: 250, width: 520, size: 64 });
    chipRow = h('div', { class: 'abs', style: { left: '110px', top: '680px', width: '520px', display: 'flex', flexWrap: 'wrap', gap: '10px' } });
    THEMES.forEach((th) => {
      const ch = h('div', { style: { height: '40px', padding: '0 16px 0 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', fontWeight: 500,
        background: 'rgba(255,255,255,.06)', color: '#c9d3ea', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)' } },
        h('span', { style: { width: '16px', height: '16px', borderRadius: '50%', background: th.swatch, boxShadow: '0 0 0 1.5px rgba(255,255,255,.35)' } }), th.name);
      chips.push(ch); chipRow.append(ch);
    });

    // Feature grid.
    cap2 = caption({ title: 'Everything a team expects. Nothing held back.', sub: 'Every feature ships in the one free edition.', left: 260, top: 168, width: 1400, align: 'center', size: 60 });
    cardGrid = h('div', { class: 'abs', style: { left: GX + 'px', top: GY + 'px', width: GRID_W + 'px', height: 2 * CH + GAP + 'px', transformStyle: 'preserve-3d', transformOrigin: '50% 50%' } });
    CARDS.forEach(([ic, col, title, line], i) => {
      const c = i % 4, r = Math.floor(i / 4);
      const card = h('div', { class: 'abs will', style: { left: c * (CW + GAP) + 'px', top: r * (CH + GAP) + 'px', width: CW + 'px', height: CH + 'px', borderRadius: '18px', padding: '28px', overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(34,40,52,.92) 0%, rgba(18,22,30,.92) 100%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.09), inset 0 1px 0 rgba(255,255,255,.08), 0 30px 60px -24px rgba(0,0,0,.7)',
        transformOrigin: '50% 0%', backfaceVisibility: 'hidden' } });
      const glint = h('div', { class: 'abs', style: { inset: 0, background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,.12) 50%, transparent 65%)', backgroundSize: '300% 100%' } });
      card.append(glint, tile(ic, col, 52, 26),
        h('div', { style: { marginTop: '22px', fontSize: '24px', fontWeight: 600, color: '#fff', letterSpacing: '-0.015em', lineHeight: 1.2 } }, title),
        h('div', { style: { marginTop: '8px', fontSize: '17px', color: '#a9b3c8', lineHeight: 1.4 } }, line));
      cards.push({ el: card, glint, c, r });
      cardGrid.append(card);
    });

    scene.append(cap1.el, chipRow, winRig, cap2.el, cardGrid);
    root.append(scene);
  },
  update(t) {
    // ---- Window: lands from depth, drifts, then recedes for the grid ----
    const land = spring(t - 0.05, { stiffness: 90, damping: 18 });
    const away = E.inOutCubic(prog(t, 4.9, 5.9));
    const push = ep(t, 0.8, 4.9, E.inOutCubic); // slow camera push while the themes play
    tf(winRig, {
      x: (1 - land) * 380 - away * 260,
      y: (1 - land) * 60 + drift(t, 3, 0.5) * 6,
      z: (1 - land) * -900 - away * 1300,
      s: WS * (1 + push * 0.035),
      ry: (1 - land) * -32 + lerp(-9, -5, push) - away * 26,
      rx: (1 - land) * 12 + 4 + drift(t, 7, 0.4) * 0.6,
      o: prog(t, 0.0, 0.35) * (1 - away),
      blur: (1 - clamp(land, 0, 1)) * 10 + away * 14,
    });
    tf(winGlow, { o: 0.6 + Math.sin(t * 1.4) * 0.1 });

    // ---- Theme switching ----
    let from = 0, to = 0, p = 1, kind = 'wipe';
    for (const [s, a, b, k] of SWITCHES) {
      if (t >= s) { from = a; to = b; kind = k; p = prog(t, s, s + (k === 'wipe' ? WIPE : CIRCLE)); }
    }
    if (t < SWITCHES[0][0]) { from = 0; to = 0; p = 1; }
    applyTheme(base.el, THEMES[p >= 1 ? to : from].vars);
    applyTheme(top.el, THEMES[to].vars);
    const transitioning = p > 0 && p < 1 && from !== to;
    css(top.el, 'visibility', transitioning ? 'visible' : 'hidden');
    if (transitioning && kind === 'wipe') {
      const k = E.inOutCubic(p);
      const slant = 260;
      const fx = lerp(-slant - 20, WW + 20, k);
      css(top.el, 'clip-path', `polygon(0 0, ${(fx + slant).toFixed(1)}px 0, ${fx.toFixed(1)}px 100%, 0 100%)`);
      // A light edge rides the front of the wipe.
      tf(wipeEdge, { x: fx + slant / 2, rz: Math.atan2(slant, WH) * (180 / Math.PI), o: Math.sin(Math.PI * p) });
    } else if (transitioning) {
      const k = E.inOutCubic(p);
      css(top.el, 'clip-path', `circle(${(k * 1750).toFixed(1)}px at ${WW - 36 - 300 + 16 + 2 * 44 + 17}px ${96 + 70 + 17}px)`);
      tf(wipeEdge, { o: 0 });
    } else {
      css(top.el, 'clip-path', 'none');
      tf(wipeEdge, { o: 0 });
    }
    // Which chip is lit: the theme on screen (the incoming one once the wipe passes half way).
    const lit = transitioning ? (p > 0.5 ? to : from) : (p >= 1 ? to : from);
    chips.forEach((ch, i) => {
      const on = i === lit;
      const k = spring(t - 0.6 - i * 0.07, { stiffness: 200, damping: 20 });
      css(ch, 'background', on ? '#ffffff' : 'rgba(255,255,255,.06)');
      css(ch, 'color', on ? '#111418' : '#c9d3ea');
      const out = E.inCubic(prog(t, 4.75 + i * 0.03, 5.2 + i * 0.03));
      tf(ch, { y: (1 - k) * 24 - out * 20, s: on ? 1.06 : 1, o: prog(t, 0.6 + i * 0.07, 0.8 + i * 0.07) * (1 - out), blur: out * 8 });
    });

    // ---- Custom theme: the picker opens, a swatch is chosen, the accent flows ----
    const po = spring(t - 3.45, { stiffness: 260, damping: 22 });
    const pc = E.inCubic(prog(t, 4.6, 4.85));
    tf(picker, { s: lerp(0.9, 1, clamp(po, 0, 1.1)), y: (1 - po) * -10, o: prog(t, 3.45, 3.6) * (1 - pc) });
    swatches.forEach((s, i) => {
      const chosen = i === 2 && t >= 4.0;
      css(s, 'box-shadow', chosen ? '0 0 0 2px #fff, 0 0 0 4px #0b7fa8' : i === 0 && t < 4.0 ? '0 0 0 2px #fff, 0 0 0 4px #2356c9' : '0 0 0 1px rgba(0,0,0,.08)');
      tf(s, { s: chosen ? 1 + 0.12 * Math.max(0, 1 - (t - 4.0) / 0.3) : 1 });
    });
    hexText.textContent = t >= 4.0 ? '#0B7FA8' : '#2356C9';
    // Cursor: swatch 3 sits at picker-left + 16 + 2 × 44 + 17 = (WW − 336 + 121, 96 + 70 + 17).
    const sx = WW - 336 + 121, sy = 183;
    const K = 1 / 1.5;
    cur.update(t, [[3.2, (WW - 120) * K, 520 * K], [3.85, (sx + 4) * K, (sy + 6) * K], [4.4, (sx + 4) * K, (sy + 6) * K], [4.8, (sx + 160) * K, (sy + 260) * K]], [4.0], { o: prog(t, 3.2, 3.4) * (1 - prog(t, 4.6, 4.85)) });

    // ---- Captions ----
    cap1.update(t, 0.35, 4.75);
    cap2.update(t, 5.25, 8.45);

    // ---- Feature grid: cards flip down on the beat, the grid turns slowly, then flies past ----
    const gk = ep(t, 5.4, 9.0, E.inOutCubic);
    tf(cardGrid, { rx: lerp(14, 4, gk), ry: lerp(-7, 6, gk), z: lerp(-120, 40, gk), y: drift(t, 11, 0.5) * 4 });
    cards.forEach(({ el, glint, c, r }) => {
      const d = 5.55 + c * 0.25 + r * 0.5; // a diagonal wave, one card per half-beat
      const k = spring(t - d, { stiffness: 150, damping: 16 });
      const dist = Math.abs(c - 1.5) + Math.abs(r - 0.5);
      const ex = E.inCubic(prog(t, 8.55 + (2.5 - dist) * 0.07, 9.15 + (2.5 - dist) * 0.07));
      tf(el, { rx: (1 - k) * -100, y: (1 - k) * 60, z: ex * 900, o: prog(t, d, d + 0.12) * (1 - ex), blur: ex * 18 + Math.max(0, (1 - k)) * 4 });
      css(glint, 'background-position', `${lerp(120, -20, E.inOutCubic(prog(t, d + 0.35, d + 1.15)))}% 0`);
    });
  },
};
