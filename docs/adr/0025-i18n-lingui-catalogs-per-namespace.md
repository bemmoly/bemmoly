# ADR 0025: Text is ICU messages in per-namespace catalogs, on Lingui's runtime

- Status: accepted
- Date: 2026-10-11
- Changes: tech design §24 lists "i18n scaffolding" for 1.0 and §8 keeps `users.locale` and
  `workspace.locale`, without saying how text becomes translatable; this record decides it.
- Evidence: the shell, sign-in and Settings › Profile extracted as the worked example;
  `apps/web/e2e/pseudo-locale.spec.ts`; the web shell's initial JS at 243.5 KB of its 250 KB
  budget (238.9 KB before).

## Context

Every string in the product was an English literal in a component, a hook or a server template.
1.0 needs the scaffolding for other languages, without translating anything yet and without
stopping the streams editing the UI at the same time. The constraints:

- React 19 and one lazy chunk per module (ADR 0008): a module's words must arrive with its chunk,
  and the kernel never imports a module.
- The shell's initial JS budget (250 KB gzip, `pnpm size`) had about 11 KB left.
- Plurals, selects and numbers inside sentences need ICU MessageFormat, the format translators'
  tools speak.
- Server text (errors, emails) must be translatable too, and the server has no build step
  (ADR 0003).

## Decision

1. **Lingui's core runtime, catalogs compiled at build time.** `@lingui/core` (about 2 KB gzip)
   formats messages already compiled to its runtime form; a Vite plugin
   (`@bemmoly/i18n-tools/vite`) compiles every catalog with `@lingui/message-utils` as it is
   imported, so the browser ships no ICU parser and a message that does not parse fails the build.
   No macros, no Babel step and no extraction from source: ids are written by hand. React
   bindings are ours (`useT` in `@bemmoly/core-web`, on `useSyncExternalStore`); Lingui's React
   package is not used. Rejected: FormatJS (`intl-messageformat`, about 10 KB with its parser,
   which the budget could not take), i18next with its ICU plugin (larger again), a home-grown
   ICU parser (a format we would own forever).
2. **One catalog per namespace and locale.** A file is `…/i18n/<namespace>.<locale>.json`: one
   flat JSON object of id → ICU message. Ids are `<namespace>.<area>.<name>`
   (`auth.signIn.title`). Namespaces are owned: `core` (core-web's frame), `shell`, `auth`
   and `settings` (apps/web), `errors` (packages/shared), `email` (packages/core), and one per module
   (`work`, `docs`) as each is extracted. English (`en`) is the source; every other file is a
   translation of it.
3. **Modules bring their own catalogs through core-web.** `defineCatalog(namespace, english,
   { fr: () => import('./work.fr.json') })` registers a namespace and returns a handle;
   `useT(handle)` gives a `t` typed by the English file, so an unknown id fails the typecheck.
   English is imported statically by the code that draws it (the shell's in the initial bundle,
   a module's in its chunk); other locales are lazy chunks loaded only for a person who picked
   one. `setLocale` loads what every registered namespace needs, then switches in one paint; a
   namespace registered later loads its locale as it arrives. A translation missing an id shows
   the English message. The kernel holds the registry and never imports a module.
4. **Plurals and the rest are ICU.** `{count, plural, one {# issue} other {# issues}}`, `select`,
   `selectordinal` and `{n, number}` go through Intl in the active locale. Rich text uses tags
   (`<link>Reset your password</link>`) drawn by `t.rich`; values are escaped so a person's name
   can never become a tag. A sentence is one message: whole sentences may sit side by side, but
   a sentence is never assembled from translated fragments, since word order differs by language.
5. **Locale, detection and the preference.** English is the only shipped locale
   (`SHIPPED_LOCALES` in `@bemmoly/shared`); a locale ships when all its catalogs are complete.
   The shell picks, in order: `?locale=`, the person's saved language (`users.locale`, set in
   Settings › Profile through `PATCH /users/:id`, empty for Automatic), this device's last explicit
   choice (for pages before sign-in), the browser's languages, then English. `<html lang dir>`
   follows. The workspace's language (`workspace.locale`) is offered only among shipped locales
   and is the default for email.
6. **Dates, numbers and relative times go through Intl in the active locale.** The kit holds
   the formatting locale (`@bemmoly/ui/intl`), so `RelativeTime`, `formatRelative`,
   `formatAbsolute`, `formatDate`, `formatNumber`, `formatBytes` and `formatDateTime` follow the
   person's language; core-web sets it when the language changes. English output is unchanged.
7. **Server messages carry ids.** A `BemmolyError` thrown with its default message names
   `errors.<code>` (from `packages/shared/src/i18n/errors.en.json`); any error may pass its own
   `messageId` and `values`. The error body adds both (optional, so older clients are unaffected)
   while `message` stays the English rendering for API clients, logs and the CLI. The web shows
   the catalog message when it knows the id. Emails render on the server through
   `services/i18n` with the same catalog layout, compiled per locale at first use; the email
   frame carries the language (the workspace's until each send passes its recipient's
   `users.locale`), which sets `<html lang>` and the date format. The password reset email is the
   first written this way.
8. **The pseudo-locale is the test language.** `en-XA` accents every letter, pads by about 40%
   and brackets each message. It is generated from English at run time in its own chunk,
   reachable with `?locale=en-XA` (and listed in Profile in dev builds). A Playwright run puts
   the extracted screens in it on desktop and phone and fails on text that overflows its box.
9. **Right to left is prepared, not shipped.** `dir` follows the locale. Extracted screens use
   logical utilities (`ms-`, `pe-`, `start-`, `border-s`, `rounded-e`, `text-start`); the
   `bemmoly/logical-properties` lint rule fails physical ones there. Icons that point
   (back, chevrons) and slide-in motion still need mirroring before a right-to-left locale
   ships.
10. **Guards.** `pnpm i18n:check`, in Fast checks, fails on: ids outside their namespace,
    messages that do not parse, a namespace with two sources, a shipped locale missing an id, a
    translation whose placeholders differ from English, and an id the code names that English
    lacks. `bemmoly/no-literal-ui-strings` fails literal JSX text and read props (`aria-label`,
    `title`, `label`, `placeholder`, …) in extracted files. Both rules list files as they are
    extracted, so streams still editing other screens are not blocked.

## Consequences

- The shell's initial JS grows by about 4.6 KB gzip (the runtime, the shell's English catalog and
  the bindings); the pseudo-locale chunk (7.5 KB gzip) loads only when asked for.
- Extraction is incremental: the shell, sign-in, Profile and the frame's labels now; Settings'
  other pages, modules, the setup wizard, the palette, empty states and server notification and
  digest emails next, each in its own pull request that adds its files to the lint lists.
- `docs/i18n.md` is the contributor guide: adding a string, adding a namespace, adding a locale.
- Words built from labels another owner provides (a module's "New issue" from its manifest's
  label) translate only as well as that label; manifests move to message ids with their module.
- Strings drawn inside `@bemmoly/ui` itself (a Kbd's spoken key names, "Never" for an empty
  relative time) are still English; the kit will take them as props or from a small strings
  context when its components are extracted.
