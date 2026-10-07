# @bemmoly/site

The marketing site at https://bemmoly.com: an Astro static site, not part of the app image.
The landing page is ported from `docs/design/mocks/Bemmoly Landing.dc.html`, which is its pixel
source of truth.

| Page            | Source                                                   |
| --------------- | -------------------------------------------------------- |
| `/`             | The Landing mock, section by section                     |
| `/self-hosting` | Tech design §18 in plain words                           |
| `/security`     | Renders the repository's `SECURITY.md`                   |
| `/changelog`    | `src/data/changelog.ts` (see below)                      |
| `/docs`         | Placeholder pointing at the README and the tech design   |
| `/community`    | GitHub, the Discord placeholder, contributing            |
| `/install.sh`   | `public/install.sh`, a placeholder installer (see below) |

`robots.txt`, `sitemap-index.xml` (`@astrojs/sitemap`), `site.webmanifest`, the favicons and the
Open Graph image are generated or taken from `@bemmoly/ui/brand`.

## Commands

```sh
pnpm --filter @bemmoly/site dev             # http://localhost:4321
pnpm --filter @bemmoly/site build           # dist/
pnpm --filter @bemmoly/site preview         # serve dist/
pnpm --filter @bemmoly/site typecheck       # astro check
pnpm --filter @bemmoly/site lint            # eslint (incl. .astro) + html-validate on dist/
pnpm --filter @bemmoly/site test            # Vitest against dist/ via astro preview
pnpm --filter @bemmoly/site size            # page JavaScript budget, 30 KB gzip
pnpm --filter @bemmoly/site screens         # recapture the product shots from the mocks
pnpm --filter @bemmoly/site docker:build    # the production image, tagged bemmoly-site:dev
pnpm --filter @bemmoly/site test:container  # Caddy hosts and headers against that image
```

From the root, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm size` include
the site. Turborepo builds the site before its `lint` and `test` (both read `dist/`), and its
build does not wait for the design system's Storybook build because it reads the package's
source directly.

## Design rules

- Colours, type, radii, shadows and fonts come from `@bemmoly/ui`: `tailwind.css` for the
  utilities, `fonts.css` for the self-hosted faces, and the tokens for the theme variables, which
  `src/lib/theme.ts` inlines in every page (Classic, Dark and Ocean only, not all eight presets).
- `src/styles/site.css` adds only the Landing mock's extra scale steps (58, 32, 19, 17 and 14.5px
  type, 1.08 and 1.15 line heights, -0.03em tracking, 10 and 14px radii) and two shadows built
  from the `--scrim` token. They could move into `@bemmoly/ui` if another screen needs them.
- The logo is inlined from `@bemmoly/ui/brand/lockup-color.svg`; nothing redraws it.
- No analytics, cookies or third-party scripts. The only JavaScript is a 0.2 KB inline copy
  button, allowed by hash in the CSP.

### Light only, with an Ocean version ready

Every visitor gets the light (Classic) design, whatever their system setting. A dark version in
the Ocean preset is built and applies only when the root element has `data-theme="dark"`;
nothing sets it yet. Tailwind's `dark:` variant targets that attribute. In it the page is Ocean
`bg`, raised surfaces are `sf` with `br` borders, buttons and the hero glow use the sky accent
with navy text (from `contrastCheck`), body copy uses `tx2`, and the product shots are the
Ocean captures (lazy and hidden otherwise, so light visitors never download them).

### Product shots

The mock embeds the Board and Command mocks live. `scripts/capture-screens.ts` opens the
Landing mock at 1280 wide, 2x, and saves the inside of each frame to `src/assets/screens/`,
once as drawn and once in Ocean (`scripts/ocean-mocks.ts`: the Board's own `theme="ocean"`, and
the Command palette's Classic literals swapped for the same tokens' Ocean values). Astro serves
them as AVIF and WebP at 400, 800, 1184 and full width. Run `pnpm screens` after a mock changes.

## Departures from the mock

- Logo: the brand lockup (the placeholder "B" mark) at 28px tall instead of the 2x2 grid; it is
  2.3px narrower than the mock's tile and text, so the nav links start at 196.8px, not 199.1px.
- GitHub has no star count. "Live demo", "Try the live demo" and the configuration cards are
  marked as coming soon (the cards say "See it in the live demo, soon").
- The release pill reads "0.1.0 · In progress: setup wizard, eight themes, one-command upgrades";
  the mock's "v1.2" pill lists features (the workflow editor, an importer) that 0.1.0 does not
  ship. The transcript pulls `bemmoly:0.1.0` and installs Postgres 18.
- The installer host is `get.bemmoly.com`; the AI bullet reads "Bring your own provider, or a
  local model. Or none." because no file names an AI vendor.
- The terminal background is the Dark preset's `bg` (#0f1217), not the mock's #0c0f14, and the
  transcript's success lines use Dark `ok-fg`, not #5fb582: neither literal is a token.
- Contrast (WCAG AA): footer text uses `tx4` instead of the mock's `tx5` (3.1:1 on white), the
  terminal's `ubuntu@vm` label uses `tx4`, the "soon" chips use `tx3`, and links inside running
  text on the text pages are underlined.
- The product shots are pictures of the mocks, so they show the mocks' own top bar (grid mark,
  "v1.2.0").
- Below 1100px (the mock's minimum width) the layout stacks; at 1280 it matches the mock.

## Deployment (Coolify)

The image is built from the repository root and serves `dist/` with Caddy on port 80.

| Setting             | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Build pack          | Dockerfile                                                                  |
| Base directory      | `/`                                                                         |
| Dockerfile location | `/apps/site/Dockerfile`                                                     |
| Exposed port        | `80`                                                                        |
| Domains             | `https://bemmoly.com`, `https://www.bemmoly.com`, `https://get.bemmoly.com` |
| Health check        | `GET /` on port 80 (the image also has a `HEALTHCHECK`)                     |

All three domains point at the same container; Coolify's proxy terminates TLS and Caddy routes by
host:

- `bemmoly.com` serves the site; `/install.sh` is `text/plain`, `no-cache`.
- `www.bemmoly.com` redirects (301) to `https://bemmoly.com` with the same path. Coolify's own
  "redirect to non-www" option may be enabled as well; the result is the same.
- `get.bemmoly.com` serves `/install.sh` at `/` (and `/install.sh`) as `text/plain`, so
  `curl -fsSL https://get.bemmoly.com | sh` works; other paths redirect (302) to `bemmoly.com`.

Caching: `/_astro/*` (hashed) is `immutable` for a year; pages and other files revalidate after
five minutes. Responses are compressed with zstd or gzip. Security headers: HSTS, nosniff,
`X-Frame-Options: DENY`, a strict referrer and permissions policy, COOP, and a CSP whose only
script source is the copy button's hash. A test (`test:container`) fails if the hash and the built
script drift apart; update the hash in `Caddyfile` when the inline script changes.

`Dockerfile.dockerignore` (read by BuildKit only for this Dockerfile) keeps `node_modules` and
build output out of the context without a root `.dockerignore`.

## Hand-offs

- **Installer.** `public/install.sh` prints "The Bemmoly installer is not published yet; follow
  github.com/bemmoly/bemmoly" and exits 1. When `deploy/install.sh` is released, replace this
  file with it (or copy it in during the image build); Caddy already serves it at both hosts.
- **Changelog.** `/changelog` reads `src/data/changelog.ts`, which lists 0.1.0 as in progress.
  Once the changesets tool writes release notes, render them here instead.
- **Discord.** `/community#discord` says the invite is not published; add the link there and in
  `src/lib/links.ts`.
