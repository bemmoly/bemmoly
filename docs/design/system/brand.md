# Brand

The logo, where it sits, and why its three colours are the product's colour system.

## Logo files

The SVG files in [`packages/ui/assets/brand/`](../../../packages/ui/assets/brand/README.md) are
the only source of the logo. Nothing draws it any other way.

| File             | What it is                                                         |
| ---------------- | ------------------------------------------------------------------ |
| `mark-*.svg`     | The four tilted tiles: favicon, app icons, the rail, small places  |
| `wordmark-*.svg` | "Bemmoly" in IBM Plex Sans SemiBold, outlined                      |
| `lockup-*.svg`   | Mark and wordmark, 10 units apart, the word at 115% of the mark    |

Tones: `-color` (default in the app), `-dark` (light backgrounds without CSS variables),
`-light` (dark backgrounds), `-mono` (one colour, tiles at 100/75/55% opacity).

Use it through the component, never as an `<img>` in product UI:

```tsx
import { Logo } from '@bemmoly/ui';

<Logo variant="lockup" size={20} />        // sidebar, sign-in before a workspace name
<Logo variant="mark" size={16} label="" /> // beside text that already says Bemmoly
```

`Logo` props: `variant` (`mark` | `wordmark` | `lockup`), `tone` (`auto` | `light` | `dark` |
`mono`), `size` (height in px), `label` (accessible name; `""` when text beside it already names
it). Story: Components/Logo ([`logo.stories.tsx`](../../../packages/ui/src/components/logo/logo.stories.tsx)).
Favicons and app icons are generated: `pnpm --filter @bemmoly/ui brand:icons`.

Rules:

- The mark keeps its designed colours on every preset and every custom theme. Custom themes
  never recolour the mark; `Logo` inlines fixed fills, and nothing may pass a theme colour in.
- Never stretch, outline, rotate, shadow or re-letter the logo. Never put the mark on an accent
  tile (that was the placeholder it replaced).
- The lockup's spacing and ratio are in the files. Do not rebuild a lockup from mark plus text.

## The brand block

`BrandBlock` (with `BrandRailTop` and `BrandRailFoot` for the collapsed rail) from `@bemmoly/ui`
is the sidebar's top-left. Story: Foundations/BrandBlock
([`brand-block.stories.tsx`](../../../packages/ui/src/components/logo/brand-block.stories.tsx)).

```tsx
import { BrandBlock, BrandRailFoot, BrandRailTop } from '@bemmoly/ui';

<BrandBlock workspaceName="Acme Labs" workspaceMenu={menuItems} sidebarToggle={toggle} />
<BrandBlock workspaceName="Acme Labs" customLogo={{ src, name: 'Acme Labs' }} />
```

1. **Bemmoly always holds the top-left.** Line one is the lockup; line two is the workspace name,
   small, `tx-3`, with a caret.
2. **A customer logo takes line one only.** With `customLogo`, line one is their logo and name;
   line two reads "on Bemmoly" with the mark. It cannot be switched off.
3. **The collapsed rail keeps the mark.** No customer logo: the Bemmoly mark leads the rail
   (`BrandRailTop`). With one: their logo leads and the Bemmoly mark sits at the rail's foot
   (`BrandRailFoot`), whose tooltip shows the version and What's new.
4. **No workspace switcher, ever.** One install is one workspace (there is no workspaces table).
   The name under the lockup opens the workspace menu: Workspace settings, Invite people,
   What's new, About. Nothing anywhere offers to switch or add a workspace.
5. **The name survives off the sidebar.** Sign-in shows the workspace, then "Powered by" and the
   mark (the lockup leads before the workspace has a name); the tab title ends "· Bemmoly"
   (`useDocumentTitle`); the sidebar foot shows "Bemmoly 0.4.0 · What's new"; email footers
   name Bemmoly; the boot screen paints the mark.
6. **Honest about the licence.** MIT lets a fork remove any of this. The aim is a default good
   enough that nobody wants to.

## Logo colours are the system

The mark's three colours are fixed tokens (`BRAND` in `src/tokens/semantic.ts`); no preset or
custom theme changes them.

| Token     | Hex       | Its one job                                                        |
| --------- | --------- | ------------------------------------------------------------------ |
| `brand-1` | `#2356C9` | Classic's accent, and the Work module's colour                     |
| `brand-2` | `#5B7BE5` | The Docs module's colour, and the base of the dark accent          |
| `brand-3` | `#9A85EA` | AI, and only AI (lilac; `ai` tokens carry it in the UI, see [ai.md](ai.md)) |

- Work's tile is `EntityTile tone="work"` (`bg-brand-1`); Docs' is `tone="docs"` (`bg-brand-2`);
  AI's is `tone="ai"` (`bg-brand-3`). Module manifests name the colour as a token, never a hex:
  `color: 'brand-1'` (see [layout.md](layout.md#module-sidebar-contributions)).
- Interactive accent uses the `acc` tokens, not `brand-*`: a preset or custom theme may change
  the accent, but never the module or AI colours.
- Epics have their own violet, `type-epic` / `epic-2` `#6E56CF`, so they never read as AI.
- A new module takes an epic hue (`epic-1` to `epic-8`) or `accent`, never a logo colour that
  is already taken.

## Tiles

Every square identity mark (workspace, project, module, team, space) is `EntityTile`: rounded at
the logo's corner ratio, a letter, an icon or an uploaded image. Projects use the Work module's
`ProjectTile` (an `EntityTile` on the name's hue) everywhere. See
[components.md](components.md#entitytile-and-projecttile).
