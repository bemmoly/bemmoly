---
'@bemmoly/module-pipelines': minor
'@bemmoly/pipelines-web': minor
'@bemmoly/server': minor
'@bemmoly/core': minor
'@bemmoly/ui': minor
---

Bemmoly Pipelines arrives as a separate product on the same install: the `pipelines` module
(off until an admin enables it in Settings › Modules and chooses who may use it) and its own
web app at `/pipelines/`, with its own shell, dark by default. This release lays the ground:
the catalog (domains, groups, applications), environments, teams and overview reads, live
updates over server-sent events, and `pnpm --filter @bemmoly/module-pipelines seed:demo` for a
demo organisation. Schema: Pipelines changesets `0001` to `0008` create its `pipeline_*` and
`cloud_*` tables when the module is enabled. No new configuration keys.
