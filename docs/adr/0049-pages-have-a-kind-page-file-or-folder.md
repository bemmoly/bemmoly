# ADR 0049: Pages have a kind: page, file or folder

- Status: accepted
- Date: 2026-10-24
- Changes: the Docs `pages` table and page contracts (`modules/docs/shared/pages.ts`); adds the
  file page and the folder to the design system (`components-work-docs.md`); builds on ADR 0047
- Evidence: Upload HTML or PDF (a page whose whole body is one file block, drawn in a 360px box
  inside the 700px column); people asking for folders to group pages; the import plan, which
  already makes body-less pages for directories without an index file

## Context

Since ADR 0047 an uploaded HTML report or PDF becomes a page whose body is one File block. It
is drawn like any block: a 360px box in the writing column, one click from full screen. For a
page that *is* the file, that wastes most of the screen and makes the report look like an
attachment to an empty document.

Docs also has no folders. A page with children acts as one, but it still opens as an empty
document with a title and a caret, and nothing in the tree tells a grouping apart from a page
someone forgot to write.

Two ways were weighed for the file page:

- **Work it out from the body**: a page whose body is exactly one file block is drawn full
  bleed. No schema change, but typing one line under the file would flip the whole screen
  back, and the same rule cannot express a folder.
- **Store what the page is.** One column says how the page is drawn and what its body may
  hold, set when the page is made and changed only on purpose.

## Decision

1. **`pages.kind` is `page`, `file` or `folder`**, `NOT NULL DEFAULT 'page'` with a check
   constraint (changeset `0022-docs-page-kind`). Existing pages whose body is exactly one PDF
   or HTML file block become `file`; every other page stays `page`. The previous minor reads
   and writes pages as before, since it never names the column.
2. **A file page is drawn full bleed.** Under the one header, the file fills the rest of the
   screen in the same sandboxed frame as the File block (ADR 0047), with the file bar kept
   above it so a form inside never passes for the app. There is no writing column, title
   block, outline or comments margin. Its body may hold only its one file: Replace file swaps
   it, and Turn into a page sets the kind back to `page` so the block becomes ordinary content.
3. **A folder has no body.** It is created without a snapshot or template and opens as a list
   of its children. Turn into a page is always allowed; Turn into a folder only while the
   page's body is empty, so no writing is ever hidden. A file page can be turned into a page,
   and a page into a file page only while its body is exactly one file.
4. **Everything else treats kinds alike.** Folders and file pages nest, move, star, trash and
   restore like pages, and any kind may hold children. Search matches a folder by its title.
5. **Import and export follow.** A directory without an index file imports as a folder; a
   folder exports as a directory with no file of its own.
6. **Agents see the kind.** Page summaries carry it, and the authoring tool takes `kind` to
   create a folder; agents still nest pages under any parent.

## Consequences

- Page summaries and details carry `kind`; the tree draws a folder icon for folders and a file
  icon for file pages that have no icon of their own.
- `PATCH /api/v1/docs/pages/:pageId` takes `kind`, refused with a validation error when the
  body does not allow the change.
- The design system gains the `folder` and `file-page` icons, the file page and the folder view.

## Alternatives

- **A separate folders table.** Folders would need their own tree, moves, trash and links, all
  of which pages already have. A kind on the page reuses all of it.
- **Full bleed as a page setting** (a "wide" toggle). It would apply to written pages too and
  still leave the file page's title, outline and margin around the file.
