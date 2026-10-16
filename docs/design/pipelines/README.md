# Pipelines: the frame and its parts

Bemmoly Pipelines is a separate product with its own shell ([ADR 0037](../../adr/0037-pipelines-is-a-separate-product-with-its-own-shell.md)).
This page covers only what Pipelines adds: the frame, scope and the product's components.
Everything else (tokens, type, radii, elevation, motion, icons, the glyph ban, words, AI,
accessibility) is [the design system](../system/README.md), unchanged.

The drawings are in [the product design](../../proposals/pipelines/product-design.html); the
code is `apps/pipelines-web` and `packages/ui`.

## The frame: `PipelinesShell`

| Part | What it is | Code |
| --- | --- | --- |
| Rail | 72px, `bg-side`, a right rule. The Bemmoly mark, then For you, Map, Catalog, Runs, Releases, Insights, Platform: an 18px icon over an 11px label, 52px tall. Settings and the person at the foot | `shell/rail.tsx`, `shell/place-link.tsx`, `shell/places.ts` |
| Top bar | 48px, `bg-canvas`, a bottom rule. The scope switcher on the left, search in the middle (Mod+K), then the live counter, notifications and help | `shell/top-bar.tsx` |
| Content | One scrolling area (`main#content`); screens never add their own scroll container or header bar | `shell/pipelines-shell.tsx` |
| Phone bar | Below 768px the rail is hidden and a bottom bar shows For you, Map, Catalog, Runs and More | `shell/phone-bar.tsx` |
| Palette | Mod+K: applications by name, key or label; places; domains to zoom to; actions | `shell/command-menu.tsx` |

Screens put their title in a 20px `h1` at the top of the content (`ScreenFrame`) and build
their body from `@bemmoly/ui` components. A screen still being built shows a designed empty
state that names what it will hold (`PlannedScreen`), never a blank page.

### Mode

Dark by default; T or the person menu switches to light, kept per person on the device and
separate from Bemmoly's own mode. Every screen is drawn and checked in both.

### Keys

| Key | Does |
| --- | --- |
| Mod+K | Search and commands |
| T | Light or dark |
| ? | Every key that works on the screen on show (screens list theirs with `useShortcutHelp`) |
| G then Y, M, C, R, E, I, P, S | For you, Map, Catalog, Runs, Releases, Insights, Platform, Settings |

Screen keys (J K, [ ], L, Shift+R, P, Shift+B, A) are listed in the product design's interaction
notes and belong to each screen.

## Scope

Scope is the main idea: Map, Catalog, Runs, Releases and Insights show "this scope". It is
Organisation › Domain › Group, lives in the URL as `?scope=commerce/checkout`, and is kept when
moving between scoped screens. The switcher is a searchable menu at the domain and group levels
(`SwitcherMenu` from `@bemmoly/core-web`); domain tiles use the domain's epic hue
(`EntityTile hue`). Environments and domains get no colour of their own; Prod is marked with
the shield icon and the word "Protected"; red stays for failure.

## Live data

One server-sent events stream per tab (`hooks/use-stream.ts`, `GET /api/v1/pipelines/streams`).
Screens subscribe to topics (`live`, `map:<scope>`, `run:<id>`, `job:<id>:log`,
`application:<key>`, `for-you`, `capacity`); events arrive at most once per topic and kind per
second and are invalidations: refetch, never patch from the event.

## Components

| Component | Where | Status |
| --- | --- | --- |
| `PipelinesShell`, `Rail`, `ScopeSwitcher`, `LiveCounter` | `apps/pipelines-web/src/shell` | built |
| `RunGlyph` (queued, running, passed, failed, waiting, skipped, rolled back) | `packages/ui` | built |
| `Journey` (stations from commit to the last region) | `packages/ui` | built |
| `Lane` (a map cell's moving dots, still under reduced motion and while rewound) | `packages/ui` | built |
| `DeployCell` (one map cell: the lane over the count, up to two flags; holds still while rewound) | `packages/ui` | built |
| `TimeScrubber` (deploys per bucket, incidents in red, a handle that rewinds; a slider for the keys) | `packages/ui` | built |
| `ReleaseMap` (the grid of `DeployCell`s) | `apps/pipelines-web` | to build with the Map |
| `StageGraph` (fan-out, fan-in, selected and failed rings) | `packages/ui` | built |
| `LogView` (virtualised, searchable, follow, ANSI on tokens, error lines on `red-50`) | `packages/ui` | built |
| `GateList` (each gate's state and reason), `RolloutPlan` (waves of canary steps) | `packages/ui` | built |
| `MetricCompare` (canary against stable), `SeriesChart` (a line or bars with markers and a threshold) | `packages/ui` | built |
| `FacetPanel`, `DeliverySpark` | `packages/ui` | built |
| `AccessExplain` (a decision, its sentence and the steps behind it) | `packages/ui` | built |
| `ProvisionChecklist` (ordered steps toward something working: first run, a landing zone) | `packages/ui` | built |

A new component lands in `packages/ui` with a story and an accessibility test
([changing-the-system.md](../system/changing-the-system.md)), and gets a row here.
