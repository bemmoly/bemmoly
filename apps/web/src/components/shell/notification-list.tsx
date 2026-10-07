import { actorLabel, formatRelative } from '@bemmoly/core-web';
import type { Notification } from '@bemmoly/shared';
import { Avatar, avatarHue, Badge, EmptyState } from '@bemmoly/ui';
import { Loading } from '../form.tsx';

interface NotificationListProps {
  items: readonly Notification[];
  loading: boolean;
  onOpen: (item: Notification) => void;
}

/** Rows from the Home mock's inbox block: 26px avatar, who · verb · target, body, when. */
export function NotificationList({ items, loading, onOpen }: NotificationListProps) {
  if (loading) return <Loading label="Loading notifications" lines={4} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="You're all caught up"
        description="Mentions, reviews and changes to things you watch land here."
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
            className={`flex w-full cursor-pointer gap-2.5 border-0 border-b border-br-row px-4 py-2.75 text-left font-sans ${
              item.read ? 'bg-sf' : 'bg-ac-bg2'
            } hover:bg-bg2`}
          >
            <Avatar
              name={item.actors[0]?.name ?? 'Bemmoly'}
              hue={avatarHue(item.actors[0]?.id ?? item.id)}
              size={26}
            />
            <span className="flex min-w-0 flex-col gap-0.75 text-12h leading-note text-tx">
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
              <span className="text-11h text-tx5">{formatRelative(item.createdAt)}</span>
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
    <Badge tone="solid" variant="count" className="ml-2">
      {count}
    </Badge>
  );
}
