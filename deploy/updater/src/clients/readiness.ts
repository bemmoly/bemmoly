/**
 * Polls a health URL on the internal network (the app's /readyz, or a new updater's
 * /healthz) until it answers `{ status: expected }` or time runs out.
 */
export async function waitForReady(
  url: string,
  timeoutMs: number,
  isAlive: () => Promise<boolean>,
  expected = 'ready',
): Promise<{ ready: boolean; detail: string }> {
  const deadline = Date.now() + timeoutMs;
  let detail = 'no answer yet';
  while (Date.now() < deadline) {
    if (!(await isAlive())) return { ready: false, detail: 'the container stopped' };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      const body = (await response.json().catch(() => ({}))) as { status?: string };
      if (response.ok && body.status === expected) return { ready: true, detail: 'ready' };
      detail = `readyz answered ${response.status} ${body.status ?? ''}`.trim();
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return { ready: false, detail: `not ready after ${Math.round(timeoutMs / 1000)} s (${detail})` };
}
