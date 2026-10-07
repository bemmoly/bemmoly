import { actorLabel, formatRelative } from '@bemmoly/core-web';
import type { Notification } from '@bemmoly/shared';
import { Avatar, EmptyState, Skeleton } from '../../ui.ts';

interface NotificationListProps {
  items: readonly Notification[];
  loading: boolean;
  onOpen: (item: Notification) => void;
}

/** Rows from the Home mock's inbox block: 26px avatar, who · verb · target, body, when. */
export function NotificationList({ items, loading, onOpen }: NotificationListProps) {
  if (loading) return <Skeleton rows={4} label="Loading notifications" />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="You're all caught up"
        body="Mentions, reviews and changes to things you watch land here."
      />
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label="Notifications">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            data-unread={!item.read || undefined}
            className={`flex w-full cursor-pointer gap-2.5 border-0 border-b border-row-line px-4 py-2.75 text-left font-sans ${
              item.read ? 'bg-sf' : 'bg-ac-bg2'
            } hover:bg-bg2`}
          >
            <Avatar name={item.actors[0]?.name ?? 'Bemmoly'} size={26} />
            <span className="flex min-w-0 flex-col gap-0.75 text-small leading-[1.45] text-tx">
              <span>
                <b className="font-semibold">
                  {actorLabel(
                    item.actors.map((actor) => actor.name),
                    item.actorCount,
                  )}
                </b>{' '}
                {item.verb}{' '}
                {item.target ? <span className="text-ac">{item.target.label}</span> : null}
              </span>
              {item.body ? <span className="truncate text-tx3">{item.body}</span> : null}
              <span className="text-meta text-tx5">{formatRelative(item.createdAt)}</span>
            </span>
            {item.read ? null : <span className="sr-only">Unread</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The count pill beside "Inbox", shared by the drawer, the Home block and the inbox page. */
export function InboxCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-2 rounded-[9px] bg-ac px-1.5 py-px font-mono text-mono font-medium text-on-ac">
      {count}
    </span>
  );
}
