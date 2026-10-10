# Docs: around the page

Create in place, the Docs home, a space's overview, the trash, search, import and export, and
the phone layout of these screens. Decisions recorded here can be overruled by Keerthi.

## Create in place

- **Job:** start a page in the right place in under a second.
- **Top actions:** type a title, pick a template, start blank.
- **How it works:** New page, N, a row's + or the empty space's Blank page make "Untitled" where
  you are and open it with the caret in the title. There is no dialog. The toast says where the
  page went ("Page created in Platform") and offers Undo, which removes the page and takes you
  back.
- **Templates:** the empty page shows the space's templates as tiles under the body, plus
  "Import a file". Arrows move between the tiles and Enter uses one. Typing in the body hides
  them. Using a template replaces the blank page with one made from the template, in the same
  place and with any title already typed, and Back skips the blank page.
- **Abandoned:** a fresh page left with no title and no words is moved to the trash when you
  leave it.
- **Global Create:** the Create menu's New page keeps the dialog, because it has no place to
  start from.

## Docs home

- **Job:** get back to what you were writing, or find what needs you.
- **Layout:** Jump back in (the last four pages), then one list with four lenses beside Needs
  you and Spaces. Contained layout.
- **Keyboard:**

  | Key | Action |
  | --- | --- |
  | N | New page, in place, in the space you last wrote in |
  | 1–4 | Switch between Recent, Starred, My drafts and For review |
  | ↑↓ / J K | Move through the list |
  | ↵ | Open |

- **Decision:** the review's fourth lens, "Shared with me", became **For review** (the review
  requests asked of you). Pages have no per-person sharing, and inventing it would break the
  "honest Share" decision.
- **States:** the skeleton keeps the final grid. Each card errors on its own and has Retry.
  Needs you isn't drawn while nothing waits. With no spaces, the first-run guide shows instead.
  On a phone, Import and Templates leave the header and New page stays.

## Space overview

- **Job:** understand a space and find the right page in it.
- **Layout:**
  - The header: the space's tile, name and description, its members' faces, Import and New
    page (N).
  - Start here: the home page and its first lines. "Change" (or "Pin a page") is offered to
    those who may configure the space. Until a page is pinned, the first top-level page stands
    in.
  - In review: pages waiting on a reviewer, and a count of pages untouched for 90 days.
  - The top-level pages as cards, then Recently updated (who edited what).
- **Empty:** "Write the first page in Research" with three answers: Blank page (N, focused, so
  Enter takes it), From a template, Import. A reader is told they can't add pages.

## Trash

- **Job:** get back something deleted by mistake.
- **What it shows:** a table of each page, where it was, who deleted it and when, and how many
  pages went with it. A search box sits above it (/). A row opens a read-only peek: docked at
  1180px and wider, over the page below that.
- **Actions:**
  - Restore happens at once, and its toast offers Open.
  - Delete forever (in the row's ··· menu or the peek) asks for "delete" to be typed.
  - Empty trash asks for the space key to be typed.
- **Keyboard:** ↑↓ / J K move, ↵ previews, R restores, ⌘⌫ deletes forever (it asks first).
- **Permission:** only space admins and workspace admins see Delete forever and Empty trash.
  The server checks `docs.space.configure`.
- **Retention:** pages are kept 30 days. The `docs.purge-trash` job runs nightly at 03:17 UTC.
  It is a singleton schedule, so each cron tick runs once, and a repeated run finds nothing
  left to delete.
- **Routes:**
  - `DELETE /api/v1/docs/spaces/:spaceKey/trash/:pageId` returns 204.
  - `DELETE /api/v1/docs/spaces/:spaceKey/trash` returns `{ deleted }`.

## Search (⌘K)

- **Pages:** each page shows its icon, its title with the match marked, its place ("Engineering
  › Platform") and the matching line. Only issues print a key.
- **Scope:** inside a space, search starts "In Engineering". Backspace in the empty field, or
  the chip's ×, widens it to everything. A module screen marks the place with
  `data-search-place`, `data-search-place-label` and `data-search-place-kind`, so the shell knows
  nothing about spaces. The filter applies only to results of that kind. It filters on the
  client and asks the server for 24 results, so the place's own results still fill the list.

## Import and export

- **Import:**
  - "Put the pages under" picks the top of the space or any page the tree shows.
  - Markdown and Confluence export are offered as tiles. HTML import isn't added (decision 6).
  - A small import lists what each file became, including any macros kept as placeholders,
    then offers Open pages.
  - A big import closes with a toast and keeps going. The tree fills in over realtime. There is
    no import notification kind in the kernel, so the Inbox isn't used.
  - On failure, the picked files stay and the message says to try again.
- **Export…:** offers Markdown, HTML or PDF, plus "Include the pages under it" for those with
  the export right (not for PDF). PDF prints what is on screen through the browser's Save as
  PDF: the same self-contained HTML as the HTML export, with print rules (no blocks split across
  pages). If the export can't start, a toast says so.

## Phone

- The tree lives in the sidebar sheet, and the header is a single bar (both from the frame
  stream).
- Comments open as a sheet; that belongs to the margin stream.
- On these screens, secondary header actions are hidden, the trash table drops its "Was in" and
  "Deleted by" columns, and rows keep Restore visible.
