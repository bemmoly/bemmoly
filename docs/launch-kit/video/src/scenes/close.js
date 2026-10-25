// Scene 10: the close. What it costs, what it is, and where to get it.
import { h, tf, E, ep, prog, spring, lerp, css, text, rand } from '../engine.js';
import { icon, markTiles, wordmarkSvg, words, revealWords } from '../components.js';

const STATS = [
  { big: '$0', label: 'per seat, forever' },
  { big: '∞', label: 'seats, no limits' },
  { big: 'MIT', label: 'licence, every line' },
];
const MANTRA = ['Open source.', 'Free.', 'Forever.', 'Yours.'];
const MH = 120, U = MH / 24, LOCK_W = 103.34 * U, LX = 960 - LOCK_W / 2, LY = 330;

let headWords, cards = [], mantra = [], endGroup, markBox, tiles, wordClip, word, tagWords, ctas = [], halo, priceEl;

export default {
  id: 'close',
  build(root) {
    const head = h('div', { class: 'abs display', style: { left: 0, width: '1920px', top: '470px', textAlign: 'center', fontSize: '100px', color: '#fff' } });
    headWords = words(head, 'Everything your company runs on.');
    root.append(head);

    // Three stat cards, each its own perspective so they can tilt without intersecting.
    cards = STATS.map((s, i) => {
      const c = h('div', { class: 'abs', style: { left: 280 + i * 480 + 'px', top: '330px', width: '420px', height: '420px', borderRadius: '28px',
        background: 'linear-gradient(160deg, rgba(255,255,255,.09), rgba(255,255,255,.02))', boxShadow: '0 0 0 1px rgba(255,255,255,.1), 0 40px 100px -30px rgba(0,0,0,.8)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' } });
      const big = h('div', { class: 'display', style: { fontSize: s.big === '∞' ? '210px' : '170px', color: '#fff', lineHeight: 1, fontWeight: 600, background: 'linear-gradient(180deg,#fff 30%,#a9bdf6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' } }, s.big);
      const lab = h('div', { style: { fontSize: '30px', color: '#a9b3c8', fontWeight: 500 } }, s.label);
      c.append(big, lab);
      root.append(c);
      if (i === 0) priceEl = big;
      return c;
    });

    mantra = MANTRA.map((m) => {
      const el = h('div', { class: 'abs display', style: { left: 0, width: '1920px', top: '440px', textAlign: 'center', fontSize: '150px', color: '#fff' } }, m);
      root.append(el);
      return el;
    });

    // End card.
    endGroup = h('div', { class: 'layer' });
    halo = h('div', { class: 'abs', style: { left: '360px', top: '40px', width: '1200px', height: '800px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(91,123,229,.32) 0%, rgba(35,86,201,.1) 40%, transparent 68%)' } });
    const mt = markTiles(MH);
    markBox = mt.el; tiles = mt.tiles;
    css(markBox, 'left', LX + 'px'); css(markBox, 'top', LY + 'px');
    wordClip = h('div', { class: 'abs', style: { left: LX + 34 * U + 'px', top: LY - 2.2 * U + 'px', overflow: 'hidden', height: 27.6 * U + 'px', width: 69.35 * U + 20 + 'px' } });
    word = h('div', { class: 'abs' }, wordmarkSvg(27.6 * U, '#fff'));
    wordClip.append(word);
    const tag = h('div', { class: 'abs display', style: { left: 0, width: '1920px', top: LY + MH + 56 + 'px', textAlign: 'center', fontSize: '46px', fontWeight: 500, color: '#cdd6ea', letterSpacing: '-0.02em' } });
    tagWords = words(tag, 'Your work. Your platform.');
    const row = h('div', { class: 'abs', style: { left: 0, width: '1920px', top: LY + MH + 170 + 'px', display: 'flex', justifyContent: 'center', gap: '22px' } });
    const btn = (label, ic, primary) => h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', height: '76px', padding: '0 34px', borderRadius: '14px', fontSize: '30px', fontWeight: 600,
      color: '#fff', background: primary ? '#2356c9' : 'rgba(255,255,255,.07)', boxShadow: primary ? '0 20px 50px -14px rgba(35,86,201,.8), inset 0 1px 0 rgba(255,255,255,.2)' : '0 0 0 1px rgba(255,255,255,.16)' } }, icon(ic, 30, 2.2), label);
    ctas = [btn('bemmoly.com', 'globe', true), btn('github.com/bemmoly/bemmoly', 'star', false)];
    row.append(...ctas);
    const foot = h('div', { class: 'abs', style: { left: 0, width: '1920px', top: LY + MH + 290 + 'px', textAlign: 'center', fontSize: '24px', color: '#8b95aa' } },
      'Try the live demo, or install it on your own server with one command.');
    ctas.push(foot);
    endGroup.append(halo, markBox, wordClip, tag, row, foot);
    root.append(endGroup);
  },
  update(t) {
    revealWords(headWords, t, 0.15, { stagger: 0.07, dur: 1.0, rise: 70, blur: 16, out: 2.4, outDur: 0.45 });

    // Stats: rise in 3D, the price counts down to $0.
    cards.forEach((c, i) => {
      const a = 2.75 + i * 0.14;
      const k = spring(t - a, { stiffness: 120, damping: 15 });
      const x = E.inCubic(prog(t, 5.15 + i * 0.05, 5.6 + i * 0.05));
      const ry = (i - 1) * -16 * (1 - k) + (i - 1) * 5;
      css(c, 'transform', `perspective(2200px) translate3d(0px, ${((1 - k) * 260 - x * 60).toFixed(1)}px, ${((1 - k) * -500 + x * 300).toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${((1 - k) * 30).toFixed(2)}deg)`);
      css(c, 'opacity', (prog(t, a, a + 0.25) * (1 - x)).toFixed(3));
      css(c, 'filter', x > 0.01 ? `blur(${(x * 14).toFixed(1)}px)` : 'none');
    });
    // A slot-machine roll that lands on zero.
    const roll = t < 3.75 ? Math.floor(rand(Math.floor(t * 24)) * 10) : 0;
    text(priceEl, '$' + roll);

    // Mantra, one word per beat.
    mantra.forEach((el, i) => {
      const a = 5.55 + i * 0.5;
      const k = E.outExpo(prog(t, a, a + 0.5));
      const out = i === MANTRA.length - 1 ? E.inCubic(prog(t, 8.0, 8.35)) : E.inCubic(prog(t, a + 0.42, a + 0.55));
      tf(el, { s: lerp(1.25, 1, k) * (1 - out * 0.1), o: k * (1 - out), blur: (1 - k) * 18 + out * 10 });
    });

    // End card: the tiles snap together, the wordmark slides out, links rise.
    const e0 = 8.15;
    tiles.forEach((tl, i) => {
      const dir = [[-1, -1], [-1, 1], [1, -1], [1, 1]][i];
      const k = spring(t - e0 - i * 0.05, { stiffness: 170, damping: 17 });
      tf(tl.el, { x: dir[0] * 160 * (1 - k), y: dir[1] * 160 * (1 - k), rz: dir[0] * dir[1] * 45 * (1 - k), s: lerp(0.4, 1, Math.min(1, k)), o: prog(t, e0 + i * 0.05, e0 + 0.2 + i * 0.05) });
    });
    const m = E.inOutQuint(prog(t, e0 + 0.7, e0 + 1.5));
    const cx0 = 960 - (LX + MH / 2);
    tf(markBox, { x: cx0 * (1 - m), s: lerp(1.5, 1, m) });
    tf(word, { x: lerp(-69.35 * U - 20, 0, E.outExpo(prog(t, e0 + 1.1, e0 + 2.1))) });
    revealWords(tagWords, t, e0 + 1.5, { stagger: 0.08, dur: 1.0, rise: 26, blur: 10 });
    ctas.forEach((c, i) => {
      const k = E.outExpo(prog(t, e0 + 1.9 + i * 0.12, e0 + 2.9 + i * 0.12));
      tf(c, { y: (1 - k) * 40, o: k, blur: (1 - k) * 8 });
    });
    tf(halo, { o: ep(t, e0, e0 + 1.5, E.outCubic) * (0.85 + Math.sin(t * 1.4) * 0.12), s: 1 + Math.sin(t * 0.8) * 0.03 });
    tf(endGroup, { o: prog(t, e0 - 0.05, e0 + 0.05), s: 1 + prog(t, e0, 12) * 0.03 });
  },
};
