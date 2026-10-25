// The drawn product views used by the tour: the Work header, board, roadmap, the Docs page and
// the Ask panel. Builders only: they return DOM plus references; tour.js animates them.
import { h, tf, text, E, prog, rand } from '../engine.js';
import { icon, typeGlyph, statusGlyph, avatar, pill } from '../components.js';

export const CONTENT_W = 1192;
export const CONTENT_H = 820;
export const HEADER_H = 52;

const AV = { PR: '#c2536a', DO: '#2f9e6e', AK: '#d46a2e', LE: '#0e9bb0', RO: '#b7791f', JO: '#9b4f96' };
export const PRESENCE = { priya: '#d6457a', daniel: '#1f9d55' };

const S = (o) => ({ style: o });

/** A two-digit number that rolls when it changes. */
export function counter(from) {
  const el = h('span', { class: 'mono', style: { display: 'inline-block', position: 'relative', overflow: 'hidden', height: '16px', width: '16px', verticalAlign: '-3px', fontSize: '12px', color: 'var(--tx-3)' } });
  const a = h('span', { class: 'abs', style: { left: 0, top: 0, lineHeight: '16px' } }, String(from));
  const b = h('span', { class: 'abs', style: { left: 0, top: 0, lineHeight: '16px' } }, String(from));
  el.append(a, b);
  return {
    el,
    update(t, at, from, to) {
      const k = E.outCubic(prog(t, at, at + 0.35));
      text(a, String(from)); text(b, String(to));
      tf(a, { y: -16 * k, o: 1 - k });
      tf(b, { y: 16 * (1 - k), o: k });
    },
  };
}

// ---------- Work header (shared by board and roadmap) ----------

export function workHeader() {
  const tabs = {};
  const tab = (ic, label) => {
    const el = h('div', S({ height: '30px', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--tx-2)' }), icon(ic, 15), label);
    tabs[label] = el;
    return el;
  };
  const el = h('div', S({ position: 'absolute', left: 0, top: 0, right: 0, height: HEADER_H + 'px', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 18px', borderBottom: '1px solid var(--line)', background: 'var(--canvas)', zIndex: 3 }),
    h('div', S({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--tx)', paddingRight: '12px', marginRight: '6px', borderRight: '1px solid var(--line)' }),
      h('div', { class: 'tile', style: { width: '18px', height: '18px', background: '#2f9e6e', fontSize: '10px', fontWeight: 600 } }, 'P'), 'Platform Core', h('span', S({ color: 'var(--tx-3)' }), icon('chevron-down', 14))),
    tab('square-kanban', 'Board'), tab('list-todo', 'Backlog'), tab('milestone', 'Roadmap'),
    h('div', S({ flex: 1 })),
    h('div', S({ display: 'flex', marginRight: '12px' }), ...['PR', 'DO', 'AK', 'LE'].map((k, i) => { const a = avatar(k, AV[k], 24); a.style.marginLeft = i ? '-6px' : '0'; a.style.boxShadow = '0 0 0 2px var(--canvas)'; return a; })),
    h('div', S({ height: '32px', display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: '6px', background: 'var(--acc-fill)', color: '#fff', fontSize: '13px', fontWeight: 500 }), 'New issue'));
  const setTab = (name) => {
    for (const [k, t] of Object.entries(tabs)) {
      const on = k === name;
      t.style.background = on ? 'var(--acc-50)' : 'transparent';
      t.style.color = on ? 'var(--acc)' : 'var(--tx-2)';
    }
  };
  setTab('Board');
  return { el, tabs, setTab };
}

const filterRow = (left, right) => h('div', S({ position: 'absolute', left: 0, right: 0, top: 0, height: '52px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 20px' }), ...left, h('div', S({ flex: 1 })), ...right);
const ghostBtn = (ic, label) => h('div', S({ height: '30px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px', color: 'var(--tx-2)', background: 'var(--card)' }), ic ? icon(ic, 14) : '', label);

// ---------- Board ----------

export const COL_W = 278;
export const COL_GAP = 14;
export const CARD_W = 262;
export const CARD_H = 96;
export const CARD_STEP = 106;
export const CARD_TOP = 104; // inside the board view, below the filter row and column header
export const colX = (i) => 20 + i * (COL_W + COL_GAP);

const COLUMNS = [
  { name: 'To do', cat: 'todo', cards: [['PLT-221', 'Audit log export to CSV', 'task', 'AK'], ['PLT-219', 'Token refresh race on mobile', 'bug', 'RO'], ['PLT-230', 'Per-team WIP limits on the board', 'story', 'LE'], ['PLT-233', 'Retry webhooks with backoff', 'task', 'JO']] },
  { name: 'In progress', cat: 'prog', cards: [['PLT-211', 'Session store migration to Postgres', 'story', 'AK'], ['PLT-215', 'Dark mode for email digests', 'task', 'LE'], ['PLT-226', 'Search ranking for doc titles', 'task', 'RO']] },
  { name: 'In review', cat: 'prog', cards: [['PLT-204', 'Rate limits per account', 'task', 'PR'], ['PLT-198', 'Invite links expire after 7 days', 'bug', 'DO'], ['PLT-207', 'Sprint report shows carry-over', 'story', 'JO']] },
  { name: 'Done', cat: 'done', cards: [['PLT-190', 'Single sign-on with SAML', 'story', 'AK'], ['PLT-188', 'Roadmap forecasts from team pace', 'story', 'DO'], ['PLT-185', 'Sign outgoing webhooks', 'task', 'PR'], ['PLT-183', 'Import CSV into a project', 'task', 'LE'], ['PLT-180', 'Theme from one brand colour', 'story', 'RO']] },
];

export function card([key, title, type, who], { lifted = false } = {}) {
  const prio = type === 'bug' ? '<svg class="ico" width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="8" width="3" height="5" rx="1" fill="var(--red)"/><rect x="5.5" y="5" width="3" height="8" rx="1" fill="var(--red)"/><rect x="10" y="2" width="3" height="11" rx="1" fill="var(--red)"/></svg>'
    : '<svg class="ico" width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="8" width="3" height="5" rx="1" fill="var(--tx-3)"/><rect x="5.5" y="5" width="3" height="8" rx="1" fill="var(--tx-3)"/><rect x="10" y="2" width="3" height="11" rx="1" fill="var(--line)"/></svg>';
  return h('div', { class: 'abs will', style: { width: CARD_W + 'px', height: CARD_H + 'px', background: 'var(--card)', borderRadius: '8px', boxShadow: lifted ? '0 0 0 1px rgba(35,86,201,.25), 0 22px 40px -12px rgba(16,24,40,.35), 0 6px 14px -6px rgba(16,24,40,.2)' : 'var(--e1)', padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } },
    h('div', S({ fontSize: '13.5px', fontWeight: 500, lineHeight: 1.38, color: 'var(--tx)' }), title),
    h('div', S({ display: 'flex', alignItems: 'center', gap: '7px' }), typeGlyph(type, 14), h('span', { class: 'mono', style: { fontSize: '11.5px', color: 'var(--tx-3)' } }, key), h('div', S({ flex: 1 })), prio, avatar(who, AV[who], 20)));
}

export function board() {
  const el = h('div', S({ position: 'absolute', left: 0, right: 0, top: HEADER_H + 'px', bottom: 0 }));
  el.append(filterRow([ghostBtn('filter', 'Filter'), h('div', S({ fontSize: '13px', color: 'var(--tx-3)' }), 'Sprint 14 · ends Friday')], [ghostBtn('users', 'Group: none'), ghostBtn('arrow-up-down', 'Sort: manual')]));
  const cols = [], counts = [], cardEls = [];
  COLUMNS.forEach((c, i) => {
    const col = h('div', S({ position: 'absolute', left: colX(i) + 'px', top: '58px', width: COL_W + 'px', bottom: '14px', background: 'var(--sunken)', borderRadius: '10px', overflow: 'hidden', border: '1px solid transparent' }));
    const cnt = counter(c.cards.length);
    col.append(h('div', S({ height: '40px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', fontSize: '13px', fontWeight: 600, color: 'var(--tx)' }), statusGlyph(c.cat, 14), c.name, cnt.el, h('div', S({ flex: 1 })), h('span', S({ color: 'var(--tx-3)' }), icon('plus', 15))));
    el.append(col);
    cols.push(col); counts.push(cnt);
    cardEls.push(c.cards.map((d, j) => {
      const ce = card(d);
      ce.style.left = colX(i) + 8 + 'px';
      ce.style.top = CARD_TOP + j * CARD_STEP + 'px';
      if (!(i === 2 && j === 0)) el.append(ce);
      return ce;
    }));
  });
  // The dragged card lives above the columns.
  const drag = card(COLUMNS[2].cards[0], { lifted: false });
  drag.style.left = colX(2) + 8 + 'px';
  drag.style.top = CARD_TOP + 'px';
  drag.style.zIndex = 5;
  const doneTick = h('div', S({ position: 'absolute', right: '10px', top: '10px', width: '20px', height: '20px' }), statusGlyph('done', 20));
  drag.append(doneTick);
  el.append(drag);
  return { el, cols, counts, cards: cardEls, drag, doneTick };
}

// ---------- Roadmap ----------

export const RM = { listW: 300, weekW: 64, rowH: 56, headH: 52 };
export const dayX = (d) => RM.listW + (d / 7) * RM.weekW;
const ROWS = [
  { name: 'Auth service', key: 'PLT-190', meta: '12 issues · 42% done · Aisha', status: ['On track', 'var(--green-tx)', 'var(--green-50)'], color: '#b7791f', a: -7, b: 28, p: 0.42 },
  { name: 'Billing v2', key: 'PLT-150', meta: '14 issues · 64% done · Lena', status: ['6 days late', 'var(--amber-tx)', 'var(--amber-50)'], color: '#c2536a', a: 3, b: 17, p: 0.64 },
  { name: 'Observability', key: 'PLT-240', meta: '5 issues · 0% done · Rohan', status: ['On track', 'var(--green-tx)', 'var(--green-50)'], color: '#2f9e6e', a: 24, b: 59, p: 0 },
  { name: 'Self-serve onboarding', key: 'PLT-160', meta: '8 issues · 38% done · Jonas', status: ['On track', 'var(--green-tx)', 'var(--green-50)'], color: '#6e56cf', a: -3, b: 35, p: 0.38 },
  { name: 'v1.6.0', key: '', meta: '6 issues · Aisha, Lena', status: ['On track', 'var(--green-tx)', 'var(--green-50)'], color: '#697181', a: 0, b: 14, p: 0, release: true },
  { name: 'v1.7.0', key: '', meta: '4 issues · Rohan', status: ['On track', 'var(--green-tx)', 'var(--green-50)'], color: '#697181', a: 21, b: 42, p: 0, release: true },
];
const hex2rgba = (hx, a) => { const n = parseInt(hx.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function roadmap() {
  const el = h('div', S({ position: 'absolute', left: 0, right: 0, top: HEADER_H + 'px', bottom: 0, overflow: 'hidden' }));
  const seg = h('div', S({ display: 'flex', padding: '2px', borderRadius: '7px', background: 'var(--sunken)', border: '1px solid var(--line)', fontSize: '12.5px' }),
    ...['Weeks', 'Months', 'Quarters'].map((l) => h('div', S({ padding: '4px 10px', borderRadius: '5px', color: l === 'Months' ? 'var(--tx)' : 'var(--tx-3)', background: l === 'Months' ? 'var(--card)' : 'transparent', boxShadow: l === 'Months' ? 'var(--e1)' : 'none', fontWeight: 500 }), l)));
  el.append(filterRow([h('div', S({ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx-3)', fontSize: '13px' }), icon('search', 14), 'Filter epics…'), ghostBtn('filter', 'Show')], [seg, h('div', S({ fontSize: '13px', fontWeight: 500, color: 'var(--tx-2)', padding: '0 6px' }), 'Today')]));

  // Forecast banner (slides in).
  const banner = h('div', S({ position: 'absolute', left: '20px', right: '20px', top: '56px', height: '46px', borderRadius: '8px', border: '1px solid rgba(229,160,13,.35)', background: 'var(--amber-50)', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 0 14px', fontSize: '13.5px', color: 'var(--tx)' }),
    h('span', S({ color: 'var(--amber)' }), icon('triangle-alert', 17)), h('b', S({ fontWeight: 600 }), 'Forecast'),
    h('span', S({ color: 'var(--tx-2)' }), 'Billing v2 is likely 6 days past its Oct 15 target. 1 item waits on it.'), h('div', S({ flex: 1 })),
    h('div', S({ height: '30px', display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--card)', fontSize: '13px', fontWeight: 500 }), 'View forecast'));
  el.append(banner);

  const grid = h('div', S({ position: 'absolute', left: 0, right: 0, top: '62px', height: RM.headH + ROWS.length * RM.rowH + 'px', borderTop: '1px solid var(--line)' }));
  // Timeline header.
  const months = [['Oct 2026', 3], ['Nov 2026', 34], ['Dec 2026', 64]];
  grid.append(h('div', S({ position: 'absolute', left: 0, top: 0, width: RM.listW + 'px', height: RM.headH + 'px', display: 'flex', alignItems: 'flex-end', padding: '0 20px 8px', fontSize: '12px', color: 'var(--tx-3)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }), '4 epics, 2 versions'));
  for (const [m, d] of months) grid.append(h('div', S({ position: 'absolute', left: dayX(d) + 'px', top: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--tx)', paddingLeft: '8px', borderLeft: '1px solid var(--line)', height: '20px' }), m));
  const weekLabels = ['28', '5', '12', '19', '26', '2', '9', '16', '23', '30', '7', '14', '21', '28'];
  weekLabels.forEach((w, i) => {
    grid.append(h('div', S({ position: 'absolute', left: RM.listW + i * RM.weekW + 'px', top: '28px', width: RM.weekW + 'px', height: '24px', textAlign: 'center', fontSize: '11.5px', color: 'var(--tx-3)', borderLeft: '1px solid var(--line-2)', borderBottom: '1px solid var(--line)', lineHeight: '24px' }), w));
    grid.append(h('div', S({ position: 'absolute', left: RM.listW + i * RM.weekW + 'px', top: RM.headH + 'px', width: '1px', height: ROWS.length * RM.rowH + 'px', background: 'var(--line-2)' })));
  });
  const bars = [], rows = [];
  ROWS.forEach((r, i) => {
    const y = RM.headH + i * RM.rowH;
    const row = h('div', S({ position: 'absolute', left: 0, top: y + 'px', width: RM.listW + 'px', height: RM.rowH + 'px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px 0 16px', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line-2)' }),
      h('span', S({ color: 'var(--tx-3)' }), icon(r.release ? 'box' : 'chevron-right', 14)),
      r.release ? '' : h('div', S({ width: '10px', height: '10px', borderRadius: '2px', background: r.color, flex: 'none' })),
      h('div', S({ minWidth: 0, flex: 1 }),
        h('div', S({ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)', whiteSpace: 'nowrap' }), r.name, r.key ? h('span', { class: 'mono', style: { fontWeight: 400, fontSize: '11.5px', color: 'var(--tx-3)', marginLeft: '7px' } }, r.key) : ''),
        h('div', S({ fontSize: '12px', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }), r.meta)),
      pill(r.status[0], r.status[1], r.status[2], { height: '22px', fontSize: '12px', padding: '0 8px', borderRadius: '5px', fontWeight: 600 }));
    grid.append(row);
    grid.append(h('div', S({ position: 'absolute', left: RM.listW + 'px', right: 0, top: y + RM.rowH - 1 + 'px', height: '1px', background: 'var(--line-2)' })));
    rows.push(row);
    const x0 = Math.max(dayX(r.a), RM.listW + 2), x1 = dayX(r.b);
    let bar;
    if (r.release) {
      bar = h('div', S({ position: 'absolute', left: x0 + 'px', top: y + 15 + 'px', width: x1 - x0 + 'px', height: '26px', borderRadius: '6px', background: 'var(--sunken)', border: '1px solid var(--line)', fontSize: '12.5px', fontWeight: 600, color: 'var(--tx)', lineHeight: '24px', paddingLeft: '10px', whiteSpace: 'nowrap' }), r.name,
        h('div', S({ position: 'absolute', right: '-7px', top: '6px', width: '12px', height: '12px', background: 'var(--tx-2)', transform: 'rotate(45deg)', borderRadius: '2px' })));
    } else {
      bar = h('div', S({ position: 'absolute', left: x0 + 'px', top: y + 14 + 'px', width: x1 - x0 + 'px', height: '28px', borderRadius: '6px', background: hex2rgba(r.color, 0.16), border: `1px solid ${hex2rgba(r.color, 0.45)}`, overflow: 'hidden', whiteSpace: 'nowrap' }),
        h('div', S({ position: 'absolute', left: 0, top: 0, bottom: 0, width: r.p * 100 + '%', background: hex2rgba(r.color, 0.3) })),
        h('div', S({ position: 'relative', fontSize: '12.5px', fontWeight: 600, color: 'var(--tx)', lineHeight: '26px', paddingLeft: '10px' }), r.name, r.p ? h('span', S({ fontWeight: 400, color: 'var(--tx-2)' }), ` · ${Math.round(r.p * 100)}%`) : ''));
    }
    grid.append(bar);
    bars.push(bar);
  });
  // Forecast extension for Billing v2, the dependency and Today.
  const fy = RM.headH + RM.rowH + 14;
  const forecast = h('div', S({ position: 'absolute', left: dayX(17) + 'px', top: fy + 'px', width: dayX(23) - dayX(17) + 'px', height: '28px', borderRadius: '0 6px 6px 0', border: '1.5px dashed var(--amber)', borderLeft: '0', background: 'repeating-linear-gradient(-45deg, rgba(229,160,13,.28) 0 5px, rgba(229,160,13,.06) 5px 10px)' }));
  const forecastLbl = h('div', S({ position: 'absolute', left: dayX(23) + 12 + 'px', top: fy + 5 + 'px', fontSize: '12.5px', fontWeight: 600, color: 'var(--amber-tx)', whiteSpace: 'nowrap' }), 'Forecast Oct 21');
  const depY0 = fy + 14, depY1 = RM.headH + 2 * RM.rowH + 28;
  const dep = h('svg', { width: '200', height: '200', style: 'position:absolute;left:0;top:0;overflow:visible' });
  dep.innerHTML = `<path d="M ${dayX(23)} ${depY0 + 14} L ${dayX(23)} ${depY1} L ${dayX(24) + 2} ${depY1}" fill="none" stroke="var(--tx-3)" stroke-width="1.5" stroke-dasharray="120" class="dep"/><circle cx="${dayX(23)}" cy="${depY0 + 14}" r="3.5" fill="var(--amber)" class="depdot"/>`;
  const today = h('div', S({ position: 'absolute', left: dayX(9) + 'px', top: '22px', width: '0', height: RM.headH - 22 + ROWS.length * RM.rowH + 'px', borderLeft: '1.5px solid var(--acc)', transformOrigin: '0 0' }),
    h('div', S({ position: 'absolute', left: '-24px', top: '-2px', width: '48px', height: '20px', borderRadius: '5px', background: 'var(--acc-fill)', color: '#fff', fontSize: '11.5px', fontWeight: 600, textAlign: 'center', lineHeight: '20px' }), 'Today'));
  grid.append(forecast, forecastLbl, dep, today);
  el.append(grid);
  return { el, banner, grid, bars, rows, forecast, forecastLbl, dep: dep.querySelector('.dep'), depDot: dep.querySelector('.depdot'), today };
}

// ---------- Docs page ----------

export const DOC = { left: 216, width: 640, bodyTop: 352, lh: 25 };

/** Deterministic typing schedule: the time each character appears. */
export function typing(str, start, cps, seed) {
  const times = [];
  let t = start;
  for (let i = 0; i < str.length; i++) {
    t += (1 / cps) * (0.5 + rand(seed + i * 7.13) * 1.0);
    if (/[.,:]/.test(str[i - 1] || '')) t += 0.14;
    times.push(t);
  }
  return times;
}
export const typedCount = (times, t) => { let n = 0; while (n < times.length && times[n] <= t) n++; return n; };

/** A presence caret with a name flag. */
export function presenceCaret(name, color) {
  const el = h('span', S({ position: 'relative', display: 'inline-block', width: '0', height: '20px', verticalAlign: '-4px' }),
    h('span', S({ position: 'absolute', left: '-1px', top: '-1px', width: '2px', height: '22px', background: color, borderRadius: '1px' })),
    h('span', S({ position: 'absolute', left: '-1px', bottom: '21px', height: '18px', padding: '0 6px', borderRadius: '4px 4px 4px 0', background: color, color: '#fff', fontSize: '11px', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', fontFamily: 'Plex' }), name));
  return el;
}

export function issueChip() {
  // Glyphs and labels sit in boxes with an explicit line height, so they centre on the chip.
  const glyph = h('span', S({ position: 'relative', display: 'block', width: '14px', height: '14px', lineHeight: 0, flex: 'none' }));
  const gProg = h('span', S({ position: 'absolute', inset: 0, display: 'flex' }), statusGlyph('prog', 14));
  const gDone = h('span', S({ position: 'absolute', inset: 0, display: 'flex' }), statusGlyph('done', 14));
  const ping = h('span', S({ position: 'absolute', left: '-5px', top: '-5px', width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--done)', opacity: 0 }));
  glyph.append(ping, gProg, gDone);
  // The label box narrows from "In progress" to "Done" as the status flips (width set by the scene).
  const label = h('span', S({ position: 'relative', display: 'block', width: LABEL_W.prog + 'px', height: '18px', lineHeight: '18px', overflow: 'hidden', flex: 'none' }));
  const lProg = h('span', S({ position: 'absolute', left: 0, top: 0, color: 'var(--prog)', fontWeight: 500, whiteSpace: 'nowrap' }), 'In progress');
  const lDone = h('span', S({ position: 'absolute', left: 0, top: 0, color: 'var(--green-tx)', fontWeight: 500, whiteSpace: 'nowrap' }), 'Done');
  label.append(lProg, lDone);
  const el = h('span', S({ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '26px', padding: '0 9px 0 7px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--e1)', fontSize: '13px', lineHeight: '18px', verticalAlign: '-6px', whiteSpace: 'nowrap', transformOrigin: '0 50%' }),
    glyph, h('span', S({ display: 'flex', flex: 'none' }), typeGlyph('story', 14)), h('span', { class: 'mono', style: { fontSize: '12px', color: 'var(--tx-3)' } }, 'PLT-211'), h('span', S({ color: 'var(--tx)', fontWeight: 500 }), 'Session store'), h('span', S({ color: 'var(--tx-3)' }), '·'), label);
  return { el, gProg, gDone, lProg, lDone, ping, label };
}
/** Label widths in px (IBM Plex Sans 500, 13px). */
export const LABEL_W = { prog: 69, done: 32 };

export function docPage() {
  const el = h('div', S({ position: 'absolute', inset: 0 }));
  const presence = h('div', S({ display: 'flex', marginRight: '6px' }), ...[['PR', PRESENCE.priya], ['DO', PRESENCE.daniel], ['AK', AV.AK]].map(([k, c], i) => { const a = avatar(k, c, 24); a.style.marginLeft = i ? '-5px' : '0'; a.style.boxShadow = `0 0 0 2px var(--canvas), 0 0 0 3.5px ${i < 2 ? c : 'transparent'}`; return a; }));
  const saved = h('span', S({ fontSize: '12.5px', color: 'var(--tx-3)', whiteSpace: 'nowrap' }), 'Saved · revision 14');
  const askBtn = h('div', S({ height: '30px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--ai-100)', background: 'var(--ai-50)', color: 'var(--ai-600)', fontSize: '13px', fontWeight: 500 }), icon('sparkles', 14), 'Ask AI');
  el.append(h('div', S({ position: 'absolute', left: 0, right: 0, top: 0, height: HEADER_H + 'px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px 0 20px', borderBottom: '1px solid var(--line)', fontSize: '13px', color: 'var(--tx-2)', background: 'var(--canvas)', zIndex: 2 }),
    h('div', { class: 'tile', style: { width: '18px', height: '18px', background: '#0e9bb0', fontSize: '10px', fontWeight: 600 } }, 'E'), 'Engineering', h('span', S({ color: 'var(--tx-3)' }), '/'), icon('file-text', 14), 'Platform', h('span', S({ color: 'var(--tx-3)' }), '/'),
    h('span', S({ color: 'var(--tx)', fontWeight: 500 }), 'RFC: Move sessions to Postgres'),
    h('span', S({ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '24px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--line)', marginLeft: '6px', fontSize: '12.5px' }), statusGlyph('prog', 12), 'In review'),
    h('div', S({ flex: 1 })), presence, saved, h('span', S({ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--tx-2)', margin: '0 4px' }), icon('message-square', 15), '4'), askBtn,
    h('div', S({ height: '30px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px', fontWeight: 500, color: 'var(--tx)' }), icon('users', 14), 'Share')));

  // Cover and title.
  const cover = h('div', S({ position: 'absolute', left: 0, right: 0, top: HEADER_H + 'px', height: '150px', background: 'var(--sunken)', overflow: 'hidden' }));
  [[560, 40, 130, '#dfe7fb'], [705, -20, 130, '#c9d6f6'], [850, -20, 130, '#e4e9f5'], [995, 40, 130, '#dfe7fb'], [705, 125, 130, '#e9eef9']].forEach(([x, y, s, c]) =>
    cover.append(h('div', S({ position: 'absolute', left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px', borderRadius: '30px', background: c }))));
  const pageIcon = h('div', S({ position: 'absolute', left: DOC.left + 'px', top: HEADER_H + 150 - 28 + 'px', width: '56px', height: '56px', borderRadius: '13px', background: 'var(--card)', boxShadow: 'var(--e2)', display: 'grid', placeItems: 'center', color: '#2356c9' }), icon('flag', 26, 1.8));
  const title = h('div', S({ position: 'absolute', left: DOC.left + 'px', top: '250px', fontSize: '34px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--tx)' }), 'RFC: Move sessions to Postgres');
  const meta = h('div', S({ position: 'absolute', left: DOC.left + 'px', top: '304px', width: DOC.width + 'px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--tx-2)', paddingBottom: '14px', borderBottom: '1px solid var(--line-2)' }),
    avatar('AK', AV.AK, 22), 'Aisha Khan', h('span', S({ color: 'var(--tx-3)' }), 'Reviewers'), avatar('DO', AV.DO, 20), pill('rfc', 'var(--tx-2)', 'var(--sunken)', { height: '22px', fontSize: '12px' }), h('span', S({ color: 'var(--tx-3)', marginLeft: '6px' }), 'Edited just now'));

  // Body.
  const body = h('div', S({ position: 'absolute', left: DOC.left + 'px', top: DOC.bodyTop + 'px', width: DOC.width + 'px', fontSize: '15.5px', lineHeight: DOC.lh + 'px', color: 'var(--tx)' }));
  const h2 = (s) => h('div', S({ fontSize: '19px', fontWeight: 600, margin: '18px 0 8px', letterSpacing: '-0.01em' }), s);
  const p1 = h('div', S({ minHeight: DOC.lh * 3 + 'px', color: 'var(--tx)' }));
  const p1Text = h('span'); const p1Caret = presenceCaret('Priya Raman', PRESENCE.priya);
  p1.append(p1Text, p1Caret);
  const li = (n, ...kids) => h('div', S({ display: 'flex', gap: '10px', margin: '6px 0', minHeight: '26px' }), h('span', S({ color: 'var(--tx-3)', width: '18px', flex: 'none', textAlign: 'right' }), n + '.'), h('div', S({ flex: 1 }), ...kids));
  const l1Text = h('span'); const l1Code = h('span', { class: 'mono', style: { fontSize: '13.5px', background: 'var(--sunken)', border: '1px solid var(--line-2)', borderRadius: '4px', padding: '0 4px', display: 'none' } }, 'auth_pg_sessions');
  const l1After = h('span'); const l1Key = h('span', { class: 'mono', style: { fontSize: '14px', color: 'var(--acc)' } });
  const chip = issueChip();
  const l1Caret = presenceCaret('Daniel Okafor', PRESENCE.daniel);
  const l1 = li(1, l1Text, l1Code, l1After, l1Key, chip.el, l1Caret);
  const hl = h('span', S({ position: 'relative' }));
  const hlBg = h('span', S({ position: 'absolute', left: '-2px', right: '-2px', top: '1px', bottom: '0', background: 'rgba(229,160,13,.22)', borderBottom: '2px solid var(--amber)', transformOrigin: '0 50%', borderRadius: '2px' }));
  const days = h('span', {}, '7');
  hl.append(hlBg, h('span', S({ position: 'relative' }), 'keep Redis warm for ', days, ' days'));
  const l3Caret = presenceCaret('Priya Raman', PRESENCE.priya);
  body.append(h2('Why'), p1, h2('Plan'), l1, li(2, 'Ship per-account rate limits before the cut-over.'), li(3, 'Cut reads over, then ', hl, l3Caret, '.'));

  // Comment in the margin.
  const comment = h('div', S({ position: 'absolute', left: DOC.left + DOC.width + 36 + 'px', top: '560px', width: '272px', background: 'var(--card)', borderRadius: '10px', boxShadow: 'var(--e2)', padding: '12px 14px', fontSize: '13px', lineHeight: 1.45 }),
    h('div', S({ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }), avatar('AK', AV.AK, 22), h('b', S({ fontWeight: 600 }), 'Aisha Khan'), h('span', S({ color: 'var(--tx-3)', fontSize: '12px' }), 'now')),
    h('div', S({ color: 'var(--tx)' }), 'Mobile sessions run long. Can we keep it warm for 14 days?'));
  const reply = h('div', S({ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--line-2)' }), avatar('PR', PRESENCE.priya, 20), h('div', {}, h('b', S({ fontWeight: 600 }), 'Priya Raman '), h('span', S({ color: 'var(--tx-2)' }), 'Agreed, updating it now.')));
  comment.append(reply);

  el.append(cover, pageIcon, title, meta, body, comment);
  return { el, saved, askBtn, p1Text, p1Caret, l1Text, l1Code, l1After, l1Key, l1Caret, chip, hlBg, days, l3Caret, comment, reply, presence };
}

// ---------- Ask panel (AI) ----------

export const ANSWER = [
  'This', 'sprint', 'Platform', 'Core', 'shipped', '9', 'issues.', 'Per-account', 'rate', 'limits', 'landed', { c: 1 },
  'and', 'sessions', 'now', 'dual-write', 'to', 'Postgres', 'behind', 'a', 'flag', { c: 2 }, '.',
  'Billing', 'v2', 'is', 'the', 'one', 'risk:', 'its', 'forecast', 'is', '6', 'days', 'past', 'target', { c: 3 }, '.',
  'Aisha', 'asked', 'to', 'keep', 'Redis', 'warm', 'for', '14', 'days,', 'and', 'the', 'RFC', 'now', 'says', 'so', { c: 4 }, '.',
];
const SOURCES = [
  [typeGlyph('task', 15), 'PLT-204', 'Rate limits per account', ['done', 'Done']],
  [typeGlyph('story', 15), 'PLT-211', 'Session store migration to Postgres', ['done', 'Done']],
  [typeGlyph('epic', 15), 'PLT-150', 'Billing v2, forecast Oct 21', ['prog', 'In progress']],
  [icon('file-text', 15), '', 'RFC: Move sessions to Postgres', null],
];

export function askPanel() {
  const scrim = h('div', S({ position: 'absolute', inset: 0, background: 'rgba(16,24,40,.28)', zIndex: 8 }));
  const el = h('div', S({ position: 'absolute', left: '226px', top: '92px', width: '740px', background: 'var(--card)', borderRadius: '14px', zIndex: 9, overflow: 'hidden', height: '125px',
    boxShadow: '0 0 0 1px var(--ai-100), 0 30px 80px -20px rgba(60,40,140,.45), 0 12px 30px -12px rgba(16,24,40,.3)' }));
  const qText = h('span');
  const qCaret = h('span', S({ display: 'inline-block', width: '2px', height: '22px', background: 'var(--ai)', verticalAlign: '-5px', marginLeft: '1px' }));
  const enter = h('div', { class: 'mono', style: { height: '26px', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--ai-100)', background: 'var(--ai-50)', color: 'var(--ai-600)', fontSize: '12px' } }, 'Enter');
  const badge = h('div', S({ display: 'flex', alignItems: 'center', gap: '7px', height: '26px', padding: '0 10px', borderRadius: '13px', background: 'var(--ai-50)', color: 'var(--ai-600)', fontSize: '12.5px', fontWeight: 500 }),
    h('span', S({ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ai)' })), 'AI is on · your model');
  el.append(
    h('div', S({ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--line-2)' }),
      h('div', { class: 'tile', style: { width: '28px', height: '28px', background: 'var(--ai)' } }, icon('sparkles', 15)),
      h('b', S({ fontSize: '15px', fontWeight: 600, color: 'var(--tx)' }), 'Ask Bemmoly'), h('div', S({ flex: 1 })), badge),
    h('div', S({ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 18px', fontSize: '19px', color: 'var(--tx)', borderBottom: '1px solid var(--line-2)' }),
      h('div', S({ flex: 1, minHeight: '26px' }), qText, qCaret), enter));
  const thinking = h('div', S({ height: '4px', margin: '0 18px', borderRadius: '2px', background: 'linear-gradient(90deg, transparent, var(--ai), transparent)', backgroundSize: '50% 100%', backgroundRepeat: 'no-repeat' }));
  const ansHead = h('div', S({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--ai-600)', fontWeight: 500, padding: '16px 18px 8px' }),
    h('span', S({ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ai)' })), 'Answer by AI', h('span', S({ color: 'var(--tx-3)', fontWeight: 400 }), '· from 9 issues and 2 docs'));
  const ans = h('div', S({ padding: '0 18px 4px', fontSize: '16.5px', lineHeight: '27px', color: 'var(--tx)' }));
  const tokens = ANSWER.map((w) => {
    if (typeof w === 'object') {
      // Its own line height, so the number centres in the box and the box sits on the text's line.
      const c = h('span', { class: 'word mono', style: { display: 'inline-block', minWidth: '19px', height: '19px', lineHeight: '17px', padding: '0 5px', marginLeft: '4px', borderRadius: '5px', border: '1px solid var(--ai-100)', background: 'var(--ai-50)', color: 'var(--ai-600)', fontSize: '11.5px', textAlign: 'center', verticalAlign: '1px' } }, String(w.c));
      ans.append(c);
      return c;
    }
    const s = h('span', { class: 'word' }, w);
    // Punctuation sits right after the citation before it, with no space.
    ans.append(...(/^[.,;:]$/.test(w) ? [s] : [document.createTextNode(' '), s]));
    return s;
  });
  const sources = SOURCES.map(([g, key, title, st], i) => h('div', S({ display: 'flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px', whiteSpace: 'nowrap', minWidth: 0 }),
    h('span', { class: 'mono', style: { width: '18px', height: '18px', borderRadius: '5px', background: 'var(--ai-50)', color: 'var(--ai-600)', fontSize: '11px', display: 'grid', placeItems: 'center', flex: 'none' } }, String(i + 1)),
    h('span', S({ color: 'var(--tx-2)', display: 'flex', flex: 'none' }), g), h('span', { class: 'mono', style: { fontSize: '12px', color: 'var(--tx-3)', flex: 'none' } }, key),
    h('span', S({ color: 'var(--tx)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }), title),
    st ? h('span', S({ display: 'flex', flex: 'none' }), statusGlyph(st[0], 13)) : ''));
  const srcWrap = h('div', S({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 18px 8px' }), ...sources);
  const actions = h('div', S({ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px 18px', fontSize: '13px' }),
    h('div', S({ height: '30px', display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--line)', fontWeight: 500, color: 'var(--ai-600)' }), 'Open PLT-150'),
    h('div', S({ height: '30px', display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--line)', fontWeight: 500, color: 'var(--ai-600)' }), 'Read the RFC'),
    h('span', S({ color: 'var(--tx-3)', marginLeft: '6px' }), 'Not useful'));
  el.append(thinking, ansHead, ans, srcWrap, actions);
  return { scrim, el, qText, qCaret, enter, badge, thinking, ansHead, ans, srcWrap, tokens, sources, actions };
}
