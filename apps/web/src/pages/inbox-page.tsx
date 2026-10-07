import { MarkAllRead, useOpenNotification } from '../components/shell/inbox-drawer.tsx';
import { InboxCount, NotificationList } from '../components/shell/notification-list.tsx';
import { useInbox } from '../hooks/use-notifications.ts';
import { Card, CardHeader, PageHeader } from '../ui.ts';

/** Everything in the inbox, newest first; the drawer shows the same list. */
export function InboxPage() {
  const { items, unreadCount, isPending } = useInbox();
  const openNotification = useOpenNotification();
  return (
    <div className="mx-auto flex w-full max-w-200 flex-col gap-5 px-10 pt-7 pb-15">
      <PageHeader
        title="Inbox"
        subtitle="Mentions, review requests and changes to things you watch."
      />
      <Card>
        <CardHeader aside={<MarkAllRead unreadCount={unreadCount} />}>
          Notifications
          <InboxCount count={unreadCount} />
        </CardHeader>
        <NotificationList items={items} loading={isPending} onOpen={openNotification} />
      </Card>
    </div>
  );
}
