// Assembles the scenes on one timeline and exposes seek(t) for the player and the capture script.
import { h, show, tf, FPS } from './engine.js';
import background from './scenes/background.js';
import sprawl from './scenes/sprawl.js';
import mark from './scenes/mark.js';
import promises from './scenes/promises.js';
import tour from './scenes/tour.js';
import platform from './scenes/platform.js';
import server from './scenes/server.js';
import roadmap from './scenes/roadmap.js';
import close from './scenes/close.js';

// [scene, start, end] in film seconds. Neighbours overlap so each scene can hand over smoothly;
// a scene's update(t) gets local time (t = 0 at its start) and may see t < 0 or t > length
// only inside its own window.
const TIMELINE = [
  [sprawl, 0, 9.5],
  [mark, 9.0, 15.5],
  [promises, 15.0, 25.5],
  [tour, 25.0, 63.5],
  [platform, 63.0, 72.5],
  [server, 72.0, 80.5],
  [roadmap, 80.0, 100.5],
  [close, 100.0, 112.0],
];
export const DURATION = 112;

const stage = document.getElementById('stage');
const bg = h('div', { class: 'layer' });
background.build(bg);
stage.append(bg);

const mounted = TIMELINE.map(([scene, start, end]) => {
  const root = h('div', { class: 'scene', 'data-scene': scene.id });
  scene.build(root);
  stage.append(root);
  return { scene, start, end, root };
});

// Film grain and vignette sit above everything.
const grainFrames = [0, 1, 2, 3].map((k) => {
  const c = document.createElement('canvas');
  c.width = 480; c.height = 270;
  const g = c.getContext('2d');
  const img = g.createImageData(480, 270);
  let s = 1234 + k * 999;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = (s / 2147483647) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
});
const grain = h('div', { class: 'layer', style: { mixBlendMode: 'overlay', opacity: 0.045, backgroundSize: '480px 270px', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 90 } });
const vignette = h('div', { class: 'layer', style: { background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,.55) 100%)', pointerEvents: 'none', zIndex: 91 } });
const fade = h('div', { class: 'layer', style: { background: '#000', pointerEvents: 'none', zIndex: 92 } });
stage.append(grain, vignette, fade);

let current = -1;
export function seek(T) {
  background.update(T);
  for (const m of mounted) {
    const on = T >= m.start && T <= m.end;
    show(m.root, on);
    if (on) m.scene.update(T - m.start, T);
  }
  const f = Math.floor(T * FPS);
  if (f % 2 === 0 || current < 0) grain.style.backgroundImage = `url(${grainFrames[Math.floor(f / 2) % 4]})`;
  current = T;
  // Fade from black at the top, to black at the very end.
  const o = Math.max(1 - T / 0.6, Math.min(1, Math.max(0, (T - (DURATION - 0.8)) / 0.8)));
  tf(fade, { o });
}

// ---------- Player ----------
const params = new URLSearchParams(location.search);
const capture = params.has('capture');
if (capture) document.documentElement.classList.add('capture');

function fit() {
  const vw = innerWidth, vh = capture ? innerHeight : innerHeight - 48;
  const s = capture ? 1 : Math.min(vw / 1920, vh / 1080);
  stage.style.transform = `translate(${(vw - 1920 * s) / 2}px, ${(vh - 1080 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit);
fit();

const playBtn = document.getElementById('play'), scrub = document.getElementById('scrub'), timeEl = document.getElementById('time'), nameEl = document.getElementById('scene-name');
scrub.max = DURATION;
let t = Number(params.get('t') || 0), playing = false, lastNow = 0;
const loopFrom = params.has('loop') ? Number(params.get('t') || 0) : null;
function draw() {
  seek(t);
  scrub.value = t;
  timeEl.textContent = t.toFixed(2);
  const m = mounted.find((x) => t >= x.start && t < x.end);
  nameEl.textContent = m ? m.scene.id : '';
}
function tick(now) {
  if (!playing) return;
  t += Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (t >= DURATION) { t = loopFrom ?? 0; }
  draw();
  requestAnimationFrame(tick);
}
playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; lastNow = performance.now(); if (playing) requestAnimationFrame(tick); };
scrub.oninput = () => { t = Number(scrub.value); draw(); };
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
  if (e.code === 'ArrowRight') { t = Math.min(DURATION, t + (e.shiftKey ? 1 : 1 / FPS)); draw(); }
  if (e.code === 'ArrowLeft') { t = Math.max(0, t - (e.shiftKey ? 1 : 1 / FPS)); draw(); }
});

window.__film = { seek, DURATION, ready: document.fonts.ready.then(() => { draw(); return true; }) };
if (!capture && params.has('autoplay')) playBtn.click();
