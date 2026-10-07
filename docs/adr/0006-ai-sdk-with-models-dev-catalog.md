# ADR 0006: The AI SDK is the only AI integration, driven by the models.dev catalog

- Status: accepted
- Date: 2026-10-07
- Tech design: [§11.1 One integration](../tech-design.html#ai), [§25 Open decisions](../tech-design.html#decisions)

## Context

Admins bring their own AI provider: a hosted one they already pay for, a gateway, or a model
running on their own network. There are hundreds of providers and thousands of models, and the
list changes weekly. Writing a client per vendor would make Bemmoly a provider-maintenance
project, and hard-coding a list would need a release for every new model.

## Decision

1. The AI SDK (`ai`, version 7) is the single AI integration. Only
   `packages/core/src/services/ai/runtime` imports it; every service calls the facade there
   with a model role and a purpose.
2. Which provider package to load, which credentials to ask for, which base URL to call and
   which models exist come from the models.dev catalog at runtime: fetched live by the server
   with a short timeout, then the last stored snapshot, then a copy bundled in the image.
3. Provider packages load by name from an allow-list bundled in the image. Providers whose
   package is not on it use the SDK's generic compatible-API client over their listed base URL.
4. No file in the repository names a vendor. Featured providers in the picker are an ordered
   list of catalog ids, not code.
5. Self-hosted model servers on the admin's network are added as private catalog entries
   after a capability probe, so they use the same role picker.

## Consequences

- A new model or provider appears in the picker the day the catalog lists it, without a release.
- Cost tracking uses the catalog's prices, so `ai_runs` rows and the AI metrics carry real spend.
- The SDK's yearly major version is a one-folder upgrade because of the facade.
- Bemmoly depends on a community catalog; the bundled snapshot keeps installs working offline
  and the JSON can be forked if the project ever stalls.
- Telemetry from the SDK joins request traces with prompt and output recording off.

## Alternatives considered

- **Own client per vendor.** Full control, but streaming, tool calling and structured output
  re-implemented per vendor, forever.
- **An agent framework.** Brings abstractions the product does not want.
- **A proxy service in another language.** Breaks the one-image promise.
