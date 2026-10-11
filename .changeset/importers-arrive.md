---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/server': minor
'@bemmoly/web': minor
'@bemmoly/api-client': minor
'@bemmoly/core-web': minor
'@bemmoly/editor': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
---

Bring your work with you: import from Jira, Confluence or a CSV file. An admin opens
Settings › Import (or the setup wizard's import step, which is the same flow), picks a source,
enters the site address and an API token or personal access token, and sees what the site holds
before anything is written: projects or spaces with their counts, then how issue types,
statuses and custom fields will land (matched, created or only reported). The import runs as a
background job with live progress and can be cancelled; at the end a report lists what was
created, updated and skipped, and why.

**Jira** (Cloud and Data Center): projects with their keys and issue numbers kept, issue types
and statuses mapped to Work's (statuses Work lacks are added to the project's own workflow),
custom fields matched by name or created as project fields (kinds Work cannot hold are
reported), versions, components, boards and sprints, and issues with their descriptions,
comments, attachments, labels, parents and links. People are matched by email; someone with no
account here is added as invited (no email is sent), and someone whose address Jira hides becomes
a deactivated placeholder that keeps their name on what they wrote.

**Confluence** (Cloud and Data Center): spaces and their page trees, pages converted from
storage format with links rewritten to the imported pages and issues, unknown macros kept as
labelled blocks, labels, threaded comments and attachments.

**CSV**: one issue per row into a project, columns matched by header, so exports from most
trackers work as they are.

**Safe to run again.** Every imported record is remembered, so running an import again updates
what the first run made instead of copying it, and anything edited in Bemmoly since is left
alone and named in the report. A run that fails part way records why and resumes from where it
stopped. In our test against a local stand-in for a 10,000-issue Jira project (20,000 comments,
10,000 links), the whole import took about two minutes on a laptop.

Credentials are stored encrypted with the install's secret key and are never shown again or
sent to the browser. Calls to a hosted site may only reach public addresses and a Data Center
site may be on the local network; `BEMMOLY_ALLOW_PRIVATE_URLS` lifts that, as it does for AI
providers.

Admins: the schema adds the kernel changeset `0500-import-jobs` (the `import_jobs` and
`import_mappings` tables). It is reversible and quick. Importing requires the Work module for
Jira and CSV and the Docs module for Confluence. Images inside imported pages show their file
name for now; the files themselves are copied into storage.
