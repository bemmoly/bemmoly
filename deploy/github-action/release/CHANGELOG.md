# @bemmoly/release-action

## 1.5.0

### Patch Changes

- @bemmoly/pipelines-cli@1.5.0

## 1.4.0

### Patch Changes

- @bemmoly/pipelines-cli@1.4.0

## 1.3.0

### Patch Changes

- @bemmoly/pipelines-cli@1.3.0

## 1.2.0

### Minor Changes

- c41a835: The `bemmoly/release` GitHub Action registers the image a workflow built as a Pipelines
  release, signed with the workflow's own OIDC token (`permissions: id-token: write`) or a
  scoped CI token, with JUnit results attached. No schema or configuration changes.

### Patch Changes

- Updated dependencies [c41a835]
  - @bemmoly/pipelines-cli@1.2.0
