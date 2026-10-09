---
'@bemmoly/editor': minor
'@bemmoly/module-docs': minor
---

The editor gains the Docs page engine. Pages can hold callouts (info, note, success, warning
and danger), decisions with their state and date, links to other pages, a live table of
contents, tables with a header row and row and column tools, images (uploaded or linked), code
blocks coloured by language, issue chips and issue tables from a saved filter, and a labelled
block for anything an import could not map. Typing "/" opens the block menu from the Doc Editor
design, filtered as you type and driven from the keyboard; its AI group appears only when AI is
available. "[[" links a page and "#" embeds an issue. Issue chips and tables draw live when Work
is enabled and fall back to a quiet placeholder when it is not, so Docs works with Work off.
Pages can be exported to Markdown and to a self-contained HTML file, and imported from Markdown
and from Confluence storage format, where unknown macros are kept as labelled blocks rather than
dropped. The built-in templates now use callouts, decisions, tables and a table of contents
where they help; existing installs keep the templates they already have. Work's description and
comment editors are unchanged. No configuration or schema change.
