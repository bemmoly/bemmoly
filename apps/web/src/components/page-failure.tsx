import { describeError } from '../lib/errors.ts';
import { Button } from '../ui.ts';

/** What a page shows when it throws: plain words, the request id, and a retry. */
export function PageFailure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { message, requestId } = describeError(error);
  return (
    <div role="alert" className="mx-auto flex max-w-130 flex-col items-start gap-3 px-10 py-16">
      <h1 className="m-0 text-title font-semibold tracking-[-.015em] text-tx">
        This page did not load
      </h1>
      <p className="m-0 leading-normal text-tx4">{message}</p>
      {requestId ? (
        <p className="m-0 font-mono text-mono text-tx5">Request id {requestId}</p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
