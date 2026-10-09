/**
 * The two HTTP calls the site's scripts make, each with its own timeout, so a slow or silent
 * server fails the script instead of hanging the workflow.
 */
const TIMEOUT_MS = 15_000;

export async function getText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

export async function postJson(
  url: string,
  body: unknown,
): Promise<{ status: number; text: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: response.status, text: await response.text() };
}
