# @bemmoly/site

The marketing site at https://bemmoly.com: an Astro static site, not part of the app image.
The homepage follows the site design review's Proposed tabs (the review of bemmoly.com, built on
the product's visual system, ADR 0015); the first Landing mock
(`docs/design/mocks/Bemmoly Landing.dc.html`) still holds for the text pages it styled.

| Page                              | Source                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `/`                               | The site review's homepage, section by section (see Homepage below)   |
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
| `/community`                      | GitHub issues, security reports, contributing                         |
| `/install.sh`                     | `public/install.sh`, a copy of `deploy/install.sh` (see below)        |
| `/demo`                           | The live demo: apps/web's demo build (see Live demo below)            |

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
pnpm --filter @bemmoly/site previews        # recapture every product picture from the demo
pnpm --filter @bemmoly/site docker:build    # the production image, tagged bemmoly-site:dev
pnpm --filter @bemmoly/site test:container  # Caddy hosts and headers against that image
```

From the root, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm size` include
the site. Turborepo builds the site before its `lint` and `test` (both read `dist/`), and its
build does not wait for the design system's Storybook build because it reads the package's
source directly. It does wait for `@bemmoly/web#build:demo`, the live demo, which `build` copies
into `dist/demo` (`scripts/bundle-demo.ts`); run the site's build through Turborepo, or build the
demo first, or the build stops and says so.

## Live demo

`/demo` is the real web app (`apps/web`) on its mock backend, built with
`vite build --mode demo` into `apps/web/dist-demo`:

- **No server.** The mock backend (`apps/web/src/mocks`) already runs inside the page: MSW's
  fetch and WebSocket interceptors answer every `/api/v1` and `/ws` call, and in the demo nothing
  falls through to a network. `apps/web/src/demo` starts it with the mocks' signed-in Acme Labs
  workspace, in memory only, so a reload starts over, and shows the slim banner ("Live demo ·
  data resets on reload · Install Bemmoly"). The demo code is behind the build-time `__DEMO__`
  flag and compiled out of the install build.
- **Modules.** Every module the mocks ship is enabled (except the developer Sample), and the
  shell bundles every `modules/*/web` chunk, so a module's screens reach the demo when its mock
  handlers land, with no change to the demo or the image.
- **Base path.** The router's `basepath` is vite's `base` (`/` on installs, `/demo/` here); the
  demo also keeps module chunks' root-relative `pushState` and links under `/demo`.
- **One version.** The demo reports the release in `apps/web/package.json`, which the changesets
  tool bumps with the release notes; `tests/version.test.ts` checks that it, every page, the
  JSON-LD and llms.txt name the same release, the newest in the changelogs.
- **Search.** `/demo` is indexable, in the sitemap and llms.txt, with its title and description
  from `DEMO_PAGE` in `src/data/pages.ts`; every route under it is `X-Robots-Tag: noindex`.
- **Headers.** Caddy serves every `/demo` route as the demo's `index.html` under the app's own
  CSP (packages/core security-headers) with `frame-ancestors 'self'` and
  `X-Frame-Options: SAMEORIGIN`, so only the site's previews can frame it.

The site's tests check the bundle and the routes the previews open (`tests/demo.test.ts`); the
click-through (board drag, backlog, an issue, the workflow editor, at 1280 and 375 wide) is a
browser check before release. The app is designed for desktop widths: on a phone it works but
scrolls sideways on the board.

### Product pictures and the live preview

Every picture of the product is captured from the demo, never drawn or taken from a mock:
`scripts/capture-previews.ts` opens each route in `src/data/previews.ts` (Board, a Docs page,
an Issue, the Backlog) at 1280 × 744 and the board at 390 wide (the phone poster), 2x, in the
product's light and dark themes (`?theme=dark`), with the demo banner removed. Run it after
building the site with its demo (`pnpm previews`), or against a running demo build
(`pnpm --filter @bemmoly/web exec vite --mode demo --port 5391`, then
`pnpm previews -- --origin http://127.0.0.1:5391`). Recapture whenever the demo's screens
change; `tests/demo.test.ts` fails if a preview lacks either theme.

`Poster.astro` puts both themes in one `<picture>` (AVIF and WebP at 640 to 2560 wide): the
dark sources carry a `prefers-color-scheme` query, so a browser downloads only the one it shows,
and the footer's theme control rewrites those queries. The hero's preview
(`ProductPreview.astro`, `src/lib/client/preview.ts`) shows the four posters as tabs (arrow
keys, Home, End). "Try it live" frames the route over the poster at the same size, scaled to
fit, behind a skeleton that says what is happening; if the app has not drawn in eight seconds
the frame says so and offers Retry and a new tab. Esc in the live app returns focus to the tabs.
Nothing of the demo loads before that press. Without JavaScript, or in a frame narrower than
640px, the tabs and the button are links to the full demo; phones get the phone poster instead.

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
  `src/lib/theme.ts` inlines in every page (the product's light and dark presets only).
- `src/styles/site.css` adds only the marketing display steps the product never needs (64, 44,
  40 and 32px titles, the 22px card title) and, for the text pages, the first Landing mock's
  14.5, 17 and 19px steps. Everything else is the product's scale.
- The logo is inlined from `@bemmoly/ui/brand`: the re-cut lockup (lettering at 115%) and the
  mark; nothing redraws it. Module tiles are the logo's colours at its corner ratio.
- Icons are drawn: `Icon.astro` renders the product's own Lucide set (`@bemmoly/ui/icons`, stroke
  1.75) to SVG at build time, plus a few marketing-only icons from the same Lucide release
  (`src/lib/icons.ts`). The product's `no-glyph-characters` lint rule runs on `.astro` files.
- No analytics, cookies or third-party scripts. The JavaScript is a tiny inline theme script
  (`ThemeScript.astro`, allowed by hash in the CSP, so keep it byte-identical) and one site
  script of about 2.5 KB gzip (`src/lib/client`: menu, theme control, copy, share, tabs and the
  preview), plus the 0.6 KB chooser on `/self-hosting`; Astro emits them as files under
  `/_astro/` that the CSP's `'self'` already allows.
- Badges are `@bemmoly/ui`'s Badge tones (`src/lib/badge.ts`), since the site renders no React:
  green is shipped, the accent is new, grey is planned, amber is untested, lilac is AI only.

### Light and dark

The site follows the visitor's system into the product's dark theme (#111418 surfaces, the mid
blue as accent). The footer's System / Light / Dark control overrides it and is remembered in
the browser; `ThemeScript.astro` applies the choice before the first paint, so there is no flash,
and blocked storage falls back to the system setting. `data-theme="dark"` on an element makes a
dark island on a light page (the self-hosting band, the terminal blocks), as the product's code
blocks are. Tailwind's `dark:` variant covers all three cases; most styles need none, because
the tokens themselves change.

## Homepage

`src/pages/index.astro`, from the site design review: the hero ("Your work. Your platform.", the
three promises as ticks, the install command with its copy button, the product in four views),
the three promises with the file behind each claim, Work and Docs, the AI band, "Yours to run",
install, import and configure, open source, the FAQ and the final call. The copy lives in
`src/data/landing.ts`, the claims and their files in `src/data/proofs.ts`, the questions in
`src/data/faq.ts` (also the page's FAQPage data).

- **Proof.** `tests/promises.test.ts` fails when a file a proof line quotes no longer contains
  the line, so a claim cannot outlive the code behind it.
- **Versions.** Read from the changelogs at build time. Nothing unreleased carries a version;
  Docs' "New in 0.3" comes from the module's own changelog, and the recent releases are the
  changelog's list (`data-release-history`, the one place older versions may appear).
- **No time promises.** No install time is published until the nightly install job measures one.
- **Live facts.** The GitHub star count is fetched once per build (`src/lib/clients/github.ts`,
  5 s timeout); when the fetch fails the number is simply left out.
- **Names.** Other products appear only as import sources ("Import from Confluence",
  "Import from Jira"); `tests/seo.test.ts` enforces it.

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

## Notes on the build

- The self-hosting page and the topic pages keep the first Landing mock's layout until their own
  redesign (the setup guide is a later build); they already take the product's tokens, dark
  theme, drawn icons and the review's page-title sizes.
- Contrast (WCAG AA): every text colour is a product token at 4.5:1 or better; accent text on
  its own tint steps up to `acc-500` in dark mode, and links inside running text are underlined.
- On a phone the hero's command wraps instead of scrolling, so Copy stays in reach; the
  "Share the command to your computer" link uses the Web Share API and becomes "Copy the
  command" where it is missing.
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
inline script source is the theme script's hash. `tests/csp.test.ts` (and `test:container`)
fail if the hash and the built script drift apart; update the hash in `Caddyfile` when the
inline script changes.

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
- **Live demo.** The image builds the demo in its own stage (the whole workspace context, the
  web shell and every module installed, `build:demo`), in parallel with the site, so a build
  takes a few minutes longer than before and the Docker build context is the repository. In
  Coolify, leave the watch paths empty (or add `apps/web/**`, `modules/**` and `packages/**`),
  so a change to the app redeploys the demo. Nothing else changes: same Dockerfile, port and
  domains.
- **Discord.** There is no invite yet, so the site does not mention it. When one exists, add a
  section to /community and the link to `FOOTER` in `src/lib/links.ts`.
