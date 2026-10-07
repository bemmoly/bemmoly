/** Polls the app's /readyz on the internal network until it says ready or time runs out. */
export async function waitForReady(
  url: string,
  timeoutMs: number,
  isAlive: () => Promise<boolean>,
): Promise<{ ready: boolean; detail: string }> {
  const deadline = Date.now() + timeoutMs;
  let detail = 'no answer yet';
  while (Date.now() < deadline) {
    if (!(await isAlive())) return { ready: false, detail: 'the container stopped' };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      const body = (await response.json().catch(() => ({}))) as { status?: string };
      if (response.ok && body.status === 'ready') return { ready: true, detail: 'ready' };
      detail = `readyz answered ${response.status} ${body.status ?? ''}`.trim();
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return { ready: false, detail: `not ready after ${Math.round(timeoutMs / 1000)} s (${detail})` };
}
