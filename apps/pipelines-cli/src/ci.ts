/*
 * What other CI integrations reuse from bp (the bemmoly/release GitHub Action): the release
 * body, JUnit reading, the workflow's OIDC token and the HTTP client, so the action and
 * `bp release create` send exactly the same request.
 */
export { CliError } from './cli/errors.ts';
export { createHttp, type Http } from './clients/http.ts';
export { createPipelinesClient } from './clients/pipelines.ts';
export { githubOidcToken } from './services/oidc.ts';
export { buildReleaseBody, platformDigests, type ReleaseInput } from './services/release.ts';
