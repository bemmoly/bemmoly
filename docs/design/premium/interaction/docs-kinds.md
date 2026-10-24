# Docs: file pages and folders

A page's kind (ADR 0049) is `page`, `file` or `folder`. These notes cover the two screens that
are not the editor. Decisions recorded here can be overruled by Keerthi.

## File page

- **Job:** read an uploaded HTML report or PDF as the page itself, at full size.
- **Top actions:**
  1. Read and use the file: it fills everything under the header. Mouse and touch go straight
     into the frame; Tab reaches the bar's Download (HTML) or Open in a new tab (PDF) and Expand.
  2. Expand to full screen: the bar's Expand, or Tab to it and Enter. Escape closes.
  3. Replace file…: ··· › Replace file…, which opens the file picker; the new file shows where
     the old one did.
- **Keyboard:** the global map; nothing of its own. Inside the frame, keys belong to the file.
- **States:**
  - Loading: the page skeleton, then the file loads inside its frame.
  - Empty or broken: a body that no longer holds one file shows "This page has no file to
    show" with how to fix it.
  - Error: as any page (the frame's "This page did not load" with Try again).
  - No permission: the actions show as in the sidebar tree and the server refuses them with a
    toast; the client learns space edit rights only from a live body, which a file page has
    not got. Trashed and archived pages get their banner and a ··· with Copy link only.
  - Phone: the bar and the file, full width; Share folds into ···.
- **URL state:** `/docs/p/:pageId`, the same as any page.
- **Choices recorded:**
  - The file bar stays above the file even full bleed, so a form inside an HTML file never
    passes for the app (ADR 0047).
  - No outline, comments or history: there is no written body to anchor them to. Turn into a
    page brings them back with the file as an ordinary File block.
  - The status menu stays: a report can be drafted, reviewed and published like a page.

## Folder

- **Job:** group pages, and show what is in the group.
- **Top actions:**
  1. Open something inside: click a row, or ↑↓ (J K) and Enter.
  2. New page inside: the New page button or N.
  3. New folder inside: the New folder button, or a tree row's ··· › New folder inside.
- **Creating one:** New folder in the space's ··· or New folder inside on a row's ··· makes
  "New folder" there, opens it and puts its tree row into rename. Enter keeps the name typed,
  Escape keeps "New folder". The toast's Undo takes it back out.
- **Keyboard:**

  | Key | Action |
  | --- | --- |
  | N | New page inside the folder |
  | ↑↓ / J K | Move through the list |
  | ↵ | Open |

- **States:**
  - Loading: four row skeletons in the card.
  - Empty: "This folder is empty" with New page and New folder.
  - Error: "This folder did not load" with Try again.
  - Many items: the list is the tree's level (up to 1000 rows) in one card; the pane scrolls.
  - No permission: as on a file page, the server refuses what the person may not do.
  - Phone: the title row wraps its buttons under the title.
- **URL state:** `/docs/p/:pageId`.
- **Choices recorded:**
  - A folder has no status menu; it is never drafted or reviewed.
  - Turn into a folder is offered only while a page's body is empty, so no writing is ever
    hidden behind a folder. Turning a folder back into a page is always allowed.
  - N inside a folder makes a page inside it, not beside it as on a page: a folder exists to
    hold pages.
