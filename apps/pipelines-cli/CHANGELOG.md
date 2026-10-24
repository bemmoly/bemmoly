# @bemmoly/pipelines-cli

## 1.4.0

### Patch Changes

- @bemmoly/module-pipelines@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [d6208c1]
  - @bemmoly/module-pipelines@1.3.0

## 1.2.0

### Minor Changes

- c41a835: `bp` (also `bemmoly-pipelines`), Pipelines from a terminal or CI: `bp login` (a device
  code, or `--token` with an API token), `bp run`, `bp logs -f`, `bp release create` (Bring
  your CI, with JUnit results), `bp promote`, `bp rollback`, `bp why` (explains an access
  decision) and `bp lint`, which checks `.bemmoly/application.yaml` and pipeline files offline.
  `pnpm --filter @bemmoly/pipelines-cli build` writes one file, `dist/bp.mjs`, that runs on
  Node 24. No schema or configuration changes.

### Patch Changes

- Updated dependencies [c41a835]
  - @bemmoly/module-pipelines@1.2.0
