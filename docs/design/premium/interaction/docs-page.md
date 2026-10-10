# Docs page: identity and the margin

**Primary job.** Read a document, then change it, with others. There is no edit mode.

**Top actions.** Read and follow links; comment on a passage (select, then Comment or ⌘⌥M);
edit in place, including every property under the title.

## The page column

- A 700px column (780px with its 40px sides; 16px sides on phones). An optional 148px drawn
  cover runs full width above it; the 56px icon tile rises 30px into the cover.
- **Icon.** A drawn icon from the kit in one of the eight entity tints (`epic-1` to `epic-8`),
  stored on the page's existing `icon` field as `name:epic-N`. Emoji stored by older pages
  still draw. The picker is a popover: tints on top (a radio group), a grid of 24 icons (arrow
  keys move through it), Remove icon. Choosing a tint recolours the current icon at once.
- **Cover.** Drawn patterns only for now (tiles, steps, orbit, grid, dots, bands), coloured by
  the icon's tint or the Docs colour, on the sunken surface so they read in light and dark.
  Stored as `pages.cover` (changeset `0016-docs-page-cover`); an id this release does not know
  reads as no cover. Adding, changing or removing a cover happens at once with Undo.
- While a page has no icon or no cover, Add icon and Add cover appear over the title on hover
  and keyboard focus (always on touch).
- **Title.** 36px, edited where it stands. Enter or ↓ at the end hands the caret to the body;
  Escape puts the saved title back.

## One properties row

Status, owner, reviewers, labels, edited and reading time in one row of 28px properties, in
place of the chips above the title and the About panel's form. The About panel is gone.

- Status: the status glyph and its name (draft is to do, in review is in progress, published is
  done, archived is crossed); a menu of the moves the server allows. Request review picks
  reviewers first; Publish and Archive are greyed with "Needs publish rights" for people who may
  not publish.
- Owner: a searchable people popover, with No owner.
- Reviewers: a face pile; a click opens the reviewers dialog (kept: picking several people
  with a filter is a dialog's job).
- Labels: outlined Label pills; the tag button adds one in place with workspace suggestions;
  × removes one with Undo.
- Edited: RelativeTime (absolute date on hover), with who edited last in its tooltip. Reading
  time follows the live document.
- Read-only pages keep the values and lose the hover; nothing is a button.

## One right margin

One margin shows one view at a time, chosen from header toggles with tooltips and shortcuts:

| Toggle | Key | View |
| --- | --- | --- |
| Outline | ⌘⌥O | Sticky outline beside the column, the heading being read marked |
| Comments (count) | ⌘⌥C | Threads, level with their passages when docked |
| Linked work | ⌘⌥L | Issues and pages that link here |
| Version history | ⌘⌥H | The history mode (below) |

- **Docking.** The margin docks inside the page's scroll when the scroller is at least 1104px
  wide (column, sides and the 340px margin); the column moves left so the margin never covers
  text. Below that it opens over the page from the right with a scrim; Escape or the scrim
  closes it. The brief says "below 1280px"; measuring the scroller instead of the window keeps
  the rule true with the sidebar open, collapsed or on a laptop (decision recorded here).
- **Resting outline.** The outline is the margin's resting view where it fits. It opens over a
  narrow page only when someone asks for it, and closes after a jump there.
- **Comment markers.** While comments are closed, each anchored line has a marker in the margin
  (first commenter's face, number of comments). Markers that would overlap stack. A click
  opens comments with that thread in focus. Hidden on phones.
- **Aligned threads.** Docked, open inline threads sit level with their highlighted passages;
  comments on the whole page (and threads whose text is gone) come first under "On the whole
  page". Overlapping cards stack downwards; the focused card keeps its line and the ones before
  it make room. Cards move with transform only. Over the page (narrow screens) they are a list
  in reading order.
- **Keyboard.** ↑↓ or J K walk the threads in reading order, Enter focuses a thread's text,
  R replies, E resolves (or reopens). Resolve happens at once with Undo for about six seconds.

## History is a mode of the page

- Opened from the header toggle, ⌘⌥H or ··· Version history. The body's place shows the diff;
  the live editor stays mounted underneath (hidden), so collaboration never drops.
- A strip under the header: which version against the current one, the change counts as chips
  in the signal colours, J K for the next change, Exit (Esc) and Restore this version.
- The diff reuses `diff-view.tsx` (gutter bars, word marks, folds, now with a drawn chevron).
- The margin is a timeline grouped by day: named, published and restored versions as filled
  dots; runs of autosaves fold into one line that opens. ↑↓ move between versions. Name this
  version saves the page as it is now with a name.
- The default compare is the version before the latest save, the one most likely to show
  changes.
- **Restore** happens at once: the page as it reads now is saved as a version first ("Before
  restoring …"), then the chosen one is restored through the live document, the mode closes
  and a toast offers Undo, which restores that saved version. A failure says so with Retry.
  The restore and compare dialogs are gone. Readers can compare, never name or restore.

## Presence

- Collaborator carets keep their colour; the name over a caret fades after three seconds idle
  and returns when they move or type (awareness changes, through the caret extension's own
  lifecycle; nothing is registered on a live editor).
- Presence faces stay in the header actions; DA owns the header and its placement.

## Share

Share opens a popover, "Who can see this": the space's active members and their roles (org
admins as Workspace admin) from the members endpoint, the honest line that pages have no
permissions of their own, and Copy link. No per-page sharing is invented.

## States

| State | Looks like |
| --- | --- |
| Loading | The stored copy shows first, then the live editor takes over with no shift |
| Empty comments | "No open comments" with how to start one (⌘⌥M) |
| No headings | The outline says headings show there (over the page only) |
| One version | "This is the first version. Changes will show here." |
| History error | Plain words with Retry |
| Read-only | Properties lose hover; the banner says why |
| Trashed | No history toggle; the restore banner leads |
