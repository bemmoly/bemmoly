---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/server': minor
---

Bemmoly can now connect to an AI provider. Settings › AI connects any provider in the
models.dev catalog, or a "Local server" on your own network. Credentials are encrypted with the
install's secret key and are never shown again. A connection test reports the provider's own
answer. Each model role (fast, standard, strong, embedding) is mapped to a model.

- **Catalog.** The provider list is fetched live by the server and falls back to the last good
  copy, then to the copy in the image. A status line says which one is in use. An admin can
  upload a newer catalog file or turn the live fetch off.
- **Privacy.** AI is off by default. With it off, every AI feature and endpoint refuses and the
  app shows no AI. When it is on, an admin chooses:
  - whether issue and doc content is sent;
  - whether email addresses and names are replaced before sending;
  - which spaces and projects are excluded;
  - whether AI actions may change data;
  - whether people may turn AI off for themselves.
- **Budget and logging.** An optional monthly budget warns admins at 80%. At 100% it pauses the
  standard and strong roles until the 1st. Every AI call is logged with its cost.
- **Prompts.** Prompt files can be overridden, compared with the default and reset.

Admins should know:

- **Schema:** eight additive changesets add ai_providers, ai_model_roles, ai_runs,
  ai_catalog_snapshots, ai_prompt_overrides, ai_insights, embeddings and ai_user_opt_outs.
  The embeddings changeset enables the `vector` extension, which the pgvector Postgres image
  every install runs already ships.
- **Configuration:** a new optional `BEMMOLY_AI_RECORDING` key serves canned AI answers for
  end-to-end tests only. `BEMMOLY_ALLOW_PRIVATE_URLS` now also covers a catalog provider's base
  URL; a Local server may always be on a private network.
