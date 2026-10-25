// Sound cues locked to the picture, in film seconds: [time, instrument, options].
// Instruments: impact, whoosh(dur in opts), click, key, chime, riser(end in opts), kick, clap, hat.
const C = [];
const at = (t, kind, o) => C.push([t, kind, o]);

// 1. The sprawl: windows sweep in, price tags pop, links snap.
at(0.5, 'whoosh', { dur: 1.8, gain: 0.05, from: 0.2, to: 0.8, f0: 200, f1: 1800 });
for (let i = 0; i < 12; i++) at(3.25 + i * 0.13, 'click', { f: 1500 + i * 90, gain: 0.07, pan: 0.2 + (i % 4) * 0.2 });
for (let i = 0; i < 15; i++) at(6.55 + (i % 5) * 0.05 + Math.floor(i / 5) * 0.012, 'click', { f: 900 - (i % 5) * 60, gain: 0.05, pan: 0.15 + (i % 7) * 0.12 });
at(7.6, 'whoosh', { dur: 1.4, gain: 0.08, from: 0.9, to: 0.5, f0: 300, f1: 5200 });

// 2. The mark: the wordmark slides out.
at(11.65, 'whoosh', { dur: 0.7, gain: 0.04, from: 0.35, to: 0.65 });
at(12.45, 'chime', { m: 81, gain: 0.025, dur: 1.6 });

// 3. Promises: each promise rises, its check lands; the summary, the strikes, the push out.
for (let i = 0; i < 3; i++) {
  at(15.4 + i * 2.45, 'whoosh', { dur: 0.6, gain: 0.04, f0: 500, f1: 2600 });
  at(15.75 + i * 2.45, 'chime', { m: [86, 88, 90][i], gain: 0.04 });
}
[86, 90, 93].forEach((m, i) => at(23.1 + i * 0.16, 'chime', { m, gain: 0.03, dur: 0.9 }));
for (let i = 0; i < 8; i++) at(23.2 + i * 0.09, 'click', { f: 1100, gain: 0.04, pan: 0.7 });
at(24.75, 'whoosh', { dur: 0.8, gain: 0.07, f0: 300, f1: 4200 });

// 4–6. The tour: Work, Docs, AI in one window.
at(25.15, 'whoosh', { dur: 1.6, gain: 0.07, from: 0.5, to: 0.7, f0: 200, f1: 2600 });
at(26.75, 'kick', { gain: 0.25 });
at(28.5, 'whoosh', { dur: 1.3, gain: 0.04, f0: 300, f1: 1800 });
at(30.42, 'click', { f: 2200, gain: 0.08 });
at(30.55, 'whoosh', { dur: 1.2, gain: 0.025, from: 0.45, to: 0.65, f0: 800, f1: 2000 });
at(31.86, 'click', { f: 1600, gain: 0.08 });
at(31.95, 'chime', { m: 86, gain: 0.04 });
at(31.9, 'whoosh', { dur: 1.2, gain: 0.03 });
at(33.58, 'click', { f: 2200, gain: 0.07 });
for (let i = 0; i < 6; i++) at(34.0 + i * 0.22, 'click', { f: 1200 + i * 120, gain: 0.025, pan: 0.6 });
at(34.5, 'chime', { m: 78, gain: 0.025 });
at(35.75, 'whoosh', { dur: 0.5, gain: 0.03, f0: 900, f1: 2500 });
at(35.8, 'chime', { m: 74, gain: 0.03 });
at(37.6, 'whoosh', { dur: 1.3, gain: 0.07, from: 0.7, to: 0.2, f0: 250, f1: 3000 });
at(38.25, 'click', { f: 1700, gain: 0.05 });
at(38.95, 'click', { f: 1900, gain: 0.05 });
[39.15, 39.75, 40.35].forEach((t, i) => at(t, 'chime', { m: [79, 83, 86][i], gain: 0.028 }));
at(40.45, 'chime', { m: 90, gain: 0.03, dur: 0.8 });
at(41.0, 'whoosh', { dur: 1.3, gain: 0.05, from: 0.2, to: 0.7 });
at(41.86, 'click', { f: 2200, gain: 0.07 });
for (let t = 42.85; t < 47.1; t += 0.11) at(t + ((t * 100) % 3) * 0.01, 'key', { gain: 0.022 });
for (let t = 43.95; t < 47.4; t += 0.13) at(t, 'key', { gain: 0.018 });
at(47.65, 'click', { f: 1500, gain: 0.04 });
at(48.75, 'chime', { m: 86, gain: 0.04 });
at(49.1, 'whoosh', { dur: 1.0, gain: 0.03 });
at(49.9, 'click', { f: 1300, gain: 0.04 });
at(50.85, 'click', { f: 1450, gain: 0.04 });
at(51.75, 'key', { gain: 0.03 }); at(51.85, 'key', { gain: 0.03 });
at(52.1, 'whoosh', { dur: 1.2, gain: 0.04 });
at(53.4, 'riser', { end: 54.15, gain: 0.04, f0: 1500, f1: 7000 });
at(54.2, 'click', { f: 2300, gain: 0.07 });
at(54.3, 'chime', { m: 93, gain: 0.04, dur: 2 });
for (let t = 54.8; t < 56.1; t += 0.07) at(t, 'key', { gain: 0.03 });
at(56.4, 'click', { f: 800, gain: 0.07 });
for (let t = 57.05; t < 60; t += 0.18) at(t, 'click', { f: 3200, gain: 0.012, pan: 0.6 });
[60.05, 60.2, 60.35].forEach((t, i) => at(t, 'chime', { m: [86, 90, 93][i], gain: 0.025, dur: 0.9 }));
at(61.3, 'whoosh', { dur: 1.2, gain: 0.04 });
at(62.85, 'whoosh', { dur: 0.7, gain: 0.05, f0: 2400, f1: 400 });

// 7. Platform: the window lands, a wipe per theme, the custom colour, cards flip in on the beat.
at(63.0, 'whoosh', { dur: 0.9, gain: 0.06, from: 0.8, to: 0.5 });
[64.0, 64.5, 65.0, 65.5, 66.0].forEach((t, i) => at(t - 0.05, 'whoosh', { dur: 0.45, gain: 0.045, from: 0.2, to: 0.8, f0: 700 + i * 100, f1: 4200 }));
at(66.45, 'click', { f: 1800, gain: 0.05 });
at(67.0, 'click', { f: 2400, gain: 0.08 });
at(67.02, 'chime', { m: 88, gain: 0.04 });
at(67.9, 'whoosh', { dur: 0.9, gain: 0.05, from: 0.5, to: 0.3 });
for (let i = 0; i < 8; i++) at(68.55 + i * 0.2, 'click', { f: 1300 + i * 70, gain: 0.05, pan: 0.2 + (i % 4) * 0.2 });
at(71.5, 'whoosh', { dur: 0.9, gain: 0.08, f0: 300, f1: 5000 });

// 8. Your server: the terminal lands, the one-liner types, the install resolves.
at(72.0, 'whoosh', { dur: 0.8, gain: 0.05, from: 0.8, to: 0.6 });
{ const cmd = 'curl -fsSL https://get.bemmoly.com | sh'; for (let i = 0; i < cmd.length; i++) at(73.0 + i * (1.7 / cmd.length) + (i % 3) * 0.008, 'key', { gain: 0.045 }); }
at(74.78, 'click', { f: 700, gain: 0.07 });
[75.3, 75.8, 76.3, 76.8].forEach((t, i) => at(t + 0.35, 'chime', { m: [81, 83, 85, 86][i], gain: 0.035 }));
at(77.9, 'chime', { m: 93, gain: 0.04, dur: 1.8 });
at(79.35, 'whoosh', { dur: 0.9, gain: 0.05 });

// 9. Roadmap: the kernel flares, products arrive, a light follows Kavya, they part and snap back.
at(80.05, 'impact', { gain: 0.35, tail: 2.5 });
[80.45, 80.59, 80.73].forEach((t, i) => at(t, 'chime', { m: [74, 78, 81][i], gain: 0.03 }));
[81.15, 81.28, 81.41, 81.54].forEach((t) => at(t, 'click', { f: 1900, gain: 0.035 }));
at(83.0, 'whoosh', { dur: 0.6, gain: 0.05, from: 0.4, to: 0.5 });
at(83.5, 'kick', { gain: 0.3 });
at(84.6, 'whoosh', { dur: 2.2, gain: 0.05, f0: 200, f1: 2200 });
at(84.9, 'riser', { end: 85.75, gain: 0.04, f0: 1200, f1: 6000 });
[86.0, 86.14, 86.28, 86.42, 86.56, 86.70, 86.84, 86.98, 87.12].forEach((t, i) => at(t, 'chime', { m: [74, 76, 78, 81, 83, 86, 88, 90, 93][i], gain: 0.028, pan: 0.2 + (i % 5) * 0.15 }));
at(90.4, 'chime', { m: 81, gain: 0.03 });
[90.9, 91.4, 91.9, 92.4, 92.9, 93.4, 93.9, 94.4].forEach((t, i) => { at(t - 0.3, 'whoosh', { dur: 0.35, gain: 0.025, f0: 900, f1: 3000 }); at(t, 'click', { f: 2100 + i * 60, gain: 0.04 }); });
at(95.3, 'whoosh', { dur: 0.9, gain: 0.05 });
at(95.9, 'riser', { end: 97.22, gain: 0.1 });
at(97.25, 'impact', { gain: 0.7, tail: 3 });
at(99.5, 'whoosh', { dur: 0.6, gain: 0.07, from: 0.5, to: 0.5, f0: 2000, f1: 300 });

// 10. Close.
at(100.1, 'whoosh', { dur: 0.9, gain: 0.04 });
[102.75, 102.89, 103.03].forEach((t, i) => at(t, 'whoosh', { dur: 0.5, gain: 0.04, from: 0.2 + i * 0.3, to: 0.3 + i * 0.3 }));
for (let t = 2.8; t < 3.75; t += 1 / 24) at(100 + t, 'key', { gain: 0.03 });
at(103.75, 'chime', { m: 93, gain: 0.045 });
at(105.1, 'whoosh', { dur: 0.5, gain: 0.05 });
[105.55, 106.05, 106.55, 107.05].forEach((t) => { at(t, 'kick', { gain: 0.5 }); at(t, 'clap', { gain: 0.07 }); });
at(107.6, 'riser', { end: 108.13, gain: 0.06, f0: 800 });
at(108.15, 'impact', { gain: 0.65, tail: 3.8 });
at(109.65, 'chime', { m: 86, gain: 0.03, dur: 2 });
at(110.05, 'click', { f: 2000, gain: 0.05 });

export const CUES = C;
