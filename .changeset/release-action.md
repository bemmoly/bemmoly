---
'@bemmoly/release-action': minor
---

The `bemmoly/release` GitHub Action registers the image a workflow built as a Pipelines
release, signed with the workflow's own OIDC token (`permissions: id-token: write`) or a
scoped CI token, with JUnit results attached. No schema or configuration changes.
