---
'@bemmoly/module-work': minor
'@bemmoly/web': minor
---

The backlog takes LQL queries, the same language as the board's query bar, and Board settings
gain a Backlog tab: ordered sort rules (put what a query matches first, such as support
requests, or sort by a field) and named backlog filters, saved with the board. Custom fields
(`cf.<key>`) now check and complete in both query bars, and a query's ORDER BY sorts board cards
within their columns. No schema change: the rules live in the board's config.
