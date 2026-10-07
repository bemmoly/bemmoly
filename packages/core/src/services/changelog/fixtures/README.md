# Changelog fixtures

`streams/` holds verbatim copies of the identity (01xx) and email and
notifications (02xx) changesets from their own branches, so the runner's
integration test can apply every kernel changeset in order from empty before
those branches are merged. Delete `streams/` at integration, once the real
files live in `packages/core/changelog/`, and point the test at that folder.
