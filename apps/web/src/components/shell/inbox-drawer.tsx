import type { Notification } from '@bemmoly/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { useInbox, useMarkRead } from '../../hooks/use-notifications.ts';
import { useUiStore } from '../../store/ui.ts';
import { Drawer } from '../../ui.ts';
import { TEXT_ACTION } from '../button-sizes.ts';
import { InboxCount, NotificationList } from './notification-list.tsx';

/** Opening a notification marks it read and follows its link when it points inside the app. */
export function useOpenNotification() {
  const navigate = useNavigate();
  const { markRead } = useMarkRead();
  return (item: Notification) => {
    if (!item.read) markRead.mutate(item.id);
    const url = item.target?.url;
    if (url?.startsWith('/') && !url.startsWith('//')) void navigate({ to: url });
  };
}

export function MarkAllRead({ unreadCount }: { unreadCount: number }) {
  const { readAll } = useMarkRead();
  return (
    <button
      type="button"
      disabled={unreadCount === 0 || readAll.isPending}
      onClick={() => readAll.mutate()}
      className={`${TEXT_ACTION} text-small font-normal`}
    >
      Mark all read
    </button>
  );
}

/** The inbox drawer under the top bar: fed by /notifications, refreshed over /ws. */
export function InboxDrawer() {
  const open = useUiStore((state) => state.inboxOpen);
  const setOpen = useUiStore((state) => state.setInboxOpen);
  const { items, unreadCount, isPending } = useInbox();
  const openNotification = useOpenNotification();
  return (
    <Drawer
      open={open}
      label="Inbox"
      onClose={() => setOpen(false)}
      title={
        <>
          Inbox
          <InboxCount count={unreadCount} />
        </>
      }
      aside={<MarkAllRead unreadCount={unreadCount} />}
    >
      <NotificationList items={items} loading={isPending} onOpen={openNotification} />
      <div className="px-4 py-3 text-center">
        <Link to="/inbox" onClick={() => setOpen(false)} className="text-small font-medium">
          See all notifications
        </Link>
      </div>
    </Drawer>
  );
}
