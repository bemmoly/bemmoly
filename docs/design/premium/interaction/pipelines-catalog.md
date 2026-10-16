# Pipelines: Catalog

**Primary job.** Find an application and judge its health (`/pipelines/catalog`, `G C`).

**What is on it.** A facet column (Domain, Owner team, Tier, Runtime, Lifecycle, Health) with
counts that each ignore their own filter; views across the top (All, My teams, Tier 0, Not
deployed in 90 days, No owner, then the person's own) with their counts; a search box; and the
table: application and group, owner team, tier, the version in Prod and its age or state,
deploys over 12 weeks (`DeliverySpark`), lead time, change failure (red above 5%) and the last
run on the default branch. Keyset pages of 100 load as the end comes into view into a virtual
table on the frame's scroll, so 1,140 rows scroll like ten.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Filter | Tick a facet, pick a view, type in the box | `/` search, F to the facets, arrows in the views | Filters sheet |
| Open an application | Click the row | J K, Enter | Tap the row |
| Save a view | Save view | S | Save view |

**Keyboard map.** `/` focuses the search (Enter or Down then moves into the rows), F focuses the
first facet (opens the Filters sheet on a phone), S saves the current filters, J focuses the
first row, then J K or arrows move and Enter opens.

**States.**

- Loading: the table skeleton and facet skeletons, same tracks as the loaded layout.
- Empty catalog: "No applications yet", pointing to Scan GitHub in Platform.
- No match: "No applications match" with Clear filters.
- Error: Try again in place of the table.
- Many items: virtual rows; "Showing 300 of 1,140" while more pages wait.
- Phone: the table keeps application, Prod and the last run; facets move into a sheet.

**URL state.** `?scope=` (one domain is the scope), `q`, `domain` (several), `team`, `tier`,
`runtime`, `lifecycle`, `health`, `mine`, `staleDays`, `sort=name|recent|tier`.

**Choices recorded.** Choosing exactly one domain sets the scope, so the crumbs and the facet
agree; several domains are a filter at the organisation. Saved views are the person's own, kept on
the server (`GET/POST/DELETE /views`, at most 30 per screen) so they follow them to any device;
deleting one offers Undo. Opening a row carries
the application's domain and group into the scope, so its crumbs read Acme › Commerce ›
Checkout.
