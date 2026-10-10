---
'@bemmoly/core': minor
'@bemmoly/core-web': minor
'@bemmoly/module-work': minor
---

For module authors and API clients, the kernel gains what let Docs and Work point at each
other without importing each other. `ctx.entities.resolve` finds a record any enabled module
registered, by id or key, filtered to what the person may see; `ctx.entities.resolveMany` does
it for a whole list in one batch, and `EntitySummary` can carry the facts a renderer shows,
such as an issue's status. `EntityDefinition.canView` now receives the request context.
`ctx.links.addReferenceSource` and `ctx.links.referencesTo` answer "what points at this record"
across modules, which is how an issue lists its linked docs. A module that ships
`web/src/entities.tsx` lends a chip, card, table and search for the records it owns, and other
modules' screens draw them through `useEntityRenderer(kind)`, keeping a placeholder while the
owner is off. Work registers its issues, so Docs pages show live issue chips and tables. In the
web kernel, `preloadable` and `useLoaded` load a lazy screen before rendering it, and module
chunks now load that way, so opening a module no longer waits out React's 300 ms Suspense
reveal.

Deprecated: `PATCH /api/v1/docs/pages/:id` still accepts `snapshot` and applies it as one live
edit, but write page bodies through `/collab`; the field is removed in 0.4. No configuration or
schema change.
