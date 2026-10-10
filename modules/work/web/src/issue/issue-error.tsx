import { isApiError } from '@bemmoly/api-client';
import { Button, EmptyState } from '@bemmoly/ui';

export interface IssueErrorCopy {
  title: string;
  description: string;
  /** False when trying again cannot help: the issue is gone or not the person's to see. */
  retry: boolean;
}

/**
 * Why an issue did not open, in words a person can act on: gone, not theirs to see (with who
 * can change that), or the server failing, which is the only case Try again can fix.
 */
export function issueErrorCopy(issueKey: string, error: Error): IssueErrorCopy {
  const status = isApiError(error) ? error.status : 0;
  if (status === 404) {
    return {
      title: `${issueKey} is not here`,
      description: 'It may have been deleted or moved to another project.',
      retry: false,
    };
  }
  if (status === 403) {
    return {
      title: `You cannot open ${issueKey}`,
      description:
        'You are not a member of this project. Ask one of its admins to add you, then open it again.',
      retry: false,
    };
  }
  if (status === 0) {
    return {
      title: `${issueKey} could not be opened`,
      description: 'The server did not answer. Check the connection and try again.',
      retry: true,
    };
  }
  return {
    title: `${issueKey} could not be opened`,
    description: `${error.message} Try again in a moment.`,
    retry: true,
  };
}

/** The empty state for an issue that did not open, on the page and in the peek. */
export function IssueError({
  issueKey,
  error,
  onRetry,
  onBack,
}: {
  issueKey: string;
  error: Error;
  onRetry: () => void;
  /** Leave out where there is nowhere to go back to (the peek closes instead). */
  onBack?: () => void;
}) {
  const copy = issueErrorCopy(issueKey, error);
  return (
    <EmptyState
      title={copy.title}
      description={copy.description}
      action={
        <span className="flex gap-2">
          {copy.retry && (
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
          )}
          {onBack && <Button onClick={onBack}>Go back</Button>}
        </span>
      }
    />
  );
}
