# Docs: frame and tree

Docs inside the one frame: the space tree in the sidebar, one header, two layouts, errors that
keep the frame, and AI that shows only when it is on. The design source is
`docs/design/premium/docs/` (the Space tree, Page, Docs home, Space overview, Empty and error and
Phone tabs, `docs-tree.js`, `docs-kit.*`).

## Decisions

- **Tree placement: option A.** The current space expands under its row in the sidebar's Docs
  section. No in-page column, no phone "pages" bar, no space switcher: spaces are rows.
- **Only the current space expands.** The current space is the one the address is in: a space's
  overview or trash, or the space of the page on show. Docs home expands none.
- **The space row is current only on its own screens.** On a page, the page's row is the raised
  one and the space row only shows its caret, as a project row does when one of its views is
  open.
- **Up to six spaces are listed**, the current one always among them; Docs home, the last row,
  lists them all. Docs home moved below the spaces, as All projects sits below projects.
- **+ creates in place.** The space row's + and a page row's + make "Untitled" there and open it
  (the create-in-place hook from `create/`, with Undo in its toast). The header's New page on the
  overview does the same.
- **Focus mode takes the whole sidebar,** as the review draws it. The shell lets a module's
  section ask for the sidebar while it needs it (`useSidebarTakeover` in core-web): only the
  brand block, search and New, the section's own rows and the foot stay. Never on the rail.
- **Focus mode is offered always,** from the space's ···, a double-click on its row or F on the
  focused row, rather than only over about 40 rows: a count that small is not a reason to hide a
  way to filter.
- **The filter searches the server.** Big spaces load their tree a level at a time, so a filter
  over the loaded rows would miss most pages. The filter uses the space search, with the page's
  icon and the matching line, and offers Retry when it fails.
- **Open pages and focus are a per-person preference** through the shell's person store
  (`docs.tree-open`, `docs.tree-focus`), so two people sharing a browser keep their own.
- **Row menu:** Add a page inside, Rename (F2), Duplicate, Move to…, Star, Copy link, Open in
  new tab, Move to trash. Move to… is the page's move dialog; Duplicate is described in
  docs-around.md.
- **The body column's measure is 700px** (`page-frame.tsx`, `max-w-195` with 40px gutters).
  `page/body` draws into it.
- **Trash uses the full layout.** Its table has a preview peek beside it at wide sizes, so it
  owns its scroll like an editor; its column stays the 1040px reading width.

## Space tree (sidebar)

- **Job:** know where you are and move pages without leaving the page.
- **Top actions:** open a page; add a page inside another (+); drag to reorder or nest.
- **Keys:** ↑↓ move, → / ← open and close, Enter opens, F2 renames, ⌥↑ ⌥↓ reorder, ⌥→ ⌥← nest
  and un-nest, a letter jumps to the next title starting with it, F on a space row focuses it,
  Esc leaves focus mode, [ folds the sidebar. ⌘-click or ⇧-click opens a page in a new tab.
- **Rows:** 28px, an 18px chevron target, the page's icon (stored emoji or icon name; the doc
  icon otherwise), 14px a level. The open page is a raised card like the sidebar's current row.
  + and ··· show on hover and on keyboard focus; right-click opens the ··· menu.
- **Drag:** the drop line's left edge shows the depth; a pause over a row drops inside it. A
  refused move springs back with a toast naming why. Moves, renames and trashing paint at once.
- **It follows you:** opening a page from a link or search opens its ancestors and scrolls its
  row into view.
- **States:** loading draws four skeleton rows at 28px; an empty space shows one quiet New page
  row with its N hint; a tree that fails to load says "Pages did not load" with Retry; spaces
  that fail say so with Retry; the rail shows each space as its tile and no tree.
- **Phone:** the same tree in the sidebar sheet; going somewhere closes the sheet.

## Focus mode

- "All of Docs (Esc)" at the top, the space's tile and name with its ···, then "Filter N pages"
  with the caret already in it, then the tree flush left. Typing replaces the tree with matches;
  Esc clears the filter, Esc again leaves focus. Focus survives a reload.

## Header

- One header for every Docs screen: no 44px page bar. Trails: Docs home "Docs"; a space "Docs /
  Space"; its trash "Space / Trash"; a page "Space / parents / Page", each with its tile or
  icon and each a link. A page that is missing, refused or failed reads "Docs / Page not found",
  "No access" or "Did not load".
- After a page's trail, its status as a quiet outlined menu: the status glyph and its name
  (draft, in review, published, archived on the issue status family), a caret, the allowed
  moves. Read-only pages show the same mark without the menu.
- Right: save line and the people here, Star, Share (copy link), the panel toggles, About, ···.
  On a phone the labels fold to icons and the trail keeps the page only.

## Layouts

- **contained** (1040px reading column, the layout scrolls): Docs home, a space's overview.
- **full**: a page (its own 700px column, outline rail and side panel), and the trash (table and
  peek).
- Skeletons hold the layout of the screen they stand for, so the frame paints once.

## Errors in the frame

- A missing, refused or failed page, a space that did not open, the home lists, the trash and
  the sidebar's tree and filter all keep the sidebar and the header. Failures say nothing was
  lost and offer Try again (Retry in the sidebar's tight rows); a missing page offers Back to
  Docs.

## AI honesty

- The TL;DR card and a comment's suggested fix with Apply fix render only when the workspace has
  AI on (`workspace.aiEnabled` from the session), in the AI lilac. With AI off a stored summary
  or suggestion stays unshown. Tests cover both surfaces with AI off.
