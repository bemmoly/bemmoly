---
'@bemmoly/module-work': minor
'@bemmoly/web': minor
---

Reports can be asked for in words. With AI on, the Reports view has an "Ask for a report" box:
ask "How loaded is each person?" or "Which epics are in the current sprint and how far along is
each?" and get back a chart, a table or a single number built from the project's issues, with a
line saying how the question was read. AI only picks from a fixed set of measures, groupings and
filters; the server builds the report with your own permissions and never runs a query the model
wrote. Pin a report to keep it at the top of your Reports view, where it is rebuilt from live
data on every visit, even with AI off. Any asked or pinned report exports as CSV or JSON, and a
chart also as PNG.

The model is sent the question and the project's status and type names, never issue text, and
asking is refused for projects excluded from AI in Settings › AI › Privacy.

Schema: one changeset (0035) adds the `pinned_reports` table with its indexes. It is fast and
reversible.
