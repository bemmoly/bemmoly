---
'@bemmoly/editor': patch
---

Inline code can carry bold, italic, strike, a link or a highlight. Markdown such as **`foo`**,
_see `bar`_ or ~~`baz`~~ used to fail the whole document ("Invalid collection of marks"); it now
imports, and the editor can apply those marks to code.
