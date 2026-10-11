/**
 * The routes that call a model (or a provider) on each request: answers, plans, insight
 * refreshes, the editor's ghost text, writes and suggested fixes, and the admin's provider
 * tests and discovery. Each costs money and provider quota, so each has a per-person budget
 * of its own, well under the general one. Paths are below the API prefix, as routes declare
 * them; module routes carry their module's prefix.
 */
const AI_ROUTES: readonly RegExp[] = [
  /^\/ai\/answers$/,
  /^\/ai\/plans$/,
  /^\/ai\/insights\/[^/]+\/[^/]+\/refresh$/,
  /^\/admin\/ai\/providers\/[^/]+\/(test|discover)$/,
  /^\/admin\/ai\/provider-tests$/,
  /^\/docs\/pages\/[^/]+\/(completions|ai-writes)$/,
  /^\/docs\/comments\/[^/]+\/suggest-fix$/,
];

export function isAiRoute(method: string, path: string): boolean {
  return method === 'POST' && AI_ROUTES.some((route) => route.test(path));
}
