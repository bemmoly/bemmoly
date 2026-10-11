# ADR 0012: One shared editor package, loaded the first time an editor opens

- Status: accepted
- Date: 2026-10-09
- Tech design: [§15 Docs engine](../tech-design.html#docs),
  [§20 Performance](../tech-design.html#performance), [§4 Modules](../tech-design.html#modules)

## Context

Work stores issue descriptions, document fields and comments as ProseMirror JSON with a
plain-text shadow, so that the Docs module reuses the schema. Until now the Issue page edited
them as plain text. The tech design puts a Tiptap 3 schema in `packages/editor` and says the
editor "loads only on doc routes", written when Docs was the only module expected to edit rich
text. Work now needs the editor on the Issue page and its slide-over, while the shell's initial
JS stays under 250 KB gzip. Work and Docs must not import each other, and the server's content
security policy allows no injected stylesheet.

## Decision

1. `packages/editor` is the one editor, shared by every module. Its schema entry
   (`@bemmoly/editor/schema`) has no React, so the server can read documents with it. Its main
   entry is light: a read-only view, the types, and `RichTextEditor`, a lazy component.
2. Tiptap, ProseMirror and the editor UI are one chunk, fetched the first time an editor mounts
   on any route, or earlier through `preloadEditor()` on a hover or focus that predicts one.
   Pages that only read documents print them with the view and never load the chunk.
3. The view prints each node as the element the schema renders it as, under one class list the
   editor's text uses too, so a document reads the same before and after Edit.
4. Node and mark names stay Tiptap's defaults. Records referenced by key (issues today) are text
   under a `link` mark, not a new node type, so the plain-text shadow reads the key.
5. What an editor can search is passed in by the host module as plain functions: people for
   `@`, and a reference source (key pattern, link target, search) for `#` and typed or pasted
   keys. The kernel's `EditorRegistry` stays the place where modules add nodes and slash
   commands once Docs owns an editor that hosts them.
6. The editor binds Tiptap's core `Editor` to React itself, without `@tiptap/react`, and applies
   ProseMirror's base styles as classes rather than an injected stylesheet.

## Consequences

- The shell's initial JS does not change. The editor chunk is about 134 KB gzip, paid once on
  the first Edit or composer open, then cached.
- Docs in 0.3 starts from a working editor, tool row, suggestions and view; it adds its nodes
  through the registry and collaboration on top.
- An issue reference is a plain link. A live status chip in text is the `issueEmbed` node's job
  when Docs adds it.
- Typed issue keys link when followed by a space or punctuation. Input that arrives as a
  whole string at once (some input methods) leaves the key as text, as typed URLs do.

## Alternatives considered

- **The editor inside `packages/ui`.** Puts ProseMirror beside every component and invites a
  static import into the shell; a package of its own keeps the boundary visible.
- **An issue mention node.** Clearer intent, but a node type the schema lacks, a change to the
  shadow and mention extraction, and a node Docs would have to render without Work.
- **`@tiptap/react`.** Convenient, but the binding is small and the package brings optional
  menu packages that had releases under two weeks old.
