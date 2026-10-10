# Docs: the writing surface

The page body as a place to write: the selection bubble and ⌘K links, block handles and the block
menu, the grouped / menu, code and table tools, the typing fade, and issues inside a page. Source:
the Docs review's Writing, Formatting, Linked work and Docs components tabs
(`docs/design/premium/docs/content.js`, `docs-kit.css` `.d-bub`, `.d-sl`, `.d-handle`, `.d-ich`).
Everything here lives in `packages/editor` unless a path says otherwise; collaboration keeps
working because nothing registers a plugin on a live editor (every extension is made with the
editor, and the React parts read the editor from outside).

## Writing (the body)

**Primary job.** Write without reaching for the mouse.

**Top actions.** Type; insert a block (/ or +); move a block (grip or ⌥⇧↑↓).

**Keyboard.**

| Keys | Does |
| --- | --- |
| / | The block menu, below the caret |
| `##` `-` `[]` ` ``` ` `==text==` | Markdown shortcuts (headings, lists, to-dos, code, highlight) |
| ⌥⇧↑ / ⌥⇧↓ | Move the block (a list item moves inside its list) |
| ⌘D | Duplicate the block |
| Esc | Select the block the caret is in (its handles show); Esc again clears the typing fade |
| ⌘Z | Undo, per person when others are editing (Yjs undo) |

**States.**

| State | Looks like |
| --- | --- |
| No match | "No block called "tbl". Try Table or Heading." |
| Read-only | No handles, no / menu, no bubble (readers cannot comment: decision 4) |
| AI on | An AI group in lilac right after Basic blocks, and Ask AI in the bubble |
| Work off | The From Work group lists only Issue table; issue chips and cards print their key |
| Phone | Handles hidden (no margin to hold them); the bubble scrolls sideways inside the screen |

### The / menu

- Groups in this order: **Basic blocks** (Text, Heading, Subheading, Bulleted, Numbered, To-do,
  Quote), **AI** (only when the host lends AI), **Insert** (Table, Callout, Code block, Decision,
  Image, Divider, Table of contents, Link to page, Mention), **From Work** (Issue, Issue card,
  Issue table from filter; the first two only when an issue search is lent).
- Each row: a 32px tile with the block's icon, the name, a second line, and the Markdown that
  makes the same block as a key cap. The footer teaches ↑↓ ↵ Esc and counts the blocks behind the
  filter. Group labels are sentence case, not capitals.
- **Text** is a row, so any block can turn back into a paragraph from the keyboard.
- Placement: below the caret, as tall as the room under it allows (340px down to 200px), and above
  it only when even 200px does not fit. The viewport is the edge, not the page's scroll box, so a
  short pane no longer flips the menu over the text being read (`DOC_PLACEMENT`).
- Typing filters; a query that matches a group's name lists the group ("ai"). Spaces end the
  query, as before (`/issue card` does not match; `/card` does).

### Block handles

- `+` adds an empty paragraph below and types `/` there, so the menu opens in place.
- The grip drags the block with ProseMirror's own drag and drop (the drop line is the accent, 2px)
  and, on click, opens the block menu: **Turn into** (the eight block types, the current one
  ticked), **Duplicate** (⌘D), **Copy link to block** (headings only: they carry the outline's
  anchors, so the link really lands there), **Delete** (Backspace).
- Delete happens at once with **Undo** in a toast for about six seconds. Undo puts back that block
  alone: an editor undo would also revert the writer's other recent edits under Yjs.
- Handles show for the hovered block and for a selected block, so Esc makes them reachable from
  the keyboard; the hovered block stays put while its menu is open.
- Decision: no "Copy link to block" for paragraphs. Blocks have no stable ids yet, and a link that
  lands on the nearest heading would mislead. Adding block ids is a schema change for later.

## Formatting (the selection bubble)

**Primary job.** Shape text already written.

**Top actions.** Bold, italic, link; turn the block into another type; comment on the selection.

| Keys | Does |
| --- | --- |
| ⌘B ⌘I ⌘E | Bold, italic, code |
| ⌘⇧S | Strikethrough (the schema's own shortcut; the review drew ⌘⇧X, which is not bound) |
| ⌘⇧H | Highlight |
| ⌘K | Link: paste an address, or search pages and issues |
| ⌘⌥0 / ⌘⌥2 / ⌘⌥3 | Text, heading, subheading |
| ⌘⌥M | Comment |
| Alt+F10 | Focus into the bubble; ← → walk it; Esc goes back to the text |

- Order: Turn into ("Text ▾" names the current type), then B, I, S, code, link, highlight, then
  Comment, then **Ask AI** in lilac only when AI is on. Each icon button has a tooltip with its
  shortcut, drawn with the system's key caps (Ctrl words off Apple platforms).
- It sits 8px above the selection, centred on a one-line selection and at the start of a wrapped
  one; below it only when there is no room above. It never covers the line being read.
- Collapsed selection, a selected node (an image, an embed) or a selection inside code: no bubble.
- Mixed formatting: each mark shows the state ProseMirror reports for the selection.
- The comment layer keeps ⌘⌥M and answers the bubble's Comment (an event on the text box),
  so there is one popover, not two (`modules/docs/web/src/comments/comment-bubble.tsx`).

### ⌘K links

- One field: an address, or a search across pages and issues (five of each), with ↑↓ and Enter.
- With words selected: a page or an issue links the words to it. With only a caret: a page drops
  in a page link, an issue drops in an inline issue embed. "Remove link" when the selection is in
  a link. An address that is not web, mail or in-app is refused with a line saying what works.
- Esc or a click away closes it and gives the text its focus back.

### Strike and highlight

- Strike was already in the schema; the bubble and its shortcut make it reachable.
- Highlight is a new mark (`<mark>`), one flat tint with no colour choice, so it never reads as a
  comment anchor (those carry an underline). Old documents load unchanged; exports write `<mark>`
  in HTML and `==text==` in Markdown.

## Code and tables

- Each code block shows its language and Copy in its top right corner. Writers pick the language
  from the schema's list (it recolours at once); readers see the name and can still copy. Copy
  confirms with "Copied" for 1.5s.
- Table tools are icon buttons with tooltips (add row below, add column right, header row; delete
  row, delete column, delete table in the danger colour), in one popover row above the table while
  a cell holds the caret.

## The header fades while typing

- `page/screen-context.ts` holds `usePageTyping` (the flag) and `FADE_WHILE_TYPING` (the CSS hook);
  `page/use-typing-flag.ts` sets it from writing keys in the body and clears it when the pointer
  travels more than 4px, on Esc, or when the body loses focus. It is mirrored onto `<html>` as
  `data-doc-typing`.
- The hook fades to transparent in 300ms and back in 150ms (instant with reduced motion); focus
  inside a faded part shows it again. Only opacity changes, so nothing jumps.
- The header belongs to the frame stream and the margin to the margin stream; they apply the hook.

## Issues inside a page (Linked work)

**Primary job.** See the work a document drives, and keep both in step.

- **Inline embed** (`modules/work/web/src/entities/issue-chip.tsx`): type tile, key, title and the
  status glyph, on a quiet outlined chip; no capitalised status pills. Hover names the status. An
  issue the reader cannot see, or a deleted one, prints its key struck through with "Not available".
- **Card embed** (new `issueCard` block, `entities/issue-embed-card.tsx`): type, key, title and
  Open on the first line; status, priority, assignee, sprint and epic on the second, live from the
  Issue page's cache. Inserted from the / menu (Issue card), which asks for the issue in place.
  Work off: the key on a quiet card. Editing a field from the card is left for later (it would
  duplicate the issue peek); Open goes to the issue.
- **Linked work** (`modules/docs/web/src/links/backlinks-section.tsx`): In this page (with "2 of 3
  in progress, none done" over a bar in the status colours), Issues that link here, Pages that link
  here. An issue in both lists shows once. Issue rows are Work's own row through the entity
  registry (type, key, title, status glyph, assignee); with Work off a plain row prints from the
  link.

## Not done here

- A formatting toolbar above the phone keyboard (the review's phone state) belongs with the
  phone layout of the Docs screens.
- Changing an issue's status from its embed (Space on an embed) and the card's field menus.
- Block ids, and with them "Copy link to block" for any block.
