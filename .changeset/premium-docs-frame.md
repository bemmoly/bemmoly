---
'@bemmoly/module-docs': patch
'@bemmoly/core-web': patch
'@bemmoly/ui': patch
---

Docs now lives in the same frame as the rest of Bemmoly. Spaces are rows in the sidebar's Docs
section, and the space you are in opens to its page tree right there: drag pages to reorder or
nest them, use Alt and the arrow keys, rename with F2, and add a page inside another with its +.
A right-click opens the same menu as the row's ···. Double-click a space, or press F on it, to
give it the whole section with a filter; Esc gives every space back. Which pages are open, and
which space is focused, are remembered for each person. The page tree column inside a space, the
"pages" bar on phones and the space switcher are gone.

Every Docs screen uses the one header: a page's trail reads space, parents and page, each a link,
with its status as a menu right after it. Docs home, a space's overview and its trash use the
reading column; a page keeps its own 700px column. A page, space or list that fails to load
stays in the frame, keeps the sidebar and offers Try again, as does the sidebar's filter.

The page summary (TL;DR) and suggested fixes on comments appear only when the workspace has AI
turned on, in the AI colour. With AI off, nothing AI is shown.
