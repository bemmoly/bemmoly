// Scene 2: the four tiles fly out of the light and lock into the mark; the wordmark wipes in.
import { h, tf, E, ep, prog, spring, lerp, css, clamp } from '../engine.js';
import { markTiles, markSvg, wordmarkSvg, words, revealWords } from '../components.js';

// Final lockup geometry from the brand file (viewBox 103.34 × 24, word at translate(34 -2.2) scale(1.15)).
const MH = 150;
const U = MH / 24;
const LOCK_W = 103.34 * U;
const LX = 960 - LOCK_W / 2;
const LY = 540 - MH / 2 - 50;
const START_SIZE = 300;

// Where each tile starts: offset, depth and spin, so they converge from four directions.
const FLY = [
  { x: -900, y: -520, z: -900, rz: -140, rx: 50, ry: -60, d: 0.0 },
  { x: -760, y: 600, z: 400, rz: 120, rx: -40, ry: 50, d: 0.09 },
  { x: 880, y: -560, z: 300, rz: 160, rx: 60, ry: 40, d: 0.05 },
  { x: 820, y: 520, z: -1100, rz: -110, rx: -50, ry: -50, d: 0.14 },
];

let group, flash, halo, markBox, tiles, sweep, word, wordClip, tag, tagWords, rays;

export default {
  id: 'mark',
  build(root) {
    group = h('div', { class: 'layer' });
    flash = h('div', { class: 'abs', style: { left: '960px', top: '540px', width: '1200px', height: '1200px', marginLeft: '-600px', marginTop: '-600px', borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(160,185,255,.75) 6%, rgba(91,123,229,.35) 22%, rgba(35,86,201,0) 60%)', mixBlendMode: 'screen' } });
    halo = h('div', { class: 'abs', style: { width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,123,229,.38) 0%, rgba(35,86,201,.14) 35%, rgba(35,86,201,0) 65%)', mixBlendMode: 'screen' } });
    rays = h('div', { class: 'abs', style: { left: '960px', top: '540px', width: '2400px', height: '2400px', marginLeft: '-1200px', marginTop: '-1200px',
      background: 'repeating-conic-gradient(from 0deg, rgba(120,150,255,.045) 0deg 2deg, transparent 2deg 12deg)', borderRadius: '50%', mixBlendMode: 'screen',
      maskImage: 'radial-gradient(circle, #000 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 55%)' } });

    const mt = markTiles(MH);
    markBox = mt.el; tiles = mt.tiles;
    css(markBox, 'left', LX + 'px'); css(markBox, 'top', LY + 'px');
    markBox.style.transformOrigin = '50% 50%';

    // A light sweep clipped to the mark's own shape.
    const maskUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(markSvg(MH))}")`;
    sweep = h('div', { class: 'abs', style: { inset: 0, maskImage: maskUrl, WebkitMaskImage: maskUrl, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', mixBlendMode: 'screen',
      backgroundImage: 'linear-gradient(105deg, transparent 0%, transparent 40%, rgba(255,255,255,.85) 50%, transparent 60%, transparent 100%)', backgroundSize: '300% 100%' } });
    markBox.append(sweep);

    wordClip = h('div', { class: 'abs', style: { left: LX + 34 * U + 'px', top: LY - 2.2 * U + 'px', overflow: 'hidden', height: 24 * 1.15 * U + 'px', width: 60.3 * 1.15 * U + 20 + 'px' } });
    word = h('div', { class: 'abs will', style: { left: 0, top: 0 } }, wordmarkSvg(24 * 1.15 * U, '#ffffff'));
    wordClip.append(word);

    tag = h('div', { class: 'abs display', style: { left: 0, width: '1920px', top: LY + MH + 70 + 'px', textAlign: 'center', fontSize: '52px', fontWeight: 500, color: '#cdd6ea', letterSpacing: '-0.02em' } });
    tagWords = words(tag, 'Your work. Your platform.');

    group.append(rays, halo, flash, markBox, wordClip, tag);
    root.append(group);
  },
  update(t) {
    // The point of light blooms and fades (the sprawl collapses into it).
    const fl = t < 0.12 ? E.outCubic(prog(t, 0, 0.12)) : 1 - E.outCubic(prog(t, 0.12, 1.1));
    tf(flash, { s: lerp(0.05, 1.3, E.outExpo(prog(t, 0, 0.9))), o: fl });
    tf(rays, { rz: t * 6, o: 0.9 * ep(t, 0.1, 1.2, E.outCubic) * (1 - ep(t, 4.5, 6.2, E.inOutCubic)), s: 0.8 + t * 0.05 });

    // Tiles converge with springs.
    tiles.forEach((tl, i) => {
      const f = FLY[i];
      const k = spring(t - 0.18 - f.d, { stiffness: 120, damping: 17 });
      const b = Math.max(0, (1 - clamp(spring(t - 0.18 - f.d, { stiffness: 140, damping: 26 }), 0, 1)) * 24);
      tf(tl.el, { x: f.x * (1 - k), y: f.y * (1 - k), z: f.z * (1 - k), rz: f.rz * (1 - k), rx: f.rx * (1 - k), ry: f.ry * (1 - k), o: prog(t, 0.18 + f.d, 0.45 + f.d), blur: b });
    });

    // Mark: big at centre, then glides into the lockup position.
    const m = E.inOutQuint(prog(t, 2.25, 3.25));
    const s0 = START_SIZE / MH;
    const cx0 = 960 - (LX + MH / 2), cy0 = 540 - (LY + MH / 2);
    const breathe = 1 + Math.sin(t * 2.2) * 0.006 * (1 - m);
    tf(markBox, { x: cx0 * (1 - m), y: cy0 * (1 - m), s: lerp(s0, 1, m) * breathe });
    css(sweep, 'background-position', `${lerp(130, -30, E.inOutCubic(prog(t, 1.55, 2.35)))}% 0`);

    const hx = LX + MH / 2 + cx0 * (1 - m) - 450, hy = LY + MH / 2 + cy0 * (1 - m) - 450;
    tf(halo, { x: hx, y: hy, s: lerp(1.1, 1.6, m), o: ep(t, 0.4, 1.4, E.outCubic) * (0.8 + Math.sin(t * 1.6) * 0.1) });

    // The wordmark slides out from behind the mark.
    const w = E.outExpo(prog(t, 2.75, 3.9));
    tf(word, { x: lerp(-60.3 * 1.15 * U - 20, 0, w), o: prog(t, 2.75, 3.0) });

    revealWords(tagWords, t, 3.45, { stagger: 0.09, dur: 1.1, rise: 30, blur: 12 });

    // Exit: everything eases back and dissolves as the promises arrive.
    const x = E.inOutCubic(prog(t, 5.55, 6.4));
    tf(group, { s: 1 - x * 0.08, o: 1 - x, blur: x * 10, y: -x * 30 });
  },
};
