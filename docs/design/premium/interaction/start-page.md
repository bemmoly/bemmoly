# Start page and product switcher

The suite's front door after sign-in (`/start`), drawn after the proposal's section 04
(`docs/proposals/suite/index.html` on the proposal branch) and built from the design system.

## Start page

1. **Primary job**: show the person what each of their products needs from them, and take them
   there in one click.
2. **Top three actions**
   - Open something that needs them: click a "Needs you" row; Tab to it and Enter; tap.
   - Open a product: click its card; Tab and Enter; tap. The grid button (product switcher)
     does the same from any screen.
   - Ask or find: type in the question box and press Enter; it opens ⌘K with the words, where
     AI answers or plans (Mod+Enter) when AI is on. Mod+K opens the same palette from anywhere.
3. **Keyboard map**: no keys of its own. The global map holds (Mod+K, C, G H, G I, [ and ?).
   The question box is a field, so single-letter keys type into it while it has focus.
4. **States**
   - Loading: skeleton cards for the products and skeleton rows for the lists.
   - Empty: no modules, the same "come from modules" empty state as Home; no "needs you", one
     quiet line ("Nothing needs you right now"); no recents, a line saying how items get here.
   - Error: the summaries failed, one card with Try again; the product cards still draw from
     the module list, and the question box still works.
   - Partial: a module that refuses the person (a capability they lack) is left out by the
     server; its product card still shows, without a count.
   - Many items: each module sends at most five for each list; the page shows eight needs and
     six recents, newest or soonest first.
   - No permission: products come from the modules the person may open, so a product they
     cannot use never shows.
   - Phone: one column, the product cards included.
5. **URL state**: none beyond the path.
6. **Choices recorded**
   - The proposal's "Who's out", "Coming up" and "From the company" column needs People, which
     another stream builds; it is left out until a module contributes it.
   - The question box is not a second AI surface: it hands its words to ⌘K, which already
     answers with citations and proposes plans a person confirms. With AI off it is a plain
     search box with no lilac and no AI words.
   - Home (`/`) stays as Work and Docs' "Your work". Sign-in without a destination lands on the
     start page.

## Product switcher

1. **Primary job**: move between products, or back to the start page, from any shell: beside
   Search in Bemmoly's sidebar (under it on the rail), and at the left of Pipelines' top bar.
2. **Top three actions**: open the start page; open another product; close (Escape). Mouse,
   keyboard (Enter or Space on the grid button, arrows in the menu) and touch alike.
3. **Keyboard map**: the menu's own (arrows, Enter, Escape, Home and End).
4. **States**: lists only products the person can use; the current one is ticked, the start
   page when they are on it or on a kernel page.
5. **URL state**: none.
6. **Choices recorded**: a menu of rows with module tiles rather than the proposal's tile grid,
   since the system has a menu and no tile-grid popover.
