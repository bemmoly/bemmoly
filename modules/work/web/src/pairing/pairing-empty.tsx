import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

/*
 * What the Pairing view says in place of its matrix: nobody held an issue in the range, or the
 * load failed.
 */

export function PairingNobody({ onWiden }: { onWiden: (() => void) | null }) {
  return (
    <EmptyState
      icon={<Icon name="people" />}
      title="Nobody held an issue in this range"
      description="The matrix shows who was assigned to issues at the same time. Assign issues, or look over a longer range."
      action={onWiden ? <Button onClick={onWiden}>Show the last year</Button> : undefined}
    />
  );
}

export function PairingError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<Icon name="warning" />}
      title="The pairing matrix did not load"
      description={`${message} Nothing was changed.`}
      action={<Button onClick={onRetry}>Try again</Button>}
    />
  );
}
