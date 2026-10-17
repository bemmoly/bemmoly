# ADR 0037: Pipelines is a separate product with its own shell

- Status: accepted
- Date: 2026-10-16
- Amends: [ADR 0016](0016-design-system-is-canonical.md) for the frame only (the one-frame
  rule holds for Bemmoly's product; Pipelines has its own)
- Design: [Pipelines product design](../proposals/pipelines/product-design.html) ("The shell"),
  [architecture §3](../proposals/pipelines/architecture.html), and
  [docs/design/pipelines](../design/pipelines/README.md)

## Context

Bemmoly Pipelines ships every application in an organisation from commit to production. Its
people (product engineers, release managers, on-call, platform engineers) scan a lot of live
information beside an editor and a terminal, and many of them never use Work or Docs. Putting
Pipelines into Bemmoly's sidebar would show it to everyone with Work access and give a
release map and a run log the frame of an issue tracker. The owner decided Pipelines is a
separate product: same repository, same kernel (identity, single sign-on, SCIM, teams, audit,
settings, storage), its own web app and shell. Three things follow that the design system and
the kernel did not yet say: how a kernel module stays out of Bemmoly's frame, where the second
web app lives and how it signs people in, and what its frame is.

## Decision

1. **A module can have a product surface.** `defineModule({ surface: 'product' })` loads the
   module's routes, capabilities, settings and grants as usual; its manifest says
   `surface: 'product'`, and Bemmoly's shell never draws it (`inSidebarOrder` and the
   navigation entries skip it). Pipelines' module contributes no sidebar, navigation, Home or
   create entries. Its module grant is "who may use Pipelines"; inside, role bindings at a
   catalog scope and policies decide (architecture §10). Settings › Modules still lists it,
   because that is where an admin turns it on and says who may use it.
2. **Pipelines' web app is `apps/pipelines-web`, served on the same origin under
   `/pipelines`.** The server serves its build next to Bemmoly's (`config/web.ts`), with
   client routes falling back to its own `index.html`. Same origin means the kernel's session
   cookie, CSRF origin check and single sign-on callbacks work unchanged: a signed-out person
   goes to Bemmoly's `/login?redirect=/pipelines/…`, and sign-in hands back with a full page
   load. In development the Bemmoly dev server proxies `/pipelines` to Pipelines' own dev
   server (port 5601), so both share one origin there too.
3. **A host of its own (`pipelines.acme.dev`) is a later, additive step**: a reverse proxy
   rewriting the host onto `/pipelines` works today; a separate host with its own cookie needs
   a parent-domain session cookie or OIDC between the hosts, and gets its own ADR then.
4. **The frame is `PipelinesShell`**: a 72px rail with seven places (For you, Map, Catalog,
   Runs, Releases, Insights, Platform; Settings and the person at its foot), each an 18px icon
   over an 11px label; a 48px top bar with the scope switcher (organisation › domain › group,
   searchable at each level), search opening a Mod+K palette, the live counter, notifications
   and help; one scrolling content area. Scope lives in the URL (`?scope=commerce/checkout`)
   and survives moving between scoped screens.
5. **On a phone (below 768px) the rail becomes a bottom bar** with For you, Map, Catalog and
   Runs, and More for Releases, Insights, Platform and Settings. The top bar keeps the scope
   (domain level), turns search into an icon and shows only the running count.
6. **Dark by default.** Light is one key away (T) and in the person menu. The choice is kept
   for the person on the device (`usePreference('pipelines.mode')`), apart from Bemmoly's own
   mode, so choosing light in Pipelines never changes Work and Docs. The workspace theme's
   accent is not applied yet; Pipelines draws the Bemmoly theme in both modes.
7. **Every foundation holds**: tokens only, the type scale, radii, elevation, motion, the
   drawn icon set (two icons added: `map`, `play`), the glyph ban, content rules, AI lilac only
   for AI, accessibility, i18n catalogs (`pipelines` namespace, every screen extracted from its
   first line). The lint rules that guard them now cover `apps/pipelines-web`.
8. **Map lanes use the existing `drift` animation for moving release dots.** The dots are
   decoration over the cell counts people read, so ADR 0022's "never on anything a person
   reads" holds; under reduced motion they rest at their position.

## Consequences

- People with only Work or Docs never see a Pipelines link, menu item or notification; people
  with only Pipelines land in `/pipelines/` after sign-in and never see Work's frame.
- A product web app may import its own module's contracts (`@bemmoly/module-pipelines/shared`)
  and nothing else of any module; the boundaries lint rule encodes this.
- The image builds and ships both web apps; the server serves Pipelines only when its build is
  present.
- New Pipelines screens follow `docs/design/pipelines/README.md` for the frame and
  `docs/design/system/` for everything else.

## Alternatives considered

- **A section of Bemmoly's sidebar.** Everyone with Work access would see it, and its screens
  would carry a frame built for issues and pages.
- **Its own host and cookie from day one.** Needs a parent-domain cookie or OIDC between hosts,
  changes to the kernel's session and SSO flows, and a second sign-in page, for no gain until a
  customer asks for the separate host; a proxy covers the address today.
- **A separate repository.** Duplicates identity, SSO, SCIM, audit and the design foundations,
  which then drift (architecture §25).
