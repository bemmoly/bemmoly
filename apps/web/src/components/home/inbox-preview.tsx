import { actorLabel, useFrameLink } from '@bemmoly/core-web';
import type { Notification } from '@bemmoly/shared';
import { Avatar, avatarHue, RelativeTime, SkeletonRow } from '@bemmoly/ui';
import { useInbox } from '../../hooks/use-notifications.ts';

function PreviewRow({ item }: { item: Notification }) {
  const link = useFrameLink(`/inbox?item=${encodeURIComponent(item.id)}`);
  const who = actorLabel(
    item.actors.map((actor) => actor.name),
    item.actorCount,
  );
  return (
    <a
      {...link}
      data-unread={!item.read || undefined}
      className="flex items-center gap-2.5 border-b border-line-2 px-3.5 py-2.25 text-13 text-tx no-underline last:border-b-0 hover:bg-hover focus-ring-inset"
    >
      <Avatar
        name={item.actors[0]?.name ?? 'Bemmoly'}
        hue={avatarHue(item.actors[0]?.id ?? item.id)}
        size={22}
      />
      <span className="min-w-0 flex-1 truncate">
        <b className="font-medium">{who}</b> <span className="text-tx-3">{item.verb}</span>{' '}
        {item.target.label}
      </span>
      <RelativeTime iso={item.createdAt} className="text-12 text-tx-3" />
      <span
        aria-label={item.read ? undefined : 'Unread'}
        className={`size-1.5 shrink-0 rounded-full ${item.read ? '' : 'bg-acc'}`}
      />
    </a>
  );
}

/** Home's inbox card: the newest few, unread dots, and the way into the full triage view. */
export function InboxPreview({ limit = 5 }: { limit?: number }) {
  const { items, unreadCount, isPending } = useInbox();
  const open = useFrameLink('/inbox');
  return (
    <section
      aria-labelledby="home-inbox"
      className="overflow-hidden rounded-card bg-card shadow-e1"
    >
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <h2 id="home-inbox" className="m-0 flex-1 text-13 font-semibold">
          Inbox
        </h2>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-acc-fill px-1.5 text-11 leading-4.25 font-semibold text-on-acc tabular-nums">
            {unreadCount}
          </span>
        ) : null}
        <a {...open} className="text-12 font-medium">
          Open inbox
        </a>
      </div>
      {isPending ? (
        <div aria-busy aria-label="Loading the inbox">
          {[0, 1, 2].map((index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="m-0 px-3.5 py-6 text-center text-13 text-tx-3">
          You’re all caught up. Mentions, reviews and assignments land here.
        </p>
      ) : (
        items.slice(0, limit).map((item) => <PreviewRow key={item.id} item={item} />)
      )}
    </section>
  );
}
