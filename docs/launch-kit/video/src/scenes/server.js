// Scene 8: your server. A terminal types the one-line install, the output streams with ticks,
// and the operations promises check in beside it.
import { h, tf, E, ep, prog, spring, lerp, css, text, drift, rand, clamp } from '../engine.js';
import { caption, checkBadge, icon, words, revealWords } from '../components.js';

const CMD = 'curl -fsSL https://get.bemmoly.com | sh';
const TYPE_AT = 1.0;
// Per-character times with a little human unevenness (deterministic).
const CHAR_T = [];
{
  let tt = TYPE_AT;
  for (let i = 0; i < CMD.length; i++) {
    CHAR_T.push(tt);
    tt += 0.026 + rand(i + 3) * 0.022 + (CMD[i] === ' ' ? 0.03 : 0);
  }
}
const ENTER_AT = CHAR_T[CHAR_T.length - 1] + 0.22;

// Output: [label, appears at, resolves at, kind]. Times are local seconds.
const OUT = [
  ['Bemmoly installer', ENTER_AT + 0.12, null, 'title'],
  ['Checking this machine', ENTER_AT + 0.3, ENTER_AT + 0.62, 'step'],
  ['Pulling ghcr.io/bemmoly/bemmoly', ENTER_AT + 0.62, ENTER_AT + 1.55, 'pull'],
  ['Verifying the image signature', ENTER_AT + 1.55, ENTER_AT + 1.95, 'step'],
  ['Starting Postgres', ENTER_AT + 1.95, ENTER_AT + 2.35, 'step'],
  ['Issuing the HTTPS certificate', ENTER_AT + 2.35, ENTER_AT + 2.8, 'step'],
  ['Bemmoly is ready at https://work.acmelabs.dev', ENTER_AT + 3.0, null, 'ready'],
];
const READY_AT = ENTER_AT + 3.0;
const SPINNER = '<svg class="ico" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="rgba(123,149,236,.25)" stroke-width="2.4"/><path d="M9 2a7 7 0 0 1 7 7" fill="none" stroke="#7b95ec" stroke-width="2.4" stroke-linecap="round"/></svg>';

const PROMISES = ['Automatic HTTPS', 'Nightly verified backups', 'Signed updates with automatic rollback', 'No telemetry'];
const P_AT = [3.3, 3.8, 4.3, 4.8];

// Terminal geometry.
const TW = 880, TH = 486, TX = 940, TY = 296;

let caret2, promptRow2, scene, rig, glow, term, cmdEl, caret, lines = [], cap, promiseRows = [], body, readyGlow;

export default {
  id: 'server',
  build(root) {
    scene = h('div', { class: 'layer', style: { transformStyle: 'flat', perspective: '2200px' } });

    rig = h('div', { class: 'abs', style: { left: TX + 'px', top: TY + 'px', width: TW + 'px', height: TH + 'px' } });
    glow = h('div', { class: 'abs', style: { left: '-260px', top: '-200px', width: TW + 520 + 'px', height: TH + 400 + 'px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(35,86,201,.42) 0%, rgba(35,86,201,0) 62%)' } });
    term = h('div', { class: 'abs mono', style: { inset: 0, borderRadius: '16px', overflow: 'hidden', background: 'linear-gradient(180deg, #12161d 0%, #0b0e13 100%)',
      boxShadow: '0 0 0 1px rgba(255,255,255,.1), inset 0 1px 0 rgba(255,255,255,.06), 0 50px 120px -30px rgba(0,0,0,.8)', fontSize: '22px', color: '#e8ebf1' } });
    const bar = h('div', { style: { height: '46px', display: 'flex', alignItems: 'center', gap: '9px', padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' } },
      ...['#ff5f57', '#febc2e', '#28c840'].map((c) => h('span', { style: { width: '13px', height: '13px', borderRadius: '50%', background: c } })),
      h('div', { style: { flex: 1, textAlign: 'center', fontFamily: 'Plex', fontSize: '14px', color: '#858c9a', marginRight: '50px' } }, 'acme@work-vm: ~'));
    body = h('div', { style: { padding: '26px 30px', lineHeight: '40px', whiteSpace: 'pre' } });
    const prompt = h('div', {}, h('span', { style: { color: '#3fb67a' } }, 'acme@work-vm'), h('span', { style: { color: '#858c9a' } }, ' ~ $ '));
    cmdEl = h('span', { style: { color: '#ffffff' } });
    caret = h('span', { style: { display: 'inline-block', width: '12px', height: '25px', background: '#c9d3ea', verticalAlign: '-5px', marginLeft: '2px' } });
    prompt.append(cmdEl, caret);
    body.append(prompt);
    OUT.forEach(([label, , , kind]) => {
      const mark = h('span', { style: { display: 'inline-flex', width: '30px', color: '#7b95ec' } });
      const lab = h('span', { style: { color: kind === 'title' ? '#c9d3ea' : '#a8b0be', fontWeight: kind === 'title' ? 500 : 400 } });
      const extra = h('span', { style: { color: '#697181', marginLeft: '14px' } });
      const row = h('div', { class: 'will', style: { display: 'flex', alignItems: 'center' } }, mark, lab, extra);
      if (kind === 'ready') {
        lab.innerHTML = '';
        lab.append(h('span', { style: { color: '#e8ebf1', fontWeight: 500 } }, 'Bemmoly is ready at '), h('span', { style: { color: '#8fa6f2', textDecoration: 'underline', textUnderlineOffset: '5px', fontWeight: 500 } }, 'https://work.acmelabs.dev'));
        row.style.marginTop = '14px';
      } else lab.textContent = label;
      if (kind === 'pull') {
        const barOut = h('span', { style: { display: 'inline-block', width: '150px', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,.08)', marginLeft: '18px', overflow: 'hidden' } });
        const barIn = h('span', { style: { display: 'block', height: '100%', width: '0%', background: 'linear-gradient(90deg, #2356c9, #7b95ec)', borderRadius: '4px' } });
        barOut.append(barIn);
        row.insertBefore(barOut, extra);
        lines.push({ row, mark, lab, extra, kind, barIn });
      } else lines.push({ row, mark, lab, extra, kind });
      body.append(row);
    });
    // A fresh prompt waits after the install.
    const prompt2 = h('div', { style: { marginTop: '6px' } }, h('span', { style: { color: '#3fb67a' } }, 'acme@work-vm'), h('span', { style: { color: '#858c9a' } }, ' ~ $ '));
    caret2 = h('span', { style: { display: 'inline-block', width: '12px', height: '25px', background: '#c9d3ea', verticalAlign: '-5px', marginLeft: '2px' } });
    prompt2.append(caret2);
    body.append(prompt2);
    promptRow2 = prompt2;
    readyGlow = h('div', { class: 'abs', style: { left: '30px', right: '30px', height: '56px', borderRadius: '10px', background: 'radial-gradient(ellipse at 30% 50%, rgba(91,123,229,.28), rgba(91,123,229,0) 70%)', top: 0 } });
    term.append(bar, body);
    term.insertBefore(readyGlow, body);
    rig.append(glow, term);

    cap = caption({ eyebrow: 'Self-hosted', tileIcon: 'server', tileColor: '#2356c9', title: 'One command. Your server.', sub: 'One Docker image. One Postgres. Data never leaves your server.', left: 120, top: 200, width: 600, size: 72 });

    PROMISES.forEach((p, i) => {
      const badgeBox = h('div', { style: { position: 'relative', width: '40px', height: '40px', flex: 'none' } });
      const badge = checkBadge(40, '#2356c9');
      badgeBox.append(badge.el);
      const label = h('div', { style: { fontSize: '27px', fontWeight: 500, color: '#e8ebf1', letterSpacing: '-0.01em' } });
      const spans = words(label, p);
      const row = h('div', { class: 'abs', style: { left: '120px', top: 600 + i * 66 + 'px', display: 'flex', alignItems: 'center', gap: '20px' } }, badgeBox, label);
      promiseRows.push({ row, badge, spans });
      scene.append(row);
    });

    scene.append(cap.el, rig);
    root.append(scene);
  },
  update(t) {
    // ---- Terminal rig: flies in from the right, settles, a slow push; recedes at the end ----
    const land = spring(t - 0.0, { stiffness: 85, damping: 17 });
    const push = ep(t, 1.0, 7.6, E.inOutCubic);
    const out = E.inCubic(prog(t, 7.55, 8.3));
    tf(rig, {
      x: (1 - land) * 520 - push * 20,
      y: (1 - land) * 40 + drift(t, 2, 0.5) * 5 - out * 20,
      z: (1 - land) * -900 + push * 70 - out * 700,
      ry: (1 - land) * -38 - 12 + push * 4 + drift(t, 5, 0.4) * 0.8,
      rx: (1 - land) * 10 + 3,
      o: prog(t, 0, 0.3) * (1 - out),
      blur: Math.max(0, 1 - clamp(land, 0, 1)) * 12 + out * 14,
    });
    tf(glow, { o: 0.7 + Math.sin(t * 1.3) * 0.1 + ep(t, READY_AT, READY_AT + 0.6) * 0.3 });

    // ---- Typing ----
    let n = 0;
    while (n < CMD.length && t >= CHAR_T[n]) n++;
    text(cmdEl, CMD.slice(0, n));
    const typing = t >= TYPE_AT - 0.1 && t < ENTER_AT;
    const afterEnter = t >= ENTER_AT;
    const blinkOn = typing || ((t * 2) % 1) < 0.6;
    css(caret, 'opacity', afterEnter ? '0' : blinkOn ? '1' : '0');
    const p2 = prog(t, READY_AT + 0.5, READY_AT + 0.7);
    tf(promptRow2, { o: p2 });
    css(caret2, 'opacity', ((t * 2) % 1) < 0.6 ? '1' : '0');

    // ---- Output lines ----
    lines.forEach((ln, i) => {
      const [, at, res, kind] = OUT[i];
      const k = E.outExpo(prog(t, at, at + 0.4));
      tf(ln.row, { y: (1 - k) * 14, o: k, blur: (1 - k) * 4 });
      if (kind === 'title') { ln.mark.innerHTML = icon('terminal', 18, 2, '#7b95ec'); return; }
      if (kind === 'ready') {
        const r = spring(t - at, { stiffness: 200, damping: 16 });
        ln.mark.innerHTML = icon('circle-check', 22, 2.2, '#3fb67a');
        tf(ln.mark, { s: clamp(r, 0, 1.3) });
        return;
      }
      const done = t >= res;
      if (done) {
        const r = spring(t - res, { stiffness: 260, damping: 15 });
        if (ln.mark.dataset.spin !== 'done') { ln.mark.innerHTML = icon('check', 20, 2.6, '#3fb67a'); ln.mark.dataset.spin = 'done'; }
        tf(ln.mark, { s: clamp(r, 0, 1.4) });
      } else {
        if (ln.mark.dataset.spin !== '1') { tf(ln.mark, { s: 1 }); }
        if (ln.mark.dataset.spin !== '1') { ln.mark.innerHTML = SPINNER; ln.mark.dataset.spin = '1'; }
        tf(ln.mark.firstChild, { rz: t * 540 });
      }
      if (kind === 'pull') {
        const pk = E.inOutCubic(prog(t, at + 0.05, res - 0.05));
        css(ln.barIn, 'width', (pk * 100).toFixed(1) + '%');
        text(ln.extra, done ? 'signed' : `${Math.round(pk * 100)}%`);
        css(ln.extra, 'color', done ? '#3fb67a' : '#697181');
      } else if (kind === 'step') {
        text(ln.extra, done ? 'ok' : '');
        css(ln.extra, 'color', '#3fb67a');
      }
    });
    // The ready line gets a soft light behind it.
    const ready = lines[lines.length - 1].row;
    css(readyGlow, 'top', ready.offsetTop - 8 + 'px');
    tf(readyGlow, { o: ep(t, READY_AT, READY_AT + 0.5) * (0.7 + Math.sin(t * 3) * 0.3), sx: lerp(0.6, 1, ep(t, READY_AT, READY_AT + 0.8)) });

    // ---- Left column ----
    cap.update(t, 0.35, 7.35);
    promiseRows.forEach(({ row, badge, spans }, i) => {
      badge.update(t, P_AT[i]);
      revealWords(spans, t, P_AT[i] + 0.12, { stagger: 0.04, dur: 0.8, rise: 22, blur: 8, out: 7.5 + i * 0.05 });
      const bo = E.inCubic(prog(t, 7.5 + i * 0.05, 7.95 + i * 0.05));
      tf(row, { o: 1 - bo, blur: bo * 6 });
    });
  },
};
