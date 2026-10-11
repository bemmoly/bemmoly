import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMarkRead } from '../../hooks/use-notifications.ts';

/** Reads everything in the inbox at once; snoozed items stay as they are. */
export function MarkAllRead({ unreadCount }: { unreadCount: number }) {
  const { readAll } = useMarkRead();
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<Icon name="check" size={14} />}
      disabled={unreadCount === 0 || readAll.isPending}
      onClick={() => readAll.mutate()}
    >
      Mark all read
    </Button>
  );
}
