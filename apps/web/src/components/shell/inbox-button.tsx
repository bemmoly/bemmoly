import { useInbox } from '../../hooks/use-notifications.ts';
import { useUiStore } from '../../store/ui.ts';
import { IconButton } from '../../ui.ts';

/** The bell from the Home mock, with the unread badge fed by /notifications. */
export function InboxButton() {
  const { unreadCount } = useInbox();
  const inboxOpen = useUiStore((state) => state.inboxOpen);
  const setInboxOpen = useUiStore((state) => state.setInboxOpen);
  const label = unreadCount > 0 ? `Inbox, ${unreadCount} unread` : 'Inbox';
  return (
    <IconButton label={label} aria-expanded={inboxOpen} onClick={() => setInboxOpen(!inboxOpen)}>
      <span
        aria-hidden="true"
        className="size-3.5 rounded-[4px_4px_7px_7px] border-[1.5px] border-current"
      />
      {unreadCount > 0 ? (
        <span
          data-testid="inbox-badge"
          className="absolute top-1.25 right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-[7px] bg-danger px-0.75 text-micro font-semibold text-on-status"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </IconButton>
  );
}
