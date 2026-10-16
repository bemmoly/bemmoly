/*
 * What other areas hear when a run finishes, after its transaction commits: shipping turns
 * a passed build into a release (architecture §11). Listeners should only enqueue durable
 * work; every listener runs, then the first failure is raised so the caller sees it.
 */

export interface RunFinished {
  runId: string;
  state: string;
}

export type RunFinishedListener = (event: RunFinished) => Promise<void> | void;

export function createRunHooks() {
  const listeners = new Set<RunFinishedListener>();
  return {
    onFinished(listener: RunFinishedListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async emitFinished(event: RunFinished): Promise<void> {
      const results = await Promise.allSettled([...listeners].map(async (l) => l(event)));
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
    },
  };
}

export type RunHooks = ReturnType<typeof createRunHooks>;
