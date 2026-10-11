---
'@bemmoly/core': minor
'@bemmoly/server': patch
'@bemmoly/module-work': patch
'@bemmoly/module-docs': patch
'@bemmoly/deploy': patch
---

Faster under load on small machines. Creating an issue reads the end of the backlog from the
board index alone (live issues only; a restored issue that would share a rank moves to the
end) and takes its number in one statement, still gap-free. The page tree and page placement
in Docs now use their index for top-level pages. Authorization answers are shared across
requests for up to five seconds and dropped as soon as a role, membership, grant, person or
API token changes: kernel changeset `0114-identity-authz-notify` adds triggers that notify
`bemmoly_authz` on commit (ADR 0036). The database pool is sized from the CPU count (four per
CPU, 10 to 40) unless `BEMMOLY_DB_POOL_MAX` sets it; the Helm chart sets `databasePoolMax: 10`
per pod.
