// The film engine: pure functions of time. Nothing here keeps state between frames, so any
// moment can be drawn in any order (the capture script jumps straight to frame N).

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BEAT = 0.5; // 120 BPM

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** 0 → 1 as t moves from a to b, clamped. */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
/** 0 → 1 → 0: in over [a, a+i], hold, out over [b-o, b]. */
export const window01 = (t, a, b, i = 0.4, o = 0.4) => Math.min(prog(t, a, a + i), 1 - prog(t, b - o, b));

export const E = {
  linear: (x) => x,
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) =>
    x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
  // Apple-ish "smooth" curve, cubic-bezier(0.22, 1, 0.36, 1) approximated.
  smooth: (x) => 1 - Math.pow(1 - x, 4),
};

/** Eased progress between a and b. */
export const ep = (t, a, b, ease = E.outExpo) => ease(prog(t, a, b));

/**
 * Damped spring step response, 0 → 1 (overshoots when underdamped). `t` in seconds since start.
 */
export function spring(t, { stiffness = 180, damping = 22, mass = 1 } = {}) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/**
 * Keyframes: [[time, value], ...] where value is a number or an array of numbers.
 * Each segment can carry its own ease as a third item on the *destination* key.
 */
export function keys(t, frames, ease = E.inOutCubic) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1, e1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      const k = (e1 || ease)((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], k)) : lerp(v0, v1, k);
    }
  }
  return frames[frames.length - 1][1];
}

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
export function rand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth deterministic wander for ambient drift. */
export const drift = (t, seed, speed = 0.3) =>
  Math.sin(t * speed + seed * 1.7) * 0.6 + Math.sin(t * speed * 1.9 + seed * 3.1) * 0.4;

// ---------- DOM ----------

/** h('div', { class: 'x', style: {...} }, children...) — children are nodes or HTML strings. */
export function h(tag, attrs = {}, ...kids) {
  const svgTags = new Set(['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'defs', 'linearGradient', 'radialGradient', 'stop', 'mask', 'clipPath', 'text', 'filter', 'feGaussianBlur', 'ellipse', 'polygon']);
  const el = svgTags.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    if (typeof kid === 'string') el.insertAdjacentHTML('beforeend', kid);
    else el.append(kid);
  }
  return el;
}

const last = new WeakMap();
/**
 * Writes transform, opacity and filter on an element, skipping writes that wouldn't change.
 * p: { x, y, z, s, sx, sy, rx, ry, rz, o, blur, bright, sat }
 */
export function tf(el, p) {
  const { x = 0, y = 0, z = 0, s = 1, sx = 1, sy = 1, rx = 0, ry = 0, rz = 0 } = p;
  const transform =
    `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px)` +
    (rx ? ` rotateX(${rx.toFixed(3)}deg)` : '') +
    (ry ? ` rotateY(${ry.toFixed(3)}deg)` : '') +
    (rz ? ` rotate(${rz.toFixed(3)}deg)` : '') +
    (s !== 1 || sx !== 1 || sy !== 1 ? ` scale(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)})` : '');
  const o = p.o == null ? '' : clamp(p.o).toFixed(3);
  const f = [];
  if (p.blur > 0.05) f.push(`blur(${p.blur.toFixed(2)}px)`);
  if (p.bright != null && p.bright !== 1) f.push(`brightness(${p.bright.toFixed(3)})`);
  if (p.sat != null && p.sat !== 1) f.push(`saturate(${p.sat.toFixed(3)})`);
  const filter = f.join(' ');
  const prev = last.get(el) || {};
  if (prev.transform !== transform) el.style.transform = transform;
  if (prev.o !== o) el.style.opacity = o;
  if (prev.filter !== filter) el.style.filter = filter;
  last.set(el, { transform, o, filter });
}

/** Show or hide without layout thrash. */
export function show(el, on) {
  const v = on ? '' : 'none';
  if (el.style.display !== v) el.style.display = v;
}

/** Sets a style property only when it changes. */
export function css(el, prop, value) {
  if (el.style.getPropertyValue(prop) !== String(value)) el.style.setProperty(prop, value);
}

/** Sets textContent only when it changes. */
export function text(el, s) {
  if (el.textContent !== s) el.textContent = s;
}
