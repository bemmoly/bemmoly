# ADR 0013: Module server code reads documents with the editor's schema and converters

- Status: accepted
- Date: 2026-10-10
- Tech design: [§15 Docs engine](../tech-design.html#docs), [§4 Modules](../tech-design.html#modules)

## Context

The tech design puts the document schema in `packages/editor` and says it is "shared by the web
app (editing) and the server (rendering exports, extracting text, resolving embeds)". The
`bemmoly/boundaries` lint rule let a module's `server/` and `shared/` code import only
`@bemmoly/core` and `@bemmoly/shared`, so the Docs module had begun to duplicate the plain-text
extraction in `modules/docs/shared/rich-text.ts`, and the collaboration hook would have had to
duplicate the ProseMirror schema to turn a Yjs document into JSON. ADR 0012 already split the
editor package so that `@bemmoly/editor/schema` and `@bemmoly/editor/convert` have no React and
no DOM.

## Decision

1. A module's server and shared code may import exactly two editor entries:
   `@bemmoly/editor/schema` and `@bemmoly/editor/convert`. Nothing else in `@bemmoly/editor`.
2. The package root, `@bemmoly/editor` (the React editor and view), stays web-only. The rule's
   tests prove that a server or shared file importing the root, statically or with `import()`,
   still fails, and that deep `src/` paths still fail as before.
3. Docs uses those converters for its plain-text shadow, word count and reference graph instead
   of keeping its own copies.

This narrows the rule rather than weakening it: the allow-list grows by two named subpaths that
are already guaranteed server-safe, and every other workspace import a module's server code could
not make before, it still cannot make.

## Consequences

- One implementation of text extraction, word counting and reference collection, shared by the
  editor, the server and exports, so search text and the editor's own count agree.
- `packages/editor/src/schema` and `src/convert` must stay free of React and DOM globals; their
  existing server tests (`schema/server.test.ts`) guard that.
- A third server-safe entry later (an HTML sanitiser, say) is one line in the rule and a note
  here.

## Alternatives considered

- **Allow `@bemmoly/editor` wholesale for module server code.** Simpler, but a server import of
  the root would pull React into the API process and nothing would catch it.
- **Move the schema into `packages/shared`.** Puts Tiptap beside every zod schema and into every
  client of the shared package, including ones that never read a document.
