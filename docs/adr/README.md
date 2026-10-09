# Architecture decision records

How to write one is in [ADR-0001](0001-record-architecture.md). One decision per record; an
accepted record is never edited except to mark it superseded.

| ADR                                                     | Decision                                                         | Status   |
| ------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture.md)                     | The technical design is the architecture record                  | accepted |
| [0002](0002-typescript-7-with-typescript-6-for-lint.md) | TypeScript 7 typechecks; TypeScript 6 serves typescript-eslint   | accepted |
| [0003](0003-no-server-build-step.md)                    | No server build step; Node runs the TypeScript sources           | accepted |
| [0004](0004-log-format-not-environment-names.md)        | LOG_FORMAT chooses the log output, not the environment's name    | accepted |
| [0005](0005-classic-preset-exact-others-derived.md)     | Classic uses exact mock colours; other presets derive tints      | accepted |
| [0006](0006-ai-sdk-with-models-dev-catalog.md)          | The AI SDK is the only AI integration, driven by models.dev      | accepted |
| [0007](0007-one-website-and-one-mobile-app.md)          | One website and one mobile app for every module                  | accepted |
| [0008](0008-modules-ship-in-one-image.md)               | Every module ships in the one image, enabled per install         | accepted |
| [0009](0009-updater-sidecar.md)                         | In-app updates go through a small updater sidecar                | accepted |
| [0010](0010-liquibase-style-changelog-runner.md)        | Schema changes run through a Liquibase-style changelog runner    | accepted |
| [0011](0011-postgres-only.md)                           | Postgres is the only database                                    | accepted |
| [0012](0012-shared-editor-loaded-on-first-use.md)       | One shared editor package, loaded the first time an editor opens | accepted |
| [0013](0013-modules-read-documents-with-the-editor-schema.md) | Module server code reads documents with the editor's schema | accepted |
