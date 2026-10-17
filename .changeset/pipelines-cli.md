---
'@bemmoly/pipelines-cli': minor
---

`bp` (also `bemmoly-pipelines`), Pipelines from a terminal or CI: `bp login` (a device
code, or `--token` with an API token), `bp run`, `bp logs -f`, `bp release create` (Bring
your CI, with JUnit results), `bp promote`, `bp rollback`, `bp why` (explains an access
decision) and `bp lint`, which checks `.bemmoly/application.yaml` and pipeline files offline.
`pnpm --filter @bemmoly/pipelines-cli build` writes one file, `dist/bp.mjs`, that runs on
Node 24. No schema or configuration changes.
