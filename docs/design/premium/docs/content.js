/* ───────── Docs: what is wrong, where, and what changes. Pins are in 1440×900 (or 390×844) frame pixels. ───────── */
/* sev: 3 = breaks trust, 2 = feels cheap, 1 = polish. ix = interaction notes for the proposed screen. */
const SCREENS = [
  {
    id: 'overview',
    label: 'Overview',
    verdict:
      'Docs has the best engine in Bemmoly and the weakest surface. Under the hood it is excellent: live collaboration that never loses a keystroke, an in-place diff, a real accessible tree, skeletons everywhere. On screen it is a second product: its own sidebar inside a page that has none, a third navigation bar above the document, typed characters for icons, pills that shout, an editor with no way to bold a word or add a link from the page, and AI promises shown while AI is off. The fix is mostly moving and redrawing, not rebuilding.',
    cur: { kind: 'sheet' },
    pro: { kind: 'sheet' },
    curNotes: [
      [3, 'A second app inside the app', 'Docs home has no sidebar; a space adds a 260px tree inside the page; the page adds a 44px bar under the 48px top bar. Moving from Board to a doc changes the navigation model, the widths and the header twice.'],
      [3, 'The editor can’t format', 'No selection toolbar, no block handles, no “+” in the margin and no way to add a link in the body. The only thing a selection offers is Comment. Formatting exists only as unlisted shortcuts.'],
      [3, 'AI shows while AI is off', 'A suggested fix with “Apply fix” renders on comments and a TL;DR card claims it “updates with the doc”, without reading the AI setting. The AI colour is the accent.'],
      [2, 'Typed characters and shouting pills', 'Issue embeds and page status are upper-case pills; palette rows are ▮; compare uses → and ⋯; table tools are “+ Row” and “− Column”; every add link is a typed “+”.'],
      [2, 'Colours borrowed from signals', 'Space tiles hash into status and danger colours (Product is red). In-review amber is the warning colour and the comment colour.'],
      [2, 'Comments and history are hidden', 'Comments have no header entry or count; history is the third item of a ··· menu; compare is a modal that hides the page.'],
      [1, 'The page has no face', 'No icon or cover picker although the API stores icons; every page in the tree, lists and search looks the same.'],
    ],
    proNotes: [
      ['One frame, one sidebar', 'Docs draws into the same 240px sidebar as Work. Spaces are rows like projects; the current space expands to its page tree, with drag, hover add and more, and focus mode for big spaces.'],
      ['A page that reads like a document', 'A 700px column, an optional cover and icon, the title, one row of editable properties, the outline in the right margin and comment markers beside the text they belong to.'],
      ['A writing surface', 'A grouped slash menu with icons and shortcuts, a selection bubble (Text, bold, italic, strike, code, link, highlight, Comment), block handles, a code language picker. The header fades while you type.'],
      ['Collaboration in the margin', 'Faces in the header, named carets in the text, comment threads aligned with their anchors, history as a mode of the page with Restore and Undo.'],
      ['Docs and Work as one product', 'Issues embed with the new type tiles and status glyphs; Linked work shows both directions; search shows pages with their icon, place and the matching line.'],
      ['AI in lilac, only when on', 'Summary block, Ask AI in the bubble, an AI group in the slash menu, suggested fixes in comments. With AI off none of them render.'],
    ],
  },
  {
    id: 'home',
    label: 'Docs home',
    cur: {
      img: 'd-home',
      pins: [
        [60, 520, 3, 'No sidebar here, a different one inside a space', 'Docs home is a page with no navigation of its own. Open a space and a 260px space sidebar appears; open Board and both are gone.'],
        [128, 56, 2, 'Work’s views in the global bar', 'Board and Backlog sit beside Docs and Teams in the top bar, so a writer sees issue views on every page.'],
        [1029, 128, 2, 'Two buttons, one dialog', 'Templates and New page open the same dialog. Create space sits between them as a third style of button.'],
        [531, 259, 2, 'Space tiles in signal colours', 'Initials on colours hashed from the status and danger palette: Product is the danger red, Engineering and Handbook share a green.'],
        [700, 470, 1, 'A 3 + 1 grid', 'Four spaces in a three-column grid leave one card alone on a row, with half the width empty.'],
        [150, 670, 1, 'Every row has the same icon', 'Recent, Starred and Drafts show the same doc icon; status, the thing you’d scan for, isn’t shown.'],
        [1150, 569, 1, 'Templates as plain buttons', 'Six bordered labels with no icon, description or preview, in a card beside a list.'],
      ],
    },
    pro: {
      render: () => screenDocsHome(),
      pins: [
        [140, 520, 'Docs in the one sidebar', 'The same sidebar as Work. Docs is a section with its spaces; Docs home is its last row, as All projects is for Work.'],
        [1060, 26, 'One primary, named actions', 'New page (N) is the primary; Templates and Import are secondary and say what they do.'],
        [700, 128, 'A subtitle that says something', '“1 page waiting for your review”, not a count of pages.'],
        [1000, 168, 'Jump back in', 'The last four pages you touched, with their icons, space and who edited them. Starred pages show the star.'],
        [800, 330, 'One list, four lenses', 'Recent, Starred, My drafts and Shared with me, as one segmented list with status glyphs and the space.'],
        [1370, 330, 'Needs you', 'Review requests, mentions and stale pages you own. Each opens the page at the right place.'],
        [1370, 560, 'Spaces as a list', 'Tile, name, description, page count and members. New space sits in the card header.'],
      ],
    },
    ix: {
      job: 'Get back to what you were writing, or find what needs you.',
      actions: ['Open a recent page', 'Create a page (N), defaulting to the last space you wrote in', 'Answer a review request'],
      keys: [['N', 'New page'], ['↑↓ / J K', 'Move through the list'], ['↵', 'Open'], ['S', 'Star or unstar the focused row'], ['1–4', 'Switch Recent, Starred, Drafts, Shared']],
      states: [['Loading', 'Skeleton cards and rows at final height'], ['Empty', 'No spaces yet: one card, “Create the first space”, with a template row'], ['Error', 'Each card errors on its own with Retry; the rest stay usable'], ['No permission', 'Spaces you can’t open aren’t listed; pages shared with you still are']],
    },
  },
  {
    id: 'space',
    label: 'Space overview',
    cur: {
      img: 'd-space',
      pins: [
        [130, 520, 3, 'A sidebar only Docs has', 'The space tree is a 260px column inside the page, under the app’s top bar. Work has no sidebar at all, so the two modules don’t share a navigation model.'],
        [180, 113, 2, 'A second switcher', 'The space name is a switcher with its own menu, while projects are switched elsewhere. Workspaces, projects and spaces each switch differently.'],
        [700, 280, 2, 'An overview with nothing to overview', 'Two rows of top-level pages with “Published · has subpages”. No description of the space, no home page, no activity, no members.'],
        [850, 620, 2, 'A 900px island', 'The column is centred on grey with no relation to the page width, the home width (1120) or the tree.'],
        [22, 172, 1, '10px chevrons', 'The expand target is 9px wide, and pages with an icon name show no icon in the tree.'],
        [110, 880, 1, 'A footer of text links', '“+ New page” with a typed plus, then Import and Trash as quiet text.'],
      ],
    },
    pro: {
      render: () => screenSpace(),
      pins: [
        [215, 355, 'The space in the sidebar', 'The space row is active; its top-level pages show below it, with + and ··· on the hovered row. Trash moves to the sidebar foot, beside Settings.'],
        [1050, 26, 'Space actions in the header', 'Space settings, Import and New page, in the same place as a project’s actions.'],
        [780, 110, 'Who and what', 'Tile, name, description, owning team and members.'],
        [560, 200, 'Start here', 'The space’s home page, pinned, with its first lines and the pages it points to. Change sets another.'],
        [1370, 210, 'In review and stale', 'Pages waiting on a reviewer, and pages nobody has touched for 90 days.'],
        [840, 398, 'Top-level pages as cards', 'Icon, title, page count and a line about each; a list view for big spaces.'],
        [700, 650, 'Recently updated', 'Who changed what, with status glyphs.'],
      ],
    },
    ix: {
      job: 'Understand a space and find the right page in it.',
      actions: ['Open the home page', 'Create a page in this space', 'Review what is waiting'],
      keys: [['N', 'New page in this space'], ['G then H', 'Go to the space home page'], ['F', 'Focus the sidebar on this space'], ['↑↓ ↵', 'Move and open']],
      states: [['Loading', 'Header, cards and rows as skeletons'], ['Empty', 'See the Empty and error tab'], ['Many pages', 'Cards switch to a list; the sidebar offers focus mode'], ['No permission', 'Read-only members see no New page; settings are hidden']],
    },
  },
  {
    id: 'tree',
    label: 'Space tree',
    tall: true,
    verdict:
      'Recommended: the tree lives in the app sidebar’s Docs section and expands under the current space, with drag, hover add and more, and a focus mode for big spaces. A second column (today’s model) costs 480px of chrome and makes Docs a different product again.',
    cur: {
      img: 'd-tree-menu',
      pins: [
        [130, 560, 3, 'The tree is page content', 'It is drawn by the space screens, not the app shell: it vanishes on Docs home, Board and settings, and it can’t be collapsed or resized.'],
        [22, 172, 2, 'Hard to hit', 'A 10px chevron with a 9px target opens and closes pages.'],
        [150, 224, 1, 'No page icons', 'The tree hides icon names that lists and search show.'],
        [380, 335, 1, 'A thin menu', 'Add inside, Rename, Star, Copy link (with an external-link arrow) and Move to trash. No Duplicate, Move to… or Open in new tab.'],
        [180, 113, 2, 'Its own switcher', 'The space header is a switcher, so the space list lives in a menu rather than in navigation.'],
      ],
    },
    pro: { render: () => treePlacement(), pins: [] },
    proNotes: [
      ['A. In the sidebar’s Docs section (chosen)', 'Spaces are rows like projects; the current one expands to its tree. Drag reorders and nests, + and ··· appear on hover and focus, right-click opens the same menu.'],
      ['Why not a second column', 'Two 240px columns leave 960px at 1440, and less on a laptop. It also brings back the “Docs is another product” feeling the frame removes.'],
      ['Big spaces: focus mode', 'Double-click a space (or F) to give it the whole sidebar with a filter; Esc returns. Sections collapse and remember per person; the width drags from 240 to 360px.'],
      ['It follows you', 'Opening a page from search or a link reveals and scrolls to its row. The 56px rail shows spaces as tiles.'],
    ],
    ix: {
      job: 'Know where you are and move pages around without leaving the page.',
      actions: ['Open a page', 'Add a page inside another (+)', 'Drag to reorder or nest'],
      keys: [['↑↓', 'Move'], ['→ / ←', 'Open / close'], ['↵', 'Open the page'], ['F2', 'Rename'], ['⌥↑ ⌥↓', 'Reorder'], ['⌥→ ⌥←', 'Nest / un-nest'], ['F', 'Focus mode'], ['[', 'Collapse the sidebar']],
      states: [['Loading', 'Rows as skeleton lines at 28px'], ['Empty space', 'One quiet “New page” row'], ['Refused drop', 'The row springs back and a toast says why'], ['No permission', 'No + and no drag; the menu offers Copy link only']],
    },
  },
  {
    id: 'page',
    label: 'Page',
    cur: {
      img: 'd-page',
      pins: [
        [900, 102, 3, 'Three bars before the first word', 'The demo banner, the 48px app bar with Work’s views and a 44px page bar stack up. The page bar repeats the space name the sidebar already shows.'],
        [725, 102, 2, 'A status that shouts', '“IN REVIEW” in caps on amber, the warning colour, with no caret to say it’s a menu.'],
        [345, 160, 2, 'Properties as grey chips', '“rfc”, “Owner: Aisha K.”, “Reviewers: Jonas M.” sit above the title as labels, and again in the About panel as a form.'],
        [855, 547, 2, 'Issue embeds without a title', 'A coloured square, the key in mono and a caps status. A reader can’t tell what PLT-204 is without hovering.'],
        [620, 655, 2, 'Anchors with no marker', 'Comment highlights are amber text with nothing in the margin; the threads are a tab away.'],
        [1400, 400, 2, 'A form beside the document', 'The About panel opens by default at 340px with a field grid; the outline sits under it, below the fold on a laptop.'],
        [1290, 124, 1, '“Share” copies a link', 'It looks like a sharing dialog and only copies the URL.'],
        [330, 238, 1, 'No face', 'No icon or cover; the title is the only thing that tells pages apart.'],
      ],
    },
    pro: {
      render: () => screenDocPage(),
      pins: [
        [225, 442, 'The tree is the sidebar', 'Engineering is expanded to the open page, which is highlighted; Work stays one row above.'],
        [845, 26, 'One header', 'Space › parent › page with icons, and the page status as a menu with its glyph. No second bar.'],
        [960, 26, 'Presence and the rails', 'Who is here, then Comments with its count, Version history, Star, Share and more. Each toggles the right margin.'],
        [700, 100, 'Cover and icon', 'Optional. The icon is a drawn icon in one of eight tints; the cover can be an upload or one of the drawn patterns.'],
        [1150, 305, 'Properties in one row', 'Status, owner, reviewers, labels, edited, reading time. Each is editable in place; Add property on hover.'],
        [1130, 520, 'Issues read as issues', 'Type tile, key, title and status glyph, live from Work.'],
        [1262, 690, 'Comments in the margin', 'A marker beside each anchored line shows who and how many; clicking it opens the thread beside the text.'],
        [1360, 250, 'The outline in the margin', 'Sticky, following the scroll, with the active heading marked.'],
        [705, 676, 'Live carets', 'Jonas’s caret and name, in his colour. Names fade after three seconds idle.'],
      ],
    },
    ix: {
      job: 'Read a document, then change it, with others.',
      actions: ['Read and follow links', 'Comment on a passage', 'Edit in place (there is no edit mode)'],
      keys: [['⌘⌥C', 'Comments rail'], ['⌘⌥H', 'Version history'], ['⌘⌥O', 'Outline'], ['S', 'Star'], ['⌘L', 'Copy link'], ['⌘/', 'All editor shortcuts'], ['[', 'Sidebar']],
      states: [['Loading', 'The stored copy shows first, then the live editor takes over with no shift (today’s behaviour, kept)'], ['Offline', 'A quiet amber line under the header: “Offline · your changes are kept”'], ['Read-only', 'The properties row loses hover; a line says why (viewer, archived, in the trash) with the one action that applies'], ['Not found', 'In the frame, with the space still in the sidebar and a way back']],
    },
  },
  {
    id: 'slash',
    label: 'Writing',
    cur: {
      img: 'd-slash',
      pins: [
        [660, 336, 2, 'A list of words', 'No icons, descriptions or shortcuts; the active row is the only colour.'],
        [660, 440, 2, 'An odd order', '“Issue table from filter” first; seventeen blocks in one group; no plain Text to turn a block back into a paragraph.'],
        [600, 286, 1, 'It covers what you’re reading', 'The menu opened upward over the list above the caret.'],
        [335, 637, 2, 'Nothing in the margin', 'No + to add a block and no handle to move one; “/” is the only way in, and nothing on the page says so.'],
        [1300, 760, 1, 'Nothing gets out of the way', 'While typing, the top bar, page bar and About panel all stay at full strength.'],
      ],
    },
    pro: {
      render: () => screenSlash(),
      pins: [
        [900, 26, 'The header fades while you type', 'It returns when the pointer moves or you press Esc. The sidebar stays; nothing jumps.'],
        [452, 288, 'Handles in the margin', '+ inserts a block below; the grip drags the block and opens its menu (Turn into, Duplicate, Copy link to block, Delete).'],
        [880, 450, 'A grouped menu', 'Basic blocks first, then Insert, then From Work. Each row has an icon, a description and its markdown shortcut.'],
        [880, 816, 'Teaches the keyboard', 'A footer with the keys, and the count of blocks behind the filter.'],
        [1150, 199, 'Others keep writing', 'Jonas’s caret stays visible in his colour while you work elsewhere.'],
      ],
    },
    ix: {
      job: 'Write without reaching for the mouse.',
      actions: ['Type', 'Insert a block (/ or +)', 'Move a block (grip or ⌥⇧↑↓)'],
      keys: [['/', 'Block menu'], ['## / - / [] / ```', 'Markdown shortcuts'], ['⌥⇧↑↓', 'Move block'], ['⌘D', 'Duplicate block'], ['Esc', 'Select the block; Esc again shows the header'], ['⌘Z', 'Undo, per person when others are editing']],
      states: [['No match', '“No block called “tbl”. Try Table.”'], ['Read-only', 'No handles and no menu'], ['AI on', 'An AI group in lilac after Basic blocks'], ['Phone', 'A toolbar above the keyboard with + and the formatting marks']],
    },
  },
  {
    id: 'format',
    label: 'Formatting',
    cur: {
      img: 'd-bubble',
      pins: [
        [318, 500, 3, 'Select text, get one button', 'The only selection tool is “Comment”. Bold, italic, links and headings exist only as shortcuts nobody is shown.'],
        [452, 527, 1, 'Shortcuts drawn as characters', '⌘⌥M is typed into a key cap; on Windows and Linux it shows the Mac symbols.'],
        [338, 548, 2, 'No block handles', 'Blocks can’t be dragged, duplicated or turned into another type from the page.'],
        [948, 548, 2, 'No way to add a link', 'The body has no ⌘K and no link field; links come only from pasting a URL.'],
      ],
    },
    pro: {
      render: () => screenFormat(),
      pins: [
        [412, 158, 'A selection bubble', 'Turn into, bold, italic, strike, code, link, highlight, and Comment, each with a tooltip and its shortcut. It sits above the selection, never over the line.'],
        [925, 158, 'Ask AI, in lilac, only when AI is on', 'With AI off the bubble ends at Comment.'],
        [452, 228, 'Block handles', '+ and the grip on the hovered block, on keyboard focus too.'],
        [640, 320, 'Code with a language', 'The language picker the schema already lists, plus Copy.'],
      ],
    },
    ix: {
      job: 'Shape text you have already written.',
      actions: ['Bold, italic, link', 'Turn a block into another type', 'Comment on the selection'],
      keys: [['⌘B ⌘I ⌘E', 'Bold, italic, code'], ['⌘K', 'Link (search pages and issues, or paste a URL)'], ['⌘⇧H', 'Highlight'], ['⌘⌥0–3', 'Text, heading, subheading'], ['⌘⌥M', 'Comment']],
      states: [['Collapsed selection', 'No bubble'], ['Mixed formatting', 'The bubble shows the state of the first character'], ['Read-only', 'Only Comment and Copy link to selection']],
    },
  },
  {
    id: 'comments',
    label: 'Comments',
    cur: {
      img: 'd-comments',
      pins: [
        [1268, 165, 2, 'A tab, not a place', 'Comments are the second tab of the About panel; the header has no button or count.'],
        [1425, 270, 2, 'Quotes instead of alignment', 'Each card repeats the quoted text; the thread and its passage can be a screen apart.'],
        [1425, 560, 3, 'An AI fix while AI is off', '“Apply fix” on a suggestion, shown without checking the AI setting, in the accent colour.'],
        [1330, 210, 1, 'A typed plus', '“+ Comment” for a page comment.'],
        [1105, 245, 1, 'Pale avatars', '20px pastel initials, low contrast, the only anchor in each card.'],
      ],
    },
    pro: {
      render: () => screenComments(),
      pins: [
        [940, 26, 'Comments in the header, with a count', '⌘⌥C opens the rail. The page column moves left so the rail never covers text.'],
        [1356, 74, 'Open and resolved', 'A segmented filter and a people filter; resolved threads stay one click away.'],
        [1070, 556, 'Threads beside their anchors', 'Each thread sits level with its highlighted passage; the active one is outlined in the comment amber.'],
        [1340, 616, 'Turn a comment into work', '“Create issue” makes an issue from the thread, links it, and resolves the comment with a note.'],
        [1424, 760, 'Reply in place', 'Mentions, ⌘↵ to send; reactions and resolve are icons with tooltips.'],
        [1424, 126, 'Page comments on top', 'Comments on the whole page sit above the anchored threads, labelled.'],
      ],
    },
    ix: {
      job: 'Discuss a passage and close the loop.',
      actions: ['Comment on a selection (⌘⌥M)', 'Reply', 'Resolve, or turn into an issue'],
      keys: [['⌘⌥M', 'Comment on the selection'], ['⌘⌥C', 'Open or close the rail'], ['J K', 'Next or previous thread'], ['R', 'Reply'], ['E', 'Resolve (with Undo)'], ['⌘↵', 'Send']],
      states: [['None', '“No comments. Select text and press ⌘⌥M.”'], ['Anchor deleted', 'The thread moves to the end, marked “Text removed”, with the old quote'], ['Resolve', 'Happens at once with Undo for 6s'], ['Viewer', 'Can read; commenting follows a space permission, not edit rights']],
    },
  },
  {
    id: 'history',
    label: 'History',
    cur: {
      img: 'd-compare',
      pins: [
        [1430, 146, 2, 'Behind a menu', 'Version history is the third item in ··· and opens as a fourth panel tab.'],
        [720, 600, 2, 'A modal over the page', 'Compare hides the page and the history list behind a dialog that is mostly empty.'],
        [719, 170, 1, 'A typed arrow', 'The two version pickers are joined by “→”; folds use “⋯”.'],
        [1040, 800, 2, 'Restore asks first', 'Restoring is reversible (it saves a new version) but still needs a confirmation dialog.'],
        [1415, 300, 1, 'Three tag colours for kinds', 'Published, Saved and Autosave each get a coloured tag; autosaves are listed one by one.'],
      ],
    },
    pro: {
      render: () => screenHistory(),
      pins: [
        [790, 26, 'History is a mode of the page', 'The page stays where it is; the header says Version history, with Exit (Esc) and Restore.'],
        [828, 75, 'What you are comparing', 'Two pickers, the change counts in signal colours, Show changes, and J / K to step through changes.'],
        [310, 393, 'The diff in place', 'Today’s excellent diff engine, kept: gutter bars, word-level marks, folded unchanged blocks.'],
        [1405, 312, 'A timeline, not a list', 'Grouped by day; named versions are filled dots; autosaves fold into one line.'],
        [980, 26, 'Restore with Undo', 'Restore happens at once, is saved as a new version, and a toast offers Undo. Copy as new page is the safe alternative.'],
      ],
    },
    ix: {
      job: 'See what changed and get back to a good version.',
      actions: ['Pick a version', 'Step through changes', 'Restore (or copy as a new page)'],
      keys: [['⌘⌥H', 'Enter or leave history'], ['↑↓', 'Move between versions'], ['J K', 'Next or previous change'], ['⌘S', 'Name this version'], ['Esc', 'Exit']],
      states: [['One version', '“This is the first version. Changes will show here.”'], ['Restoring', 'Optimistic, with a pending line; on failure the toast says so with Retry'], ['Viewer', 'Can compare, can’t restore']],
    },
  },
  {
    id: 'linked',
    label: 'Linked work',
    cur: {
      img: 'd-linked',
      pins: [
        [1405, 250, 2, 'Issues without a type', 'Key, a caps status pill coloured by guessing from the name, and the title. A copy of Work’s card that doesn’t look like it.'],
        [1415, 490, 2, 'The same issue twice', 'PLT-204 is listed under “Issues referenced” and again under “Referenced in”.'],
        [848, 547, 2, 'Embeds in caps', 'Inline embeds repeat the shouting status in mono.'],
        [1405, 655, 1, 'Generic backlinks', 'Every backlink is the doc icon with “ENG · Linked here”.'],
      ],
    },
    pro: {
      render: () => screenLinked(),
      pins: [
        [940, 26, 'One rail, chosen from the header', 'Linked work opens in the same right margin as comments.'],
        [1300, 120, 'Issues in this page', 'Rows from Work’s list component: type tile, key, title, status glyph, assignee. A progress line below.'],
        [1300, 290, 'Both directions, once each', 'Issues that link here and pages that link here; an issue in both lists shows once.'],
        [900, 181, 'An issue as a block', 'The card embed shows status, priority, assignee, sprint and epic, live and editable from its menu.'],
        [800, 345, 'Inline embeds read as issues', 'Type tile, key, title, status glyph. # inserts one.'],
      ],
    },
    ix: {
      job: 'See the work a document drives, and keep both in step.',
      actions: ['Open an issue in a peek', 'Embed an issue (#)', 'Link an existing issue'],
      keys: [['#', 'Embed an issue'], ['⌘⌥L', 'Linked work rail'], ['↵ on an embed', 'Open the issue peek'], ['Space on an embed', 'Change its status']],
      states: [['Work off', 'Embeds show key and title in ink, no status; the rail lists pages only'], ['No access to an issue', '“An issue you can’t see” with the project name'], ['Deleted issue', 'Struck-through key, “deleted”, with Undo for the author for 6s']],
    },
  },
  {
    id: 'create',
    label: 'New page',
    cur: {
      img: 'd-create-page',
      pins: [
        [960, 95, 2, 'A modal to make a page', 'Creating a page opens a large dialog over the space, away from where the page will live.'],
        [1000, 184, 1, 'Two titles to type', 'An optional title here, then the page opens and you type into the title again.'],
        [705, 375, 1, 'Templates all look alike', 'Every template is the doc icon with a description; no preview.'],
        [705, 290, 1, 'Hidden gestures', 'Double-clicking a template creates at once; nothing says so.'],
        [780, 814, 1, 'No keyboard path', 'No ⌘↵ hint, and the list scrolls inside the dialog.'],
      ],
    },
    pro: {
      render: () => screenNewPage(),
      pins: [
        [200, 471, 'Created in place', 'N (or + on a row) adds “Untitled” where you are in the tree and opens it at once. Undo removes it.'],
        [700, 140, 'Title first', 'The caret is in the title. Enter moves to the body. Add icon and Add cover appear on hover.'],
        [780, 211, 'Sensible defaults', 'Draft, you as owner, the parent you started from. All editable in place.'],
        [1210, 415, 'Templates inside the empty page', 'Previews you can choose with arrows and Enter. Typing anything dismisses them.'],
        [1210, 570, 'Import from here too', 'Markdown or a Confluence export, as a page in this place.'],
      ],
    },
    ix: {
      job: 'Start a page in the right place in under a second.',
      actions: ['Type a title', 'Pick a template', 'Start blank'],
      keys: [['N', 'New page here (in the current page’s parent)'], ['⇧N', 'New page inside the current page'], ['↑↓←→ ↵', 'Choose a template'], ['Esc', 'Dismiss templates and write']],
      states: [['Abandoned', 'An untitled empty page is removed when you leave it'], ['Offline', 'Created locally, synced when back'], ['No permission', 'N is disabled with a tooltip naming who can add pages']],
    },
  },
  {
    id: 'import',
    label: 'Import and export',
    cur: {
      img: 'd-import',
      pins: [
        [960, 319, 2, 'Always at the top', '“The pages go at the top of the space”: you can’t choose where they land.'],
        [850, 372, 1, 'Two formats as a toggle', 'Markdown and Confluence export are a segmented switch with nothing to tell them apart.'],
        [770, 432, 1, 'A rotated download icon', 'Import borrows the download icon turned upside down.'],
        [162, 868, 1, 'Hidden in the footer', 'Import is a quiet text link at the foot of the tree. Export is an item in the page’s ··· menu, Markdown or HTML, with no failure state.'],
      ],
    },
    pro: {
      render: () => screenImport(),
      pins: [
        [960, 135, 'Choose where it lands', 'Put the pages under any page in the space.'],
        [1151, 213, 'Sources as tiles', 'Markdown, HTML, and “Import from Confluence”, each saying what it takes.'],
        [1150, 286, 'Progress you can read', 'Per-file states, the page each file became, and warnings in plain words.'],
        [1150, 500, 'Keeps going in the background', 'Close it and an Inbox item says when it’s done. Export moves to the ··· menu as Export… with Markdown, HTML and PDF, and the same progress and errors.'],
      ],
    },
    ix: {
      job: 'Bring existing docs in, and take them out, without surprises.',
      actions: ['Choose a source', 'Drop files or a folder', 'Open the imported pages'],
      keys: [['⌘O', 'Choose files'], ['↵', 'Start the import'], ['Esc', 'Close (the import keeps going)']],
      states: [['Too large', 'Says the limit and which files pushed it over'], ['Partial', 'Imports the rest and lists what was skipped, with why'], ['Failed', 'Keeps the files picked; Retry']],
    },
  },
  {
    id: 'trash',
    label: 'Trash',
    cur: {
      img: 'd-trash',
      pins: [
        [1140, 230, 2, 'Restore is the only action', 'No Delete forever, no Empty trash, no retention period.'],
        [900, 214, 1, 'Can’t look before you restore', 'Rows aren’t links; you restore to find out what a page was.'],
        [700, 236, 1, 'No who', '“Moved to trash now”, but not by whom.'],
        [1300, 620, 1, 'Another width', 'A 900px column, a fourth content width in Docs.'],
      ],
    },
    pro: {
      render: () => screenTrash(),
      pins: [
        [180, 813, 'Trash beside Settings', 'One Trash for Docs in the sidebar foot, filtered to the space you came from.'],
        [700, 165, 'Says what happens', 'Pages stay 30 days, restoring brings back their children.'],
        [620, 204, 'A table with who and where', 'Original place, who deleted it and when. Restore on hover; ··· for Delete forever.'],
        [1240, 145, 'Preview before you restore', 'Click a row to read it, read-only, in a peek.'],
        [1225, 872, 'Irreversible asks, reversible doesn’t', 'Restore happens at once. Delete forever and Empty trash use the typed confirmation.'],
      ],
    },
    ix: {
      job: 'Get back something deleted by mistake.',
      actions: ['Find a page', 'Preview it', 'Restore it'],
      keys: [['/', 'Search the trash'], ['↑↓ ↵', 'Move and preview'], ['R', 'Restore'], ['⌘⌫', 'Delete forever (asks)']],
      states: [['Empty', '“Nothing in the trash. Deleted pages stay here for 30 days.”'], ['Error', 'Says so, with Retry'], ['Not an admin', 'Delete forever and Empty trash are hidden']],
    },
  },
  {
    id: 'search',
    label: 'Search',
    cur: {
      img: 'd-palette',
      pins: [
        [330, 331, 2, 'Pages look like issues', 'Every row is a ▮ character on a grey tile; a page shows its space key where an issue shows its key.'],
        [800, 331, 1, 'No place, no match', 'No breadcrumb and no matching line; “RFC: Move sessions to Postgres” could be any of three pages.'],
        [360, 121, 2, 'An AI dot while AI is off', 'The input promises “tell Bemmoly what to do”.'],
        [900, 370, 1, 'Hints about settings', '“Try backups · invite” on the Docs home.'],
      ],
    },
    pro: {
      render: () => screenSearch(),
      pins: [
        [965, 122, 'Scoped to where you are', 'From inside a space, search starts “In Engineering”; ⌫ widens it to everything.'],
        [430, 220, 'Pages with their face and place', 'Page icon, title with the match marked, Space › parent, and the matching line.'],
        [430, 460, 'Issues as issues', 'Type tile, key, status glyph and assignee.'],
        [430, 553, 'Create from the query', '⌘↵ makes a page called “postgres” in this space.'],
        [430, 598, 'Teaches the keys', 'Including ⇧↵ to open beside the current page.'],
      ],
    },
    ix: {
      job: 'Find a page by what it says, not only its title.',
      actions: ['Search', 'Open', 'Create from the query'],
      keys: [['⌘K or /', 'Open'], ['Tab', 'Filter by type'], ['⌫ on empty', 'Clear the scope'], ['⇧↵', 'Open beside'], ['⌘↵', 'Create a page from the query']],
      states: [['Empty query', 'Recent pages and issues, then actions for this page'], ['No results', '“Nothing for ‘postgress’. Did you mean postgres?” and Create'], ['Slow', 'Results stream in; the list never jumps under the pointer']],
    },
  },
  {
    id: 'empty',
    label: 'Empty and error',
    cur: {
      img: 'd-empty-space',
      pins: [
        [235, 245, 2, 'Two empty states at once', '“No pages yet” in the tree and “Nothing written here yet” in the page, with different buttons.'],
        [950, 409, 2, 'Four New page buttons', 'Header, tree, empty card and footer, all opening the same dialog.'],
        [1110, 352, 1, 'Mentions templates, offers none', 'The copy lists RFCs and runbooks, then shows one button.'],
        [850, 760, 2, 'Errors leave the frame', 'A missing page drops the space sidebar and shows a bare message; home lists, sidebar search and trash errors have no Retry.'],
      ],
    },
    pro: {
      render: () => screenEmpty(),
      pins: [
        [180, 453, 'One quiet row', 'The tree shows a single “New page” row with its shortcut.'],
        [1240, 340, 'One question, three answers', 'Blank page (N), From a template, Import. Blank is the default; Enter takes it.'],
        [1240, 545, 'Errors in the frame', 'The sidebar and header stay. The message says what happened, that nothing was lost, and retries on its own with a countdown.'],
      ],
    },
    ix: {
      job: 'Turn an empty space into a first page.',
      actions: ['Write a blank page', 'Use a template', 'Import'],
      keys: [['N or ↵', 'Blank page'], ['T', 'Templates'], ['I', 'Import']],
      states: [['Error', 'In the frame, with what happened, Retry, and automatic retry with backoff'], ['Offline', 'The page opens from the local copy, marked offline'], ['No permission', '“You can read Research but not add pages. Ask Rohan S.”']],
    },
  },
  {
    id: 'dark',
    label: 'Dark mode',
    cur: {
      img: 'd-dark-comments',
      pins: [
        [622, 56, 2, 'A pastel primary', 'Create turns washed-out light blue and outshines the page.'],
        [855, 547, 2, 'Violet caps on navy', 'Embedded status pills drop to low contrast.'],
        [620, 642, 1, 'Muddy highlights', 'Comment amber turns brown.'],
        [1105, 245, 1, 'Dim avatars', 'Pastel initials lose contrast on the dark card.'],
        [715, 101, 1, 'A brown status', 'In review becomes a brown pill.'],
      ],
    },
    pro: {
      render: () => screenDocPage(true),
      pins: [
        [130, 700, 'Three surfaces', 'Sidebar #0C0F13, canvas #111418, cards #181C22, with 8% white hairlines.'],
        [700, 100, 'The cover holds up', 'The drawn cover deepens instead of glowing.'],
        [1130, 520, 'Glyphs keep contrast', 'Type tiles, status glyphs and solid avatars read on dark.'],
        [705, 676, 'Carets and highlights tuned for dark', 'Amber at 13% with a stronger underline; carets keep their person colour.'],
      ],
    },
  },
  {
    id: 'mobile',
    label: 'Phone',
    mobile: true,
    cur: {
      img: 'm-page',
      pins: [
        [44, 60, 3, 'The top bar scrolls sideways', 'Your work and Board are cut off; Create fills the bar.'],
        [250, 103, 2, 'A bar to reach the tree', '“Engineering pages” takes a row of its own.'],
        [330, 215, 2, 'Four rows before the title', 'Banner, top bar, pages bar, page bar, then chips.'],
        [250, 725, 1, 'Embeds wrap under list items', 'Chips drop to their own line with caps status.'],
      ],
    },
    pro: {
      render: () => screenPhone(),
      pins: [
        [240, 14, 'Where you are, in one bar', 'Menu opens the same sidebar as a sheet, with the tree. Space and parent sit above the title.'],
        [300, 100, 'The page reads first', 'A shorter cover, the icon, a 27px title and the properties on one scrolling line.'],
        [240, 746, 'Comments on demand', 'A floating count opens the threads as a sheet.'],
        [237, 790, 'A bottom bar', 'Home, Inbox, New, Search and Docs within thumb reach.'],
      ],
    },
  },
  {
    id: 'found',
    label: 'Docs components',
    tall: true,
    cur: { render: () => docsFoundCurrent(), pins: [] },
    pro: { render: () => docsFoundProposed(), pins: [] },
    curNotes: [
      [3, 'AI renders while AI is off', 'Suggested fixes and the TL;DR card don’t read the AI setting; the AI colour equals the accent.'],
      [2, 'Status as caps pills', 'Issue embeds and page status shout, with colours guessed from names.'],
      [2, 'Signal colours on spaces', 'Space tiles hash into status and danger colours.'],
      [2, 'Typed characters', '▮ ✓ → ⋯ ↑ ↓ + − stand in for icons in search, menus, compare and tools.'],
      [1, 'No page identity', 'Page icons are stored but can’t be chosen; there are no covers.'],
    ],
    proNotes: [
      ['Same families as Work', 'Type tiles and status glyphs in embeds and page status; entity colours for spaces; signal colours only for change and warnings.'],
      ['Page identity', 'Drawn icons in eight tints, and covers. Emoji stay possible as user content, never as UI.'],
      ['Blocks with icons', 'Slash rows, callout tones and table tools all draw from the one icon set.'],
      ['AI is lilac and conditional', 'Every AI surface checks the setting first; lilac means AI and nothing else.'],
    ],
  },
];
