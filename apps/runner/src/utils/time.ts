import { setTimeout as delay } from 'node:timers/promises';

export const nowIso = (): string => new Date().toISOString();

/** Resolves after `ms`, or early (without throwing) when the signal aborts. */
export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  try {
    await delay(ms, undefined, signal ? { signal } : undefined);
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) throw error;
  }
}

/** Exponential backoff with full jitter, so runners that lost the server do not return in step. */
export function backoffMs(attempt: number, baseMs = 500, maxMs = 15_000): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(ceiling / 2 + (Math.random() * ceiling) / 2);
}
