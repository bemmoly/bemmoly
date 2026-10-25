// Shared drawn parts. Each returns DOM plus, where it moves, a small update function of time.
import { ICONS } from './icons.js';
import { h, tf, E, ep, prog, clamp, lerp, spring, css } from './engine.js';

export function icon(name, size = 16, stroke = 2, color = 'currentColor') {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

export function tile(iconName, color, size = 40, iconSize) {
  return h('div', { class: 'tile', style: { width: size + 'px', height: size + 'px', background: color } },
    icon(iconName, iconSize || Math.round(size * 0.5), 2));
}

// ---------- The mark, as four separately movable tiles ----------
// Paths are the brand file's (packages/ui/assets/brand/mark-color.svg), never redrawn.
const MARK_G = 'translate(-3.3468 -3.3599) scale(0.06)';
const TILE_PATHS = [
  ['#2356C9', 'M100.850,252.884 C99.937,252.731 96.849,251.842 93.988,250.909 C83.521,247.494 74.358,239.397 69.391,229.173 C64.880,219.889 64.970,221.175 64.970,165.865 C64.970,118.454 65.034,115.763 66.278,110.899 C70.229,95.453 82.126,82.880 97.860,77.523 C103.001,75.773 103.866,75.693 124.106,75.108 C153.824,74.249 209.378,74.942 215.468,76.248 C230.155,79.397 240.904,90.645 243.478,105.556 C244.272,110.163 244.398,120.617 244.217,167.107 C244.013,219.273 243.915,223.360 242.782,226.764 C238.369,240.016 229.331,248.808 216.835,252.004 C211.782,253.296 209.716,253.339 157.057,253.252 C127.057,253.202 101.764,253.036 100.850,252.884 Z', [24.8, 27.3]],
  ['#2356C9', 'M99.854,454.909 C97.296,454.369 92.661,452.708 89.555,451.218 C84.943,449.007 82.865,447.460 78.226,442.786 C71.722,436.233 68.353,430.476 66.280,422.372 C65.026,417.468 64.970,414.803 64.970,359.987 C64.970,305.572 65.034,302.475 66.254,297.705 C70.074,282.770 79.940,272.007 94.545,266.846 L99.854,264.970 154.775,264.782 C215.517,264.574 215.042,264.547 223.629,268.757 C229.651,271.710 236.732,278.753 239.563,284.607 C243.803,293.373 243.687,291.273 243.698,359.699 C243.704,400.955 243.469,423.195 242.997,425.812 C241.093,436.386 233.160,446.953 223.593,451.661 C214.746,456.014 215.257,455.982 156.997,455.934 C113.335,455.899 103.723,455.726 99.854,454.909 Z', [24.8, 76]],
  ['#9A85EA', 'M344.581,244.650 C330.698,243.710 295.296,237.973 288.186,235.511 C268.278,228.616 256.332,213.228 256.332,194.477 C256.332,189.465 270.523,90.474 272.616,80.888 C275.977,65.490 287.355,56.000 302.453,56.000 C309.329,56.000 349.807,63.883 372.279,69.598 C394.814,75.329 408.807,82.412 421.205,94.364 C428.596,101.489 432.673,106.855 436.967,115.111 C444.178,128.977 446.699,139.360 446.650,155.003 C446.621,164.534 446.389,166.882 444.876,172.973 C438.508,198.599 423.826,218.471 401.224,232.055 C391.026,238.184 374.541,243.551 363.381,244.375 C360.600,244.580 356.980,244.844 355.336,244.962 C353.691,245.079 348.851,244.939 344.581,244.650 Z', [73.5, 23.5]],
  ['#5B7BE5', 'M283.094,455.019 C270.966,452.315 261.158,442.916 257.955,430.928 C256.790,426.567 256.704,400.704 257.629,332.744 C258.063,300.907 258.317,294.261 259.225,291.045 C262.982,277.735 272.950,268.338 286.233,265.583 C293.514,264.073 360.494,264.563 367.855,266.180 C387.225,270.437 400.033,277.210 412.511,289.795 C427.175,304.584 436.351,323.468 439.362,345.051 C442.341,366.413 438.262,387.529 427.426,406.836 C413.714,431.266 391.226,447.881 363.441,454.109 C357.345,455.475 355.114,455.564 322.113,455.747 C294.229,455.903 286.399,455.756 283.094,455.019 Z', [73, 76]],
];

/** The static mark as an SVG string. */
export function markSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><g transform="${MARK_G}">${TILE_PATHS.map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('')}</g></svg>`;
}

/** The mark split into four layers that can each fly; returns { el, tiles: [{el, origin}] }. */
export function markTiles(size) {
  const el = h('div', { class: 'abs', style: { width: size + 'px', height: size + 'px', transformStyle: 'preserve-3d' } });
  const tiles = TILE_PATHS.map(([c, d, o]) => {
    const t = h('div', { class: 'abs will', style: { inset: 0, transformOrigin: `${o[0]}% ${o[1]}%` } },
      `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block;overflow:visible"><g transform="${MARK_G}"><path fill="${c}" d="${d}"/></g></svg>`);
    el.append(t);
    return { el: t, origin: o, color: c };
  });
  return { el, tiles };
}

/** The wordmark from the brand file, in a given colour. */
const WORDMARK_D = 'M6.10 17.25L1.15 17.25L1.15 7.48L5.67 7.48Q6.87 7.48 7.57 8.16Q8.26 8.85 8.26 9.98Q8.26 10.73 8.01 11.17Q7.76 11.62 7.36 11.83Q6.96 12.04 6.51 12.08L6.51 12.17Q6.83 12.17 7.20 12.29Q7.560 12.42 7.89 12.69Q8.22 12.95 8.42 13.39Q8.62 13.82 8.62 14.45Q8.62 15.23 8.29 15.86Q7.97 16.49 7.40 16.87Q6.83 17.25 6.10 17.25M5.57 13.06L3 13.06L3 15.68L5.57 15.68Q5.92 15.68 6.17 15.56Q6.43 15.43 6.56 15.19Q6.69 14.95 6.69 14.62L6.69 14.14Q6.69 13.79 6.56 13.55Q6.43 13.32 6.17 13.19Q5.92 13.06 5.57 13.06M5.28 9.05L3 9.05L3 11.55L5.28 11.55Q5.61 11.55 5.85 11.43Q6.09 11.30 6.22 11.07Q6.34 10.84 6.34 10.52L6.34 10.08Q6.34 9.76 6.22 9.52Q6.09 9.28 5.85 9.16Q5.61 9.05 5.28 9.05M13.13 17.42Q12.05 17.42 11.28 16.95Q10.51 16.48 10.10 15.62Q9.69 14.76 9.69 13.58Q9.69 12.43 10.09 11.57Q10.50 10.71 11.26 10.24Q12.01 9.77 13.08 9.77Q14.22 9.77 14.96 10.28Q15.69 10.78 16.05 11.62Q16.41 12.45 16.41 13.46L16.41 14.04L11.55 14.04L11.55 14.23Q11.55 15.01 12 15.50Q12.45 15.99 13.33 15.99Q13.99 15.99 14.42 15.70Q14.85 15.42 15.19 15L16.16 16.07Q15.71 16.68 14.93 17.05Q14.15 17.42 13.13 17.42M13.10 11.12Q12.63 11.12 12.28 11.34Q11.93 11.55 11.74 11.94Q11.55 12.32 11.55 12.83L11.55 12.94L14.55 12.94L14.55 12.81Q14.55 12.29 14.38 11.92Q14.21 11.55 13.89 11.34Q13.57 11.12 13.10 11.12M19.64 12.42L19.64 17.25L17.85 17.25L17.85 9.94L19.64 9.94L19.64 11.16L19.71 11.16Q19.92 10.59 20.39 10.18Q20.86 9.77 21.67 9.77Q22.43 9.77 22.98 10.14Q23.53 10.50 23.79 11.24L23.81 11.24Q24.01 10.64 24.60 10.21Q25.19 9.77 26.05 9.77Q27.12 9.77 27.71 10.52Q28.29 11.27 28.29 12.63L28.29 17.25L26.50 17.25L26.50 12.81Q26.50 12.03 26.21 11.64Q25.93 11.24 25.33 11.24Q24.98 11.24 24.66 11.38Q24.35 11.51 24.16 11.77Q23.97 12.03 23.97 12.42L23.97 17.25L22.18 17.25L22.18 12.81Q22.18 12.03 21.88 11.64Q21.59 11.24 21 11.24Q20.66 11.24 20.35 11.38Q20.03 11.51 19.84 11.77Q19.64 12.03 19.64 12.42M31.93 12.42L31.93 17.25L30.14 17.25L30.14 9.94L31.93 9.94L31.93 11.16L32 11.16Q32.21 10.59 32.68 10.18Q33.15 9.77 33.96 9.77Q34.72 9.77 35.27 10.14Q35.83 10.50 36.08 11.24L36.11 11.24Q36.30 10.64 36.89 10.21Q37.48 9.77 38.35 9.77Q39.41 9.77 40 10.52Q40.59 11.27 40.59 12.63L40.59 17.25L38.79 17.25L38.79 12.81Q38.79 12.03 38.51 11.64Q38.22 11.24 37.62 11.24Q37.27 11.24 36.95 11.38Q36.64 11.51 36.45 11.77Q36.26 12.03 36.26 12.42L36.26 17.25L34.47 17.25L34.47 12.81Q34.47 12.03 34.17 11.64Q33.88 11.24 33.29 11.24Q32.96 11.24 32.64 11.38Q32.33 11.51 32.13 11.77Q31.93 12.03 31.93 12.42M45.33 17.42Q44.30 17.42 43.53 16.95Q42.77 16.48 42.36 15.62Q41.94 14.76 41.94 13.58Q41.94 12.41 42.36 11.56Q42.77 10.71 43.53 10.24Q44.30 9.77 45.33 9.77Q46.38 9.77 47.15 10.24Q47.91 10.71 48.32 11.56Q48.73 12.41 48.73 13.58Q48.73 14.76 48.32 15.62Q47.91 16.48 47.15 16.95Q46.38 17.42 45.33 17.42M45.33 15.98Q46.05 15.98 46.45 15.54Q46.86 15.09 46.86 14.27L46.86 12.91Q46.86 12.08 46.45 11.65Q46.05 11.22 45.33 11.22Q44.65 11.22 44.23 11.65Q43.82 12.08 43.82 12.91L43.82 14.27Q43.82 15.09 44.23 15.54Q44.65 15.98 45.33 15.98M52.93 15.82L52.93 17.25L51.97 17.25Q51.06 17.25 50.62 16.79Q50.18 16.33 50.18 15.49L50.18 6.89L51.97 6.89L51.97 15.82M56.85 15.65L57.36 13.81L58.63 9.94L60.31 9.94L57.37 18.55Q57.19 19.07 56.94 19.41Q56.69 19.740 56.29 19.90Q55.89 20.05 55.29 20.05L54.21 20.05L54.21 18.62L55.52 18.62L55.86 17.60L53.24 9.94L55.02 9.94L56.29 13.81L56.77 15.65';
export function wordmarkSvg(height, color = '#fff') {
  const w = (height * 60.3) / 24;
  return `<svg width="${w}" height="${height}" viewBox="0 0 60.3 24" style="display:block"><path fill="${color}" d="${WORDMARK_D}"/></svg>`;
}
/** Lockup proportions from the brand file: word at 115% of the mark, 10 units apart (viewBox 103.34 × 24). */
export function lockupSvg(height, color = '#fff') {
  const w = (height * 103.34) / 24;
  // Fill as a style too, so a CSS variable (var(--tx)) follows the theme.
  return `<svg width="${w}" height="${height}" viewBox="0 0 103.34 24" style="display:block"><g transform="${MARK_G}">${TILE_PATHS.map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('')}</g><path transform="translate(34 -2.2) scale(1.15)" fill="${color}" style="fill:${color}" d="${WORDMARK_D}"/></svg>`;
}

// ---------- Kinetic type ----------

/** Splits text into word spans inside el. Returns the spans. Supports <b>…</b>-free plain text. */
export function words(el, str, cls = '') {
  el.innerHTML = '';
  return str.split(/(\s+)/).filter((s) => s.length).map((w) => {
    if (/^\s+$/.test(w)) { el.append(document.createTextNode(' ')); return null; }
    const s = h('span', { class: 'word ' + cls }, w.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    el.append(s);
    return s;
  }).filter(Boolean);
}

/**
 * Reveals word spans: rise from below with blur, staggered. `t` local seconds; returns nothing.
 * out: optional time at which the words leave (rise up and blur away).
 */
export function revealWords(spans, t, start, { stagger = 0.06, dur = 0.9, rise = 46, blur = 14, out = null, outDur = 0.5, outStagger = 0.025 } = {}) {
  spans.forEach((s, i) => {
    const k = E.outExpo(prog(t, start + i * stagger, start + i * stagger + dur));
    let y = (1 - k) * rise, o = k, b = (1 - k) * blur;
    if (out != null) {
      const q = E.inCubic(prog(t, out + i * outStagger, out + i * outStagger + outDur));
      y -= q * rise * 0.8; o *= 1 - q; b += q * blur;
    }
    tf(s, { y, o, blur: b });
  });
}

// ---------- Cursor ----------

export function cursor() {
  const el = h('div', { class: 'abs will', style: { left: 0, top: 0, width: '28px', height: '28px', zIndex: 50, pointerEvents: 'none' } });
  const ripple = h('div', { class: 'abs', style: { left: '-22px', top: '-22px', width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(91,123,229,.9)', opacity: 0 } });
  el.append(ripple);
  el.insertAdjacentHTML('beforeend', `<svg width="28" height="28" viewBox="0 0 28 28" style="position:absolute;left:-4px;top:-2px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))"><path d="M5 3 L5 22 L10 17.5 L13.6 25.5 L17 24 L13.5 16.2 L20.5 16 Z" fill="#111" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`);
  const arrow = el.lastChild;
  /**
   * path: [[t, x, y], ...] positions; clicks: [t, ...]. Movement uses inOutCubic between keys.
   */
  function update(t, path, clicks = [], { o = 1 } = {}) {
    let x = path[0][1], y = path[0][2];
    for (let i = 1; i < path.length; i++) {
      const [t1, x1, y1] = path[i];
      const [t0, x0, y0] = path[i - 1];
      if (t <= t0) break;
      const k = E.inOutCubic(prog(t, t0, t1));
      x = lerp(x0, x1, k); y = lerp(y0, y1, k);
    }
    let press = 0, rip = 0, ripO = 0;
    for (const c of clicks) {
      const d = t - c;
      if (d > -0.08 && d < 0.18) press = Math.max(press, 1 - Math.abs(d - 0.04) / 0.14);
      if (d >= 0 && d < 0.6) { rip = E.outCubic(d / 0.6); ripO = 1 - d / 0.6; }
    }
    tf(el, { x, y, o });
    tf(arrow, { s: 1 - press * 0.16 });
    tf(ripple, { s: 0.3 + rip * 1.2, o: ripO });
  }
  return { el, update };
}

// ---------- Drawn check badge ----------

export function checkBadge(size = 64, color = '#2356c9') {
  const el = h('div', { class: 'abs', style: { width: size + 'px', height: size + 'px' } });
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 64 64" style="display:block;overflow:visible">
    <circle cx="32" cy="32" r="30" fill="${color}" class="cb-fill"/>
    <circle cx="32" cy="32" r="30" fill="none" stroke="${color}" stroke-width="3" class="cb-ring" stroke-dasharray="188.5" transform="rotate(-90 32 32)"/>
    <path d="M19 33 L28 42 L46 23" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" class="cb-check" stroke-dasharray="42"/></svg>`;
  const fill = el.querySelector('.cb-fill'), ring = el.querySelector('.cb-ring'), chk = el.querySelector('.cb-check');
  function update(t, start) {
    const r = E.outCubic(prog(t, start, start + 0.45));
    const f = spring(t - start - 0.25, { stiffness: 260, damping: 18 });
    const c = E.outCubic(prog(t, start + 0.35, start + 0.75));
    ring.setAttribute('stroke-dashoffset', (188.5 * (1 - r)).toFixed(2));
    fill.setAttribute('r', (clamp(f, 0, 1.2) * 30).toFixed(2));
    chk.setAttribute('stroke-dashoffset', (42 * (1 - c)).toFixed(2));
    tf(el, { o: prog(t, start, start + 0.1) });
  }
  return { el, update };
}

// ---------- App window with the Bemmoly frame ----------

/**
 * A product window: traffic lights, then the app frame — BrandBlock sidebar (lockup, workspace
 * name), nav, and a content area. Returns { el, content, side, nav }.
 */
export function appWindow({ w = 1440, h: hh = 860, theme = 'ui-light', nav = [], active = '', projects = [] } = {}) {
  const el = h('div', { class: `win ${theme}`, style: { width: w + 'px', height: hh + 'px' } });
  const bar = h('div', { class: 'bar' }, h('span', { class: 'dot', style: { background: '#ff5f57' } }), h('span', { class: 'dot', style: { background: '#febc2e' } }), h('span', { class: 'dot', style: { background: '#28c840' } }),
    h('div', { style: { flex: 1, display: 'flex', justifyContent: 'center' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', height: '24px', padding: '0 12px', borderRadius: '6px', background: 'var(--sunken)', border: '1px solid var(--line)', fontSize: '12px', color: 'var(--tx-3)' } },
        icon('lock', 12, 2), 'work.acmelabs.dev')), h('div', { style: { width: '52px' } }));
  const body = h('div', { style: { display: 'flex', height: `calc(100% - 40px)` } });
  const side = h('div', { style: { width: '248px', flex: 'none', background: 'var(--side)', borderRight: '1px solid var(--line)', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' } });
  side.append(
    h('div', { style: { padding: '2px 6px 12px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, lockupSvg(20, 'var(--tx)'), h('span', { style: { color: 'var(--tx-3)' } }, icon('panel-left', 16))),
      h('div', { style: { fontSize: '12px', color: 'var(--tx-3)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px' } }, 'Acme Labs', icon('chevron-down', 12))),
    h('div', { style: { display: 'flex', gap: '6px', marginBottom: '10px' } },
      h('div', { style: { flex: 1, height: '32px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--card)', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', color: 'var(--tx-3)' } }, icon('search', 14), 'Search', h('span', { class: 'mono', style: { marginLeft: 'auto', fontSize: '11px', padding: '1px 5px', border: '1px solid var(--line)', borderRadius: '4px' } }, '⌘K')),
      h('div', { style: { width: '32px', height: '32px', borderRadius: '6px', background: 'var(--acc-fill)', color: 'var(--on-acc)', display: 'grid', placeItems: 'center' } }, icon('plus', 16))),
  );
  const navEls = {};
  const row = (ic, label, { badge, indent = 0, tileColor, id } = {}) => {
    const r = h('div', { style: { height: '32px', display: 'flex', alignItems: 'center', gap: '10px', padding: `0 8px 0 ${8 + indent}px`, borderRadius: '6px', color: 'var(--tx-2)', fontWeight: 500 } },
      tileColor ? h('div', { class: 'tile', style: { width: '18px', height: '18px', background: tileColor, fontSize: '10px', fontWeight: 600 } }, label[0]) : icon(ic, 16),
      h('span', {}, label), badge ? h('span', { style: { marginLeft: 'auto', fontSize: '11px', fontWeight: 600, background: 'var(--acc-fill)', color: '#fff', borderRadius: '9px', padding: '0 6px', lineHeight: '17px' } }, badge) : null);
    navEls[id || label] = r;
    return r;
  };
  const sec = (label) => h('div', { style: { fontSize: '11px', color: 'var(--tx-3)', fontWeight: 500, padding: '14px 8px 6px' } }, label);
  side.append(row('house', 'Home'), row('inbox', 'Inbox', { badge: '4' }), row('circle-user', 'My issues'));
  for (const item of nav) {
    if (item.section) side.append(sec(item.section));
    else side.append(row(item.icon, item.label, item));
  }
  side.append(h('div', { style: { marginTop: 'auto', fontSize: '11px', color: 'var(--tx-3)', padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' } }, markSvg(12), 'Bemmoly 1.5 · What\'s new'));
  const content = h('div', { style: { flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--canvas)' } });
  body.append(side, content);
  el.append(bar, body);
  const setActive = (id) => {
    for (const [k, r] of Object.entries(navEls)) {
      const on = k === id;
      css(r, 'background', on ? 'var(--card)' : 'transparent');
      css(r, 'box-shadow', on ? 'var(--e1)' : 'none');
      css(r, 'color', on ? 'var(--tx)' : 'var(--tx-2)');
    }
  };
  if (active) setActive(active);
  return { el, content, side, navEls, setActive };
}

// ---------- Small UI atoms ----------

export const avatar = (initials, color, size = 22) =>
  h('div', { style: { width: size + 'px', height: size + 'px', borderRadius: '50%', background: color, color: '#fff', fontSize: Math.round(size * 0.42) + 'px', fontWeight: 600, display: 'grid', placeItems: 'center', flex: 'none' } }, initials);

/** Issue type glyph: small rounded square in the type colour with a white mark. */
export const typeGlyph = (type, size = 16) => {
  const c = { task: 'var(--type-task)', bug: 'var(--type-bug)', story: 'var(--type-story)', epic: 'var(--type-epic)' }[type];
  const inner = { task: '<path d="M4.5 8.2 7 10.6 11.5 5.6" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    bug: '<circle cx="8" cy="8" r="3" fill="#fff"/>', story: '<path d="M5 4h6v8l-3-2-3 2z" fill="#fff"/>', epic: '<path d="M8.8 3.5 5 8.6h3l-.8 3.9L11 7.4H8z" fill="#fff"/>' }[type];
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="${c}"/>${inner}</svg>`;
};

/** Status glyph by category: todo ring, in-progress half, done check. */
export const statusGlyph = (cat, size = 14) => {
  if (cat === 'done') return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 14 14"><circle cx="7" cy="7" r="7" fill="var(--done)"/><path d="M4 7.2 6 9.2 10 5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (cat === 'prog') return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="var(--prog)" stroke-width="1.6"/><path d="M7 3a4 4 0 0 1 0 8z" fill="var(--prog)"/></svg>`;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="var(--todo)" stroke-width="1.6" stroke-dasharray="2.4 1.6"/></svg>`;
};

/** A soft pill label. */
export const pill = (label, fg, bg, extra = {}) =>
  h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '24px', padding: '0 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 500, color: fg, background: bg, whiteSpace: 'nowrap', ...extra } }, label);

// ---------- Scene caption (one look for every scene) ----------

/**
 * Eyebrow (optional product tile + name), a display title and an optional sub line.
 * Position it with left/top (px); align 'left' or 'center'. update(t, start, out?) animates it in
 * (and out at `out`).
 */
export function caption({ eyebrow, tileIcon, tileColor, title, sub, left = 120, top = 140, width = 760, align = 'left', size = 64 }) {
  const el = h('div', { class: 'abs', style: { left: left + 'px', top: top + 'px', width: width + 'px', textAlign: align } });
  let eb = null, ebSpans = [], tileEl = null;
  if (eyebrow) {
    eb = h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', justifyContent: align === 'center' ? 'center' : 'flex-start' } });
    if (tileIcon) { tileEl = tile(tileIcon, tileColor, 40); eb.append(tileEl); }
    const ebt = h('div', { class: 'eyebrow', style: { fontSize: '26px', color: '#c9d3ea', fontWeight: 600, letterSpacing: '-0.01em' } });
    ebSpans = words(ebt, eyebrow);
    eb.append(ebt);
    el.append(eb);
  }
  const ti = h('div', { class: 'display', style: { fontSize: size + 'px', color: '#fff' } });
  const tiSpans = words(ti, title);
  el.append(ti);
  let suSpans = [];
  if (sub) {
    const su = h('div', { style: { fontSize: '26px', lineHeight: 1.45, color: '#a9b3c8', marginTop: '22px', fontWeight: 400 } });
    suSpans = words(su, sub);
    el.append(su);
  }
  function update(t, start, out = null) {
    if (tileEl) {
      const k = spring(t - start, { stiffness: 220, damping: 18 });
      tf(tileEl, { s: Math.max(0, k), rz: (1 - k) * -25, o: prog(t, start, start + 0.15) * (out == null ? 1 : 1 - prog(t, out, out + 0.35)) });
    }
    revealWords(ebSpans, t, start + 0.05, { stagger: 0.05, dur: 0.8, rise: 22, blur: 8, out });
    revealWords(tiSpans, t, start + 0.15, { stagger: 0.055, dur: 0.95, rise: 50, blur: 14, out: out == null ? null : out + 0.05 });
    revealWords(suSpans, t, start + 0.45, { stagger: 0.025, dur: 0.9, rise: 24, blur: 8, out: out == null ? null : out + 0.1 });
  }
  return { el, update };
}
