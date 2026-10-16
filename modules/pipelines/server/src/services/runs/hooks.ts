/*
 * What other areas hear when a run finishes, after its transaction commits: shipping turns
 * a passed build into a release (architecture §11). In process and fire-and-forget: a
 * listener's failure is logged by it, never undoes the run.
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
      await Promise.allSettled([...listeners].map(async (listener) => listener(event)));
    },
  };
}

export type RunHooks = ReturnType<typeof createRunHooks>;
