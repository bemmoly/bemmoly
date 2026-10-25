# Bemmoly launch film

A 112-second product launch film. It is built entirely in code: a small motion engine in plain
JavaScript, with no animation library and no video tool. Every frame is a pure function of time,
so the film plays live in a browser and renders frame-perfect at 60 fps. The score is
synthesized from code too: no samples, no licences.

The storyboard and the honesty rules are in [STORYBOARD.md](STORYBOARD.md).

## Watch it live

```bash
node tools/serve.mjs
```

Open http://127.0.0.1:5310/. Space plays and pauses. The arrow keys step one frame, and Shift
plus an arrow steps one second. `?t=63` starts at 63 s and `?autoplay` plays on load. Live
playback can drop frames on a slow machine; the rendered file never does.

## Render it

```bash
npm install
npm run score
node tools/capture.mjs --audio out/score.wav
```

- `npm install` installs `playwright-core` and `lucide-static`. Capture uses the Chromium that
  Playwright already keeps in `~/Library/Caches/ms-playwright`.
- `npm run score` writes `out/score.wav`.
- `node tools/capture.mjs --audio out/score.wav` writes `out/bemmoly-launch.mp4`. Frames are
  supersampled at 2× (3840 × 2160), so the file is a 4K master. A full render takes about 20
  minutes on 10 workers.

To make the 1080p copy:

```bash
ffmpeg -i out/bemmoly-launch.mp4 -vf scale=1920:1080:flags=lanczos -c:v libx264 -crf 20 -c:a copy out/bemmoly-launch-1080p.mp4
```

Other options:

- `--from 25 --to 42` renders a range.
- `--stills 9.5,30,97.25 --dir out/stills` writes PNG stills.
- `--scale 1` renders fast 1080p drafts.
- `--workers 10` sets how many headless browsers render in parallel, one browser each.
- `--fps 60` sets the frame rate.

## How it's put together

| Path                   | What it holds                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- |
| `src/engine.js`        | Time helpers (easing, springs, keyframes, seeded random) and DOM writers      |
| `src/components.js`    | The logo as four movable tiles, wordmark, lockup, cursor, check badge, kinetic type, captions, the app window |
| `src/style.css`        | Design-system tokens (light and dark), fonts, stage                           |
| `src/main.js`          | The timeline (which scene runs when), grain, vignette, the player             |
| `src/scenes/*.js`      | One file per scene, each with `build(root)` and `update(t)`                   |
| `tools/capture.mjs`    | Headless Chromium → JPEG frames → ffmpeg (H.264, CRF 14)                      |
| `tools/score.mjs`      | The synthesizer and arrangement (D major, 120 BPM)                            |
| `tools/cues.mjs`       | Sound cues locked to picture events, in film seconds                          |

Rules every scene follows:

- `update(t)` must draw the same frame for the same `t`, in any order. No CSS transitions, no
  `Date`, no `Math.random` (use `rand(seed)`).
- Chrome splits intersecting planes inside a `preserve-3d` group. Tilted cards therefore carry
  their own `perspective()` in a flat group, depth-sorted by z-index. Captions and SVG lines live
  on flat layers.
- When you move a beat in a scene, move its cue in `tools/cues.mjs`.

## Changing what it says

Claims follow the launch rules in STORYBOARD.md. Only shipped features are presented as
shipping. Pipelines is "In progress". The nine suite products are "Coming soon", with no dates
and no versions. A competitor is named only as an import source.
