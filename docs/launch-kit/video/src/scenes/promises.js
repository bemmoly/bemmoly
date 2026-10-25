// Scene 3: the three promises, one at a time, then together beside everything that isn't there.
import { h, tf, E, ep, prog, css } from '../engine.js';
import { checkBadge, words, revealWords } from '../components.js';

const PROMISES = [
  ['100% open source.', 'MIT licence. No open core. No enterprise edition.'],
  ['No subscription.', 'No seats to count, no plans, no licence key.'],
  ['No in-app purchases.', 'No paywalls, no upsells, no “contact sales”.'],
];
const SLOT = 2.45; // seconds per promise
const NOT_THERE = ['Seat limits', 'Per-user pricing', 'Premium tiers', 'Upgrade to unlock', 'Contact sales', 'Licence keys', 'Feature gates', 'Trials that expire'];

let big = [], small = [], strikes = [], wrapAll, rightHead, rightHeadWords, glow;

export default {
  id: 'promises',
  build(root) {
    wrapAll = h('div', { class: 'layer' });
    glow = h('div', { class: 'abs', style: { left: '160px', top: '140px', width: '1600px', height: '800px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(35,86,201,.28) 0%, rgba(35,86,201,0) 65%)' } });
    wrapAll.append(glow);

    big = PROMISES.map(([title, sub]) => {
      const row = h('div', { class: 'abs', style: { left: 0, width: '1920px', top: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '44px' } });
      const badgeBox = h('div', { style: { position: 'relative', width: '112px', height: '112px', flex: 'none' } });
      const badge = checkBadge(112, '#2356c9');
      badgeBox.append(badge.el);
      const ti = h('div', { class: 'display', style: { fontSize: '132px', color: '#fff', whiteSpace: 'nowrap' } });
      row.append(badgeBox, ti);
      const su = h('div', { class: 'abs', style: { left: 0, width: '1920px', top: '590px', textAlign: 'center', fontSize: '36px', color: '#a9b3c8' } });
      wrapAll.append(row, su);
      return { badge, badgeBox, tw: words(ti, title), sw: words(su, sub) };
    });

    // The summary: the promises stacked on the left, what isn't there struck out on the right.
    small = PROMISES.map(([title], i) => {
      const row = h('div', { class: 'abs', style: { left: '200px', top: 360 + i * 128 + 'px', display: 'flex', alignItems: 'center', gap: '28px' } });
      const badgeBox = h('div', { style: { position: 'relative', width: '68px', height: '68px', flex: 'none' } });
      const badge = checkBadge(68, '#2356c9');
      badgeBox.append(badge.el);
      const ti = h('div', { class: 'display', style: { fontSize: '72px', color: '#fff', whiteSpace: 'nowrap' } });
      row.append(badgeBox, ti);
      wrapAll.append(row);
      return { badge, tw: words(ti, title), row };
    });
    rightHead = h('div', { class: 'abs', style: { left: '1180px', top: '300px', fontSize: '26px', fontWeight: 600, color: '#8fa6f2' } });
    rightHeadWords = words(rightHead, 'What you won’t find in Bemmoly');
    wrapAll.append(rightHead);
    strikes = NOT_THERE.map((label, i) => {
      const el = h('div', { class: 'abs', style: { left: '1180px', top: 360 + i * 54 + 'px', fontSize: '36px', fontWeight: 500, color: '#7d8699', whiteSpace: 'nowrap' } }, label);
      const line = h('div', { class: 'abs', style: { left: '-6px', right: '-6px', top: '55%', height: '4px', borderRadius: '2px', background: '#e5484d', transformOrigin: '0 50%' } });
      el.append(line);
      wrapAll.append(el);
      return { el, line };
    });
    root.append(wrapAll);
  },
  update(t) {
    tf(glow, { o: ep(t, 0, 1, E.outCubic) * (0.8 + Math.sin(t * 1.3) * 0.15), s: 1 + Math.sin(t * 0.7) * 0.04 });

    // One promise at a time: rises in, then lifts away as the next arrives.
    big.forEach((p, i) => {
      const a = 0.35 + i * SLOT, out = a + SLOT - 0.45;
      const last = i === PROMISES.length - 1;
      const o = last ? 7.6 : out;
      revealWords(p.tw, t, a + 0.12, { stagger: 0.07, dur: 1.0, rise: 90, blur: 18, out: o, outDur: 0.45 });
      revealWords(p.sw, t, a + 0.55, { stagger: 0.03, dur: 0.9, rise: 30, blur: 10, out: o - 0.05, outDur: 0.4 });
      p.badge.update(t, a + 0.05);
      const bo = E.inCubic(prog(t, o, o + 0.45));
      tf(p.badgeBox, { y: -bo * 70, o: 1 - bo, s: 1 + bo * 0.1 });
    });

    // Together: the stacked list and the struck-out wall.
    small.forEach((p, i) => {
      const a = 7.75 + i * 0.16;
      const k = E.outExpo(prog(t, a, a + 1.0));
      tf(p.row, { x: (1 - k) * -80, o: k });
      revealWords(p.tw, t, a + 0.05, { stagger: 0.05, dur: 0.9, rise: 30, blur: 10 });
      p.badge.update(t, a);
    });
    revealWords(rightHeadWords, t, 8.0, { stagger: 0.04, dur: 0.8, rise: 20, blur: 8 });
    strikes.forEach((s, i) => {
      const a = 7.95 + i * 0.09;
      const k = E.outExpo(prog(t, a, a + 0.7));
      tf(s.el, { x: (1 - k) * 60, o: k * 0.95 });
      const st = E.inOutCubic(prog(t, a + 0.25, a + 0.6));
      tf(s.line, { sx: Math.max(0.0001, st) });
      css(s.el, 'color', st > 0.5 ? '#5f6778' : '#7d8699');
    });

    // Exit: the whole board pushes toward the camera and dissolves as the product arrives.
    const x = E.inCubic(prog(t, 9.75, 10.5));
    tf(wrapAll, { s: 1 + x * 0.35, o: 1 - x, blur: x * 18 });
  },
};
