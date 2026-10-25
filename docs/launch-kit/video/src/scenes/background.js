// The stage behind every scene: near-black ink with slow light blooms whose colours follow the act.
import { h, drift, css, E } from '../engine.js';

// Colour per act, [r, g, b] for each of the three blooms, keyed in film seconds.
const BLUE = [35, 86, 201], MID = [91, 123, 229], LILAC = [154, 133, 234], COLD = [70, 78, 96], EMBER = [150, 60, 60], TEAL = [14, 155, 176], ROSE = [194, 83, 106];
const PALETTE = [
  [0, [COLD, COLD, COLD], 0.35],
  [6.5, [EMBER, COLD, COLD], 0.45],
  [8.6, [COLD, COLD, COLD], 0.2],
  [9.4, [BLUE, MID, LILAC], 0.9],
  [15, [BLUE, MID, BLUE], 0.75],
  [25, [BLUE, MID, BLUE], 0.6],
  [53.5, [BLUE, MID, BLUE], 0.6],
  [55, [LILAC, MID, LILAC], 0.75],
  [62.5, [LILAC, MID, LILAC], 0.7],
  [64, [BLUE, MID, BLUE], 0.65],
  [80, [BLUE, MID, BLUE], 0.55],
  [86, [BLUE, TEAL, ROSE], 0.75],
  [99.5, [BLUE, TEAL, ROSE], 0.7],
  [101, [BLUE, MID, LILAC], 0.85],
  [112, [BLUE, MID, LILAC], 0.6],
];

function paletteAt(T) {
  let i = 1;
  while (i < PALETTE.length - 1 && T > PALETTE[i][0]) i++;
  const [t0, c0, a0] = PALETTE[i - 1], [t1, c1, a1] = PALETTE[i];
  const k = E.inOutCubic(Math.min(1, Math.max(0, (T - t0) / (t1 - t0))));
  return { cols: c0.map((c, j) => c.map((v, n) => Math.round(v + (c1[j][n] - v) * k))), a: a0 + (a1 - a0) * k };
}

let blooms = [];
let base;

export default {
  id: 'background',
  build(root) {
    base = h('div', { class: 'layer', style: { background: 'radial-gradient(ellipse 120% 90% at 50% 40%, #0b0f17 0%, #05070a 70%)' } });
    root.append(base);
    blooms = [0, 1, 2].map(() => {
      const b = h('div', { class: 'abs', style: { width: '1500px', height: '1500px', left: '-750px', top: '-750px', borderRadius: '50%', mixBlendMode: 'screen', willChange: 'transform, background' } });
      root.append(b);
      return b;
    });
  },
  update(T) {
    const { cols, a } = paletteAt(T);
    const spots = [
      [460 + drift(T, 1, 0.25) * 160, 300 + drift(T, 2, 0.2) * 120, 1.0],
      [1480 + drift(T, 3, 0.22) * 180, 760 + drift(T, 4, 0.18) * 140, 0.9],
      [1100 + drift(T, 5, 0.17) * 260, 180 + drift(T, 6, 0.21) * 120, 0.65],
    ];
    blooms.forEach((b, i) => {
      const [x, y, s] = spots[i];
      const [r, g, bl] = cols[i];
      css(b, 'background', `radial-gradient(circle, rgba(${r},${g},${bl},${(0.42 * a).toFixed(3)}) 0%, rgba(${r},${g},${bl},${(0.12 * a).toFixed(3)}) 35%, rgba(${r},${g},${bl},0) 68%)`);
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s})`;
    });
  },
};
