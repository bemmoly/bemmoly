# @bemmoly/site

The marketing site at https://bemmoly.com: an Astro static site, not part of the app image.
The landing page is ported from `docs/design/mocks/Bemmoly Landing.dc.html`, which is its pixel
source of truth.

| Page                              | Source                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `/`                               | The Landing mock, section by section                                  |
| `/self-hosted-project-management` | Topic page: the README's status table, tech design §1, §4 and §18     |
| `/open-source-issue-tracker`      | Topic page: the Work module's release notes, tech design §14 and §16  |
| `/kanban-and-sprint-boards`       | Topic page: the Work module's release notes (board, backlog, metrics) |
| `/on-premise`                     | Topic page: the kernel's storage, backups, updater and audit log      |
| `/self-hosting`                   | Tech design §18 and the deploy status (see below)                     |
| `/docs`                           | The guides below, the README and the tech design                      |
| `/docs/install`                   | `deploy/install.sh`, the installer's options and checks, the CLI      |
| `/docs/compose`                   | `deploy/compose` and how the installer fills in its `.env`            |
| `/changelog`, `/changelog.xml`    | The packages' `CHANGELOG.md` files (see Changelog below), and RSS     |
| `/security`                       | Renders the repository's `SECURITY.md`                                |
| `/community`                      | GitHub, the Discord placeholder, contributing                         |
| `/install.sh`                     | `public/install.sh`, a copy of `deploy/install.sh` (see below)        |

`robots.txt`, `sitemap-index.xml` (`@astrojs/sitemap`), `llms.txt`, the IndexNow key file,
`site.webmanifest`, the favicons and the Open Graph image are generated or taken from
`@bemmoly/ui/brand`.

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

## Search engines

Everything on the site is public and meant to be found, by search engines and by AI assistants.
None of it tracks visitors: there is no analytics script, and the measures below need none.

### Pages

- **One source per page.** `src/data/pages.ts` holds each page's `<title>` (30 to 60
  characters), meta description (70 to 160), short name and `updated` date; `tests/seo.test.ts`
  fails on a page without an entry, a duplicate, or a length out of range. Bump `updated` when
  a page's words change: it is the sitemap's `lastmod`, never the build time, so search engines
  can trust it. The changelog's date is its newest release.
- **One address per page.** Canonical links, `og:url` and the sitemap use the clean address
  (`/docs/install`). Caddy answers `/docs.html`, `/docs/` and `/index.html` with a 301 to it,
  `www.` with a 301 to the apex, and the 404 page with a real 404, even at `/404`.
- **Structured data.** `src/lib/structured-data.ts` builds one JSON-LD graph per page, typed
  against schema.org (`schema-dts`): Organization, WebSite, WebPage, BreadcrumbList on inner
  pages, SoftwareApplication on pages about the product (version from the newest release, price
  0, MIT, Linux, the install guide and the release download), and FAQPage only from the
  questions a page answers in its own text (`Faq.astro` renders both from one list). There are
  no ratings or reviews, and the tests fail if any appear. Google shows FAQ rich results only for
  a few kinds of sites and software rich results only with ratings, so the data is there for
  understanding, not for stars.
- **Topic pages.** The four topic pages answer what self-hosters search for: self-hosted project
  management, an open source issue tracker, Kanban and Scrum boards, on-premise data. Every
  capability on them carries a status badge (`src/data/topics.ts`), so nothing planned reads as
  shipped. Each ends with the install command and links to the others; the footer links to all
  of them and to the guides.
- **Other products.** The owner's rule: no other product's name in copy, metadata, addresses or
  structured data, except as an import source ("Import from Jira"). `tests/seo.test.ts` checks
  every built text file against a list of names and the allowed phrases.

### Crawlers and feeds

- `robots.txt` (`src/pages/robots.txt.ts`) allows everything for `*` and names each crawler in
  `src/data/crawlers.ts`: search engines, AI assistants and answer engines, training crawls and
  link previews. Excluding one later is an edit to that list.
- `llms.txt` (`src/pages/llms.txt.ts`, the llmstxt.org shape) summarises the product, what ships
  and what comes next, and lists every page from `src/data/pages.ts`, so it cannot drift.
- `/changelog.xml` is an RSS feed of the releases, linked from `/changelog`'s head.
- IndexNow: `src/lib/indexnow.ts` holds the key, served at `/<key>.txt`. The `Site IndexNow`
  workflow runs on every push to `main` that changes the site or a release note: it builds the
  site, waits until bemmoly.com serves the same sitemap (so Coolify has deployed), then submits
  every URL to api.indexnow.org, which feeds Bing, Yandex, Naver, Seznam, Yep and DuckDuckGo.
  `pnpm --filter @bemmoly/site indexnow` does the same by hand.

### Search Console and Bing Webmaster Tools

Google ignores IndexNow; it reads the sitemap you register. Both consoles are verified once,
by the owner, and need no code when verified through DNS:

1. In [Google Search Console](https://search.google.com/search-console), add a **Domain**
   property for `bemmoly.com`. It shows a `google-site-verification=…` TXT value.
2. In Cloudflare, open the `bemmoly.com` zone › DNS › Records › Add record: type `TXT`, name
   `@`, content the value from step 1, TTL Auto. Save, wait a minute, then press Verify in
   Search Console. A Domain property covers `www.` and `get.` too.
3. In Search Console › Sitemaps, submit `https://bemmoly.com/sitemap-index.xml`, and use URL
   inspection › Request indexing on `/` and the topic pages once.
4. In [Bing Webmaster Tools](https://www.bing.com/webmasters), choose **Import from Google Search
   Console** (it brings the site and the sitemap), or add the site and verify with the TXT record
   Bing shows, added in Cloudflare the same way.

Prefer the HTML-tag method instead? Set `SITE_GOOGLE_VERIFICATION` (the `content` of Google's
tag) and `SITE_BING_VERIFICATION` (Bing's `msvalidate.01` value) as **build variables** on the
Coolify application and redeploy; every page then carries the tags. Both are empty by default
(`astro.config.ts`, the `Dockerfile`'s `ARG`s), and nothing is rendered while they are.

## Design rules

- Colours, type, radii, shadows and fonts come from `@bemmoly/ui`: `tailwind.css` for the
  utilities, `fonts.css` for the self-hosted faces, and the tokens for the theme variables, which
  `src/lib/theme.ts` inlines in every page (Classic, Dark and Ocean only, not all eight presets).
- `src/styles/site.css` adds only the Landing mock's extra scale steps (58, 32, 19, 17 and 14.5px
  type, 1.08 and 1.15 line heights, -0.03em tracking, 10 and 14px radii) and two shadows built
  from the `--scrim` token. They could move into `@bemmoly/ui` if another screen needs them.
- The logo is inlined from `@bemmoly/ui/brand/lockup-color.svg`; nothing redraws it.
- No analytics, cookies or third-party scripts. The JavaScript is a 0.2 KB inline copy button
  (`CopyScript.astro`, allowed by hash in the CSP, so keep it byte-identical) and, on
  `/self-hosting` only, the 0.6 KB chooser, which Astro emits as a file under `/_astro/` that the
  CSP's `'self'` already allows.
- Badges are `@bemmoly/ui`'s Badge tones (`src/lib/badge.ts`), since the site renders no React.

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

### Setup shots

`/self-hosting` shows three crops of `docs/design/mocks/Bemmoly Setup.dc.html` in
`src/assets/setup/`: steps 1, 3 and 4 at 1280 wide, 2x, each cropped to the step's own panel and
button with 16px of the mock's background (the admin form, invite by email, the AI privacy
switches). The crops leave out the mock's "Postgres 16" health check, its identity-provider
cards and its AI vendor cards. `pnpm screens` does not recapture them yet; after the Setup mock
changes, recapture them the same way (Playwright, pick the step in the sidebar, clip to the
panel's box). They have no Ocean versions.

## Self-hosting page

`/self-hosting` leads with one recommended path (a fresh VM and the one command), then "I
already have…" cards for the other paths, a three-question chooser that marks one of them, what
every path gets, the first three setup steps and the sizing table. Every badge comes from
`STATUS` in `src/data/self-hosting.ts`; update it there as the deploy work moves:

| Path                          | Badge                       | Why                                                                                     |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| One command (recommended)     | available, tested on Ubuntu | Tested end to end on Ubuntu; Debian, Fedora and Amazon Linux are supported but untested |
| I already run Docker Compose  | available                   | The installer's Compose file and env template                                           |
| I run Kubernetes              | planned                     | The Helm chart is a skeleton                                                            |
| I want managed infrastructure | planned                     | No Terraform modules yet                                                                |
| My servers have no internet   | built, untested offline     | The air-gap bundle is built, not tested offline                                         |
| I have my own Postgres        | available                   | `--database-url`; Postgres 18, 17 with a warning                                        |

The cards' commands follow `deploy/` (the Compose folder, the chart, the bundle's README). Only
commands that work today get a Copy button. The Compose card links to `deploy/compose` on
`main`, which resolves once the deploy work is merged. Without JavaScript the chooser stays
hidden and every card shows.

## Departures from the mock

- Logo: the brand lockup (the placeholder "B" mark) at 28px tall instead of the 2x2 grid; it is
  2.3px narrower than the mock's tile and text, so the nav links start at 196.8px, not 199.1px.
- GitHub has no star count. "Live demo", "Try the live demo" and the configuration cards are
  marked as coming soon (the cards say "See it in the live demo, soon").
- The release pill shows the newest release from the release notes and "Out now: issues,
  boards, backlog and sprints"; the mock's "v1.2" pill lists features (an importer) that are not
  released. The transcript pulls that version and installs Postgres 18.
- The installer host is `get.bemmoly.com`; the AI bullet reads "Bring your own provider, or a
  local model. Or none." because no file names an AI vendor.
- The terminal background is the Dark preset's `bg` (#0f1217), not the mock's #0c0f14, and the
  transcript's success lines use Dark `ok-fg`, not #5fb582: neither literal is a token.
- Contrast (WCAG AA): footer text uses `tx4` instead of the mock's `tx5` (3.1:1 on white), the
  terminal's `ubuntu@vm` label uses `tx4`, the "soon" chips use `tx3`, and links inside running
  text on the text pages are underlined.
- The product shots are pictures of the mocks, so they show the mocks' own top bar (the designed
  four-tile mark, "v1.2.0"); recapture them with `pnpm screens` whenever a mock changes.
- Below 1100px (the mock's minimum width) the layout stacks; at 1280 it matches the mock. The
  hero takes the full width, so on a phone its text wraps instead of running off the screen.
- The footer adds a row of links to the topic pages and guides above the mock's row, in the
  same type, so every page links to them.
- `compressHTML: true`: Astro 7's default drops the space where a source line ends beside a
  link or `<code>` ("go after--domain"); lossless compression keeps the text as written.

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

- `bemmoly.com` serves the site; `/install.sh` is `text/plain`, `no-cache` and `noindex`. Old
  or doubled addresses (`/docs.html`, `/docs/`, `/index.html`) redirect (301) to the clean one,
  and `/changelog.xml` is `application/rss+xml`.
- `www.bemmoly.com` redirects (301) to `https://bemmoly.com` with the same path. Coolify's own
  "redirect to non-www" option may be enabled as well; the result is the same.
- `get.bemmoly.com` serves `/install.sh` at `/` (and `/install.sh`) as `text/plain`, so
  `curl -fsSL https://get.bemmoly.com | sh` works; other paths redirect (302) to `bemmoly.com`.
  Everything on this host is `X-Robots-Tag: noindex`, so the script never shows in results.

Caching: `/_astro/*` (hashed) is `immutable` for a year; pages and other files revalidate after
five minutes. Responses are compressed with zstd or gzip. Security headers: HSTS, nosniff,
`X-Frame-Options: DENY`, a strict referrer and permissions policy, COOP, and a CSP whose only
script source is the copy button's hash. A test (`test:container`) fails if the hash and the built
script drift apart; update the hash in `Caddyfile` when the inline script changes.

`Dockerfile.dockerignore` (read by BuildKit only for this Dockerfile) keeps `node_modules` and
build output out of the context without a root `.dockerignore`.

## Hand-offs

- **Installer.** `public/install.sh` is a copy of `deploy/install.sh`, which, piped into `sh`,
  fetches the matching GitHub release's bundled installer. Copy it again whenever
  `deploy/install.sh` changes; the site tests fail when the two differ. Until the first release
  is published there is no bundled installer for the one-liner to download.
- **Changelog.** `/changelog` and `/changelog.xml` are built from the `CHANGELOG.md` files the
  changesets tool writes for the product's packages (`src/lib/changelog.ts`; the site and the
  build tools are left out). Each note is listed once and dependency bumps are dropped. The
  notes carry no dates, so after tagging a release add its day to `RELEASE_DATES` in
  `src/data/changelog.ts`; until then it shows without one. The `Dockerfile` copies each
  changelog into the build, and a test fails when a package's changelog is missing there. In
  Coolify, leave the watch paths empty (or include `**/CHANGELOG.md`), so a release redeploys
  the site and its changelog.
- **Discord.** `/community#discord` says the invite is not published; add the link there and in
  `src/lib/links.ts`.
