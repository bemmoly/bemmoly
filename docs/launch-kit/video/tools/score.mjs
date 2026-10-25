// The film's score and sound design, synthesized from code: no samples, no licences.
//   node tools/score.mjs  → out/score.wav (48 kHz, 16-bit stereo, 112 s, 120 BPM)
// Every event is placed in film seconds, so it lands exactly on the picture's cues.
import { writeFileSync, mkdirSync } from 'node:fs';
import { CUES } from './cues.mjs';

const SR = 48000;
const DUR = 112;
const N = DUR * SR;
const BEAT = 0.5, BAR = 2;
const TAU = Math.PI * 2;

// ---------- buses ----------
const bus = (n) => ({ L: new Float32Array(N), R: new Float32Array(N), name: n });
const MUSIC = bus('music'), DRUMS = bus('drums'), FX = bus('fx'), SFX = bus('sfx'), VERB = bus('verb');

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function add(b, i, l, r, send = 0) {
  if (i < 0 || i >= N) return;
  b.L[i] += l; b.R[i] += r;
  if (send) { VERB.L[i] += l * send; VERB.R[i] += r * send; }
}

// A biquad whose coefficients can move (updated by the caller).
function biquad() {
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return {
    set(type, f, q = 0.707) {
      f = clamp(f, 20, SR * 0.45);
      const w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
      let B0, B1, B2;
      if (type === 'lp') { B0 = (1 - c) / 2; B1 = 1 - c; B2 = (1 - c) / 2; }
      else if (type === 'hp') { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = (1 + c) / 2; }
      else { B0 = al; B1 = 0; B2 = -al; } // band-pass
      const A0 = 1 + al;
      b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = (-2 * c) / A0; a2 = (1 - al) / A0;
    },
    run(x) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    },
  };
}

// polyBLEP saw for clean oscillators.
function saw(ph, dt) {
  let v = 2 * ph - 1;
  if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; }
  else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; }
  return v;
}

const env = (t, dur, a, r) => (t < a ? t / a : 1) * (t > dur - r ? clamp((dur - t) / r, 0, 1) : 1);

// ---------- instruments ----------

function pad(start, dur, notes, { gain = 0.05, cutoff = 1600, attack = 1.2, release = 1.6, send = 0.35, bright = 0 } = {}) {
  const voices = [];
  for (const m of notes) for (const d of [-14, -6, 0, 6, 14]) voices.push({ f: mtof(m) * Math.pow(2, d / 1200), ph: rnd(), pan: clamp(0.5 + d / 30, 0.1, 0.9) });
  const fl = biquad(), fr = biquad();
  const n = Math.floor((dur + release) * SR), i0 = Math.floor(start * SR);
  const g = gain / Math.sqrt(voices.length);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    if (k % 64 === 0) { const c = cutoff * (1 + bright * Math.min(1, t / dur)) * (1 + 0.12 * Math.sin(t * 0.9)); fl.set('lp', c, 0.8); fr.set('lp', c, 0.8); }
    let l = 0, r = 0;
    for (const v of voices) {
      const dt = v.f / SR;
      v.ph += dt; if (v.ph >= 1) v.ph -= 1;
      const s = saw(v.ph, dt);
      l += s * (1 - v.pan); r += s * v.pan;
    }
    const e = env(t, dur + release, attack, release) * g;
    add(MUSIC, i0 + k, fl.run(l) * e, fr.run(r) * e, send);
  }
}

function bass(start, dur, m, { gain = 0.16, cutoff = 260 } = {}) {
  const f = mtof(m), fl = biquad();
  fl.set('lp', cutoff, 0.9);
  let ph = 0, ph2 = 0;
  const n = Math.floor((dur + 0.05) * SR), i0 = Math.floor(start * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += f / SR; if (ph >= 1) ph -= 1;
    ph2 += f / 2 / SR; if (ph2 >= 1) ph2 -= 1;
    const s = fl.run(saw(ph, f / SR) * 0.6 + Math.sin(TAU * ph2) * 0.8);
    const e = env(t, dur + 0.05, 0.006, 0.06) * (0.75 + 0.25 * Math.exp(-t * 6)) * gain;
    add(MUSIC, i0 + k, s * e, s * e);
  }
}

function pluck(start, m, { gain = 0.05, pan = 0.5, decay = 0.32, send = 0.3 } = {}) {
  const f = mtof(m), fl = biquad();
  let ph = rnd(), ph2 = rnd();
  const n = Math.floor(decay * 4 * SR), i0 = Math.floor(start * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    if (k % 32 === 0) fl.set('lp', 400 + 5200 * Math.exp(-t / 0.07), 1.2);
    ph += f / SR; if (ph >= 1) ph -= 1;
    ph2 += (f * 1.003) / SR; if (ph2 >= 1) ph2 -= 1;
    const s = fl.run(saw(ph, f / SR) + saw(ph2, f / SR) * 0.6);
    const e = Math.exp(-t / decay) * Math.min(1, t / 0.002) * gain;
    add(MUSIC, i0 + k, s * e * (1 - pan) * 2 * 0.7, s * e * pan * 2 * 0.7, send);
  }
}

function bell(start, m, { gain = 0.06, dur = 2.4, pan = 0.5, send = 0.5, bus: b = MUSIC } = {}) {
  const f = mtof(m);
  const n = Math.floor(dur * SR), i0 = Math.floor(start * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const idx = 2.2 * Math.exp(-t / 0.25);
    const s = Math.sin(TAU * f * t + idx * Math.sin(TAU * f * 3.5 * t)) + 0.25 * Math.sin(TAU * f * 2 * t);
    const e = Math.exp(-t / (dur / 3.2)) * Math.min(1, t / 0.003) * gain;
    add(b, i0 + k, s * e * (1 - pan) * 2 * 0.7, s * e * pan * 2 * 0.7, send);
  }
}

function kick(start, gain = 0.5) {
  const n = Math.floor(0.6 * SR), i0 = Math.floor(start * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 46 + 120 * Math.exp(-t / 0.045);
    ph += f / SR;
    const s = Math.sin(TAU * ph) * Math.exp(-t / 0.32) + (t < 0.004 ? (rnd() * 2 - 1) * 0.3 * (1 - t / 0.004) : 0);
    const v = Math.tanh(s * 1.6) * gain;
    add(DRUMS, i0 + k, v, v);
  }
}

function hat(start, { gain = 0.06, open = false, pan = 0.55 } = {}) {
  const hp = biquad(); hp.set('hp', 7500, 0.7);
  const n = Math.floor((open ? 0.35 : 0.08) * SR), i0 = Math.floor(start * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const s = hp.run(rnd() * 2 - 1) * Math.exp(-t / (open ? 0.11 : 0.022)) * gain;
    add(DRUMS, i0 + k, s * (1 - pan) * 2 * 0.7, s * pan * 2 * 0.7);
  }
}

function clap(start, gain = 0.12) {
  const bp = biquad(); bp.set('bp', 1400, 1.1);
  const n = Math.floor(0.3 * SR), i0 = Math.floor(start * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const burst = t < 0.03 ? (Math.sin(t * TAU * 100) > 0 ? 1 : 0.35) : Math.exp(-(t - 0.03) / 0.07);
    const s = bp.run(rnd() * 2 - 1) * burst * gain * 3;
    add(DRUMS, i0 + k, s, s, 0.25);
  }
}

function riser(start, end, { gain = 0.08, f0 = 300, f1 = 7000 } = {}) {
  const bpL = biquad(), bpR = biquad();
  const dur = end - start, n = Math.floor(dur * SR), i0 = Math.floor(start * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, x = t / dur;
    if (k % 64 === 0) { const f = f0 * Math.pow(f1 / f0, x * x); bpL.set('bp', f, 2.5); bpR.set('bp', f * 1.05, 2.5); }
    const pf = 110 * Math.pow(4, x * x);
    ph += pf / SR; if (ph >= 1) ph -= 1;
    const e = Math.pow(x, 2.2) * gain;
    const tone = saw(ph, pf / SR) * 0.15;
    add(FX, i0 + k, (bpL.run(rnd() * 2 - 1) * 3 + tone) * e, (bpR.run(rnd() * 2 - 1) * 3 + tone) * e, 0.3);
  }
}

function impact(start, { gain = 0.6, tail = 3 } = {}) {
  const lp = biquad(); lp.set('lp', 900, 0.7);
  const n = Math.floor(tail * SR), i0 = Math.floor(start * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 34 + 40 * Math.exp(-t / 0.15);
    ph += f / SR;
    const sub = Math.sin(TAU * ph) * Math.exp(-t / (tail / 3.5));
    const nz = lp.run(rnd() * 2 - 1) * Math.exp(-t / 0.18) * 0.9;
    const v = Math.tanh((sub + nz) * 1.4) * gain;
    add(FX, i0 + k, v, v, 0.5);
  }
}

function whoosh(start, dur, { gain = 0.07, from = 0.2, to = 0.8, f0 = 400, f1 = 3800 } = {}) {
  const bp = biquad();
  const n = Math.floor(dur * SR), i0 = Math.floor(start * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR, x = t / dur;
    if (k % 64 === 0) bp.set('bp', f0 + (f1 - f0) * Math.sin(Math.PI * x), 1.4);
    const e = Math.sin(Math.PI * Math.pow(x, 0.7)) ** 2 * gain;
    const pan = from + (to - from) * x;
    const s = bp.run(rnd() * 2 - 1) * e * 3;
    add(FX, i0 + k, s * (1 - pan) * 1.4, s * pan * 1.4, 0.25);
  }
}

function click(start, { gain = 0.08, f = 2400, pan = 0.5 } = {}) {
  const n = Math.floor(0.05 * SR), i0 = Math.floor(start * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const s = (Math.sin(TAU * f * t) * Math.exp(-t / 0.006) + (rnd() * 2 - 1) * Math.exp(-t / 0.002) * 0.5) * gain;
    add(SFX, i0 + k, s * (1 - pan) * 1.4, s * pan * 1.4, 0.08);
  }
}

function key(start, { gain = 0.05 } = {}) {
  const bp = biquad(); bp.set('bp', 2600 + rnd() * 1200, 1.5);
  const n = Math.floor(0.04 * SR), i0 = Math.floor(start * SR), pan = 0.4 + rnd() * 0.2;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const s = bp.run(rnd() * 2 - 1) * Math.exp(-t / 0.008) * gain * 4;
    add(SFX, i0 + k, s * (1 - pan) * 1.4, s * pan * 1.4, 0.05);
  }
}

function drone(start, dur, notes, { gain = 0.05, cutoff = 420 } = {}) {
  pad(start, dur, notes, { gain, cutoff, attack: 2.5, release: 1.5, send: 0.2 });
}

// ---------- the arrangement ----------
// D major / B minor. Chords as MIDI notes; bass roots an octave or two down.
const CH = {
  Bm: { pad: [59, 62, 66, 71], root: 35 },
  G: { pad: [55, 59, 62, 67], root: 31 },
  D: { pad: [57, 62, 66, 69], root: 38 },
  A: { pad: [57, 61, 64, 69], root: 33 },
  Em: { pad: [55, 59, 64, 67], root: 40 },
};
const PROG = ['Bm', 'G', 'D', 'A'];
const chordAt = (t, from) => PROG[Math.floor(Math.max(0, t - from) / 4) % 4];

/** Sections: [start, end, { drums, bass, arp, pad, hats16 }]. */
const SECTIONS = [
  [15, 25, { kick: true, hats: true, bass: true, arp: true, pad: 0.045 }],
  [26, 54, { kick: true, clap: true, hats: true, bass: true, arp: true, pad: 0.035 }],
  [54, 58, { arp: true, pad: 0.05, dreamy: true }],
  [58, 63, { kick: true, hats: true, bass: true, arp: true, pad: 0.04, dreamy: true }],
  [63, 80, { kick: true, clap: true, hats: true, hats16: true, bass: true, arp: true, pad: 0.04 }],
  [80, 88, { arp: true, pad: 0.055, dreamy: true }],
  [88, 95.5, { kick: true, hats: true, bass: true, arp: true, pad: 0.05 }],
  [95.5, 97, { pad: 0.045, dreamy: true }],
  [97.5, 100, { kick: true, clap: true, hats: true, hats16: true, bass: true, arp: true, pad: 0.06 }],
];

// Act 1: tension. A drone with a rub, a ticking clock, a heartbeat, a riser into the light.
drone(0, 9, [38, 39, 50], { gain: 0.06, cutoff: 380 });
for (let t = 0.5; t < 8.4; t += t < 3 ? 1 : t < 5.5 ? 0.5 : 0.25) hat(t, { gain: 0.035 + t * 0.003, pan: 0.5 });
for (const t of [5.75, 6.25, 6.75, 7.25, 7.6, 7.9, 8.15, 8.35]) kick(t, 0.22);
riser(6.6, 8.95, { gain: 0.12 });

// Act 2: the mark. Impact, a wide major chord, sparkles as the tiles land.
impact(9.0, { gain: 0.7, tail: 3.5 });
pad(9.0, 5.6, [50, 57, 62, 66, 69, 76], { gain: 0.06, cutoff: 2600, attack: 0.08, release: 2.5, send: 0.55, bright: 0.4 });
bass(9.0, 5.5, 26, { gain: 0.14, cutoff: 160 });
[81, 86, 90, 93].forEach((m, i) => bell(9.3 + i * 0.09, m, { gain: 0.035, pan: 0.3 + i * 0.13 }));
[74, 78, 81, 86].forEach((m, i) => bell(11.75 + i * 0.07, m, { gain: 0.03, pan: 0.7 - i * 0.12 }));
riser(13.6, 15.0, { gain: 0.07, f0: 600 });

// Acts 3–9: the groove under the product.
for (const [s, e, o] of SECTIONS) {
  for (let t = s; t < e - 0.001; t += BEAT) {
    const ch = CH[chordAt(t, 15)];
    const beatIdx = Math.round((t - s) / BEAT);
    if (o.kick) kick(t, 0.28);
    if (o.clap && beatIdx % 2 === 1) clap(t, 0.09);
    if (o.hats) hat(t + 0.25, { gain: 0.05, pan: 0.6 });
    if (o.hats16) { hat(t + 0.125, { gain: 0.025, pan: 0.35 }); hat(t + 0.375, { gain: 0.025, pan: 0.65 }); }
    if (o.bass) { bass(t, 0.22, ch.root, { gain: 0.17 }); bass(t + 0.25, 0.2, ch.root + 12, { gain: 0.11 }); }
    if (o.arp) {
      const arp = [ch.pad[0] + 12, ch.pad[1] + 12, ch.pad[2] + 12, ch.pad[3] + 12];
      for (let q = 0; q < 4; q++) pluck(t + q * 0.125, arp[(beatIdx * 4 + q) % 4] + (o.dreamy ? 12 : 0), { gain: o.dreamy ? 0.028 : 0.032, pan: q % 2 ? 0.3 : 0.7, decay: o.dreamy ? 0.5 : 0.22 });
    }
  }
  // Pads, chord by chord, inside the section.
  for (let t = s; t < e - 0.01;) {
    const next = Math.min(e, 15 + (Math.floor((t - 15) / 4) + 1) * 4);
    pad(t, next - t, CH[chordAt(t, 15)].pad, { gain: o.pad * 1.7, cutoff: o.dreamy ? 2200 : 1500, attack: t === s ? 0.6 : 0.15, release: 0.6, send: o.dreamy ? 0.6 : 0.35 });
    t = next;
  }
}

// Act 10: the close. A big chord, the mantra on the beat, the mark lands.
pad(100, 5.5, [50, 57, 62, 66, 69], { gain: 0.055, cutoff: 1800, attack: 0.1, release: 1, send: 0.5 });
bass(100, 5.4, 26, { gain: 0.12, cutoff: 150 });
pad(108.15, 3.85, [50, 57, 62, 66, 69, 74, 78], { gain: 0.065, cutoff: 3000, attack: 0.05, release: 0.01, send: 0.6, bright: 0.3 });
bass(108.15, 3.8, 26, { gain: 0.14, cutoff: 150 });

// Cues from the picture: impacts, whooshes, clicks, keys, chimes (tools/cues.mjs).
const INST = { impact: (t, o) => impact(t, o), whoosh: (t, o) => whoosh(t, o.dur ?? 0.6, o), click: (t, o) => click(t, o), key: (t, o) => key(t, o), riser: (t, o) => riser(t, o.end, o),
  chime: (t, o = {}) => bell(t, o.m ?? 86, { gain: o.gain ?? 0.04, dur: o.dur ?? 1.2, pan: o.pan ?? 0.5, send: 0.4, bus: SFX }),
  kick: (t, o = {}) => kick(t, o.gain ?? 0.45), clap: (t, o = {}) => clap(t, o.gain ?? 0.1), hat: (t, o = {}) => hat(t, o) };
for (const [t, kind, opts] of CUES) INST[kind](t, opts || {});

// ---------- mix ----------
// Sidechain: music ducks under every kick for that modern pump.
const kickTimes = [];
for (const [s, e, o] of SECTIONS) if (o.kick) for (let t = s; t < e - 0.001; t += BEAT) kickTimes.push(t);
const duck = new Float32Array(N).fill(1);
for (const kt of kickTimes) {
  const i0 = Math.floor(kt * SR);
  for (let k = 0; k < 0.3 * SR; k++) { const i = i0 + k; if (i < N) duck[i] = Math.min(duck[i], 1 - 0.45 * Math.exp(-k / SR / 0.09)); }
}

// Freeverb on the send bus.
function freeverb(inL, inR, { room = 0.86, damp = 0.35, wet = 8 } = {}) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round((x * SR) / 44100));
  const apT = [556, 441, 341, 225].map((x) => Math.round((x * SR) / 44100));
  const run = (inp, spread) => {
    const out = new Float32Array(N);
    const combs = combT.map((l) => ({ b: new Float32Array(l + spread), i: 0, s: 0 }));
    const aps = apT.map((l) => ({ b: new Float32Array(l + spread), i: 0 }));
    for (let n = 0; n < N; n++) {
      const x = inp[n] * 0.015;
      let y = 0;
      for (const c of combs) {
        const o = c.b[c.i];
        c.s = o * (1 - damp) + c.s * damp;
        c.b[c.i] = x + c.s * room;
        if (++c.i >= c.b.length) c.i = 0;
        y += o;
      }
      for (const a of aps) {
        const o = a.b[a.i];
        a.b[a.i] = y + o * 0.5;
        if (++a.i >= a.b.length) a.i = 0;
        y = o - y;
      }
      out[n] = y * wet;
    }
    return out;
  };
  return [run(inL, 0), run(inR, 23)];
}
const [vL, vR] = freeverb(VERB.L, VERB.R);

// Fade in from nothing and out to silence with the picture.
const master = (n) => {
  const t = n / SR;
  const fadeIn = Math.min(1, t / 0.4), fadeOut = Math.min(1, Math.max(0, (DUR - t) / 2.2));
  return fadeIn * fadeOut;
};
const L = new Float32Array(N), R = new Float32Array(N);
let peak = 0;
for (let n = 0; n < N; n++) {
  const m = master(n);
  let l = (MUSIC.L[n] * duck[n] + DRUMS.L[n] + FX.L[n] + SFX.L[n] * 1.2 + vL[n]) * m;
  let r = (MUSIC.R[n] * duck[n] + DRUMS.R[n] + FX.R[n] + SFX.R[n] * 1.2 + vR[n]) * m;
  // Gentle glue: soft-clip above the knee.
  l = Math.tanh(l * 1.3) / 1.3; r = Math.tanh(r * 1.3) / 1.3;
  L[n] = l; R[n] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const norm = 0.89 / peak;
// Bus balance in the main groove (30–50 s), for mixing without ears.
const rms = (b, a, z) => { let q = 0; for (let n = a * SR; n < z * SR; n++) q += b.L[n] * b.L[n]; return (10 * Math.log10(q / ((z - a) * SR) + 1e-12)).toFixed(1); };
const vr = { L: vL }; console.log('verb out', rms(vr, 30, 50));
console.log('dB RMS 30–50s · music', rms(MUSIC, 30, 50), '· drums', rms(DRUMS, 30, 50), '· fx', rms(FX, 30, 50), '· sfx', rms(SFX, 30, 50), '· verb send', rms(VERB, 30, 50));

// ---------- write WAV ----------
mkdirSync('out', { recursive: true });
const data = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  data.writeInt16LE(Math.round(clamp(L[n] * norm, -1, 1) * 32767), n * 4);
  data.writeInt16LE(Math.round(clamp(R[n] * norm, -1, 1) * 32767), n * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
writeFileSync('out/score.wav', Buffer.concat([hdr, data]));
console.log(`out/score.wav · ${DUR}s · peak before normalise ${peak.toFixed(2)}`);
