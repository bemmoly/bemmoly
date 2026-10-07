import { Link } from '@tanstack/react-router';
import { MarkAllRead, useOpenNotification } from '../components/shell/inbox-drawer.tsx';
import { InboxCount, NotificationList } from '../components/shell/notification-list.tsx';
import { useModules } from '../hooks/use-modules.ts';
import { useInbox } from '../hooks/use-notifications.ts';
import { useMe } from '../hooks/use-session.ts';
import { useWorkspace } from '../hooks/use-workspace.ts';
import { Card, CardHeader, EmptyState } from '@bemmoly/ui';

function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * The kernel's part of the Home mock: greeting, inbox block and the modules
 * this person can open. Work and Docs add their own blocks when they ship.
 */
export function HomePage() {
  const me = useMe();
  const { items, unreadCount, isPending } = useInbox();
  const workspace = useWorkspace();
  const openNotification = useOpenNotification();
  const { data: modules = [] } = useModules();
  const now = new Date();
  const first = me.user.name.split(' ')[0] ?? me.user.name;
  return (
    <div className="mx-auto flex w-full max-w-320 flex-col gap-6 px-10 pt-8 pb-15">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-24 font-semibold tracking-display text-tx">
          {greeting(now)}, {first}
        </h1>
        <div className="text-nav text-tx4">
          {now.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })} ·{' '}
          {workspace.name}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start gap-5">
        <Card>
          <CardHeader title="Your modules" />
          {modules.length === 0 ? (
            <EmptyState
              title="No modules yet"
              description="An org admin enables modules in Settings › Modules and shares them with you."
            />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {modules.map((module) => {
                const entry = module.navigation.find((nav) => nav.placement === 'top');
                return (
                  <li key={module.id} className="border-b border-br-row last:border-b-0">
                    <Link
                      to={entry?.path ?? `/${module.id}`}
                      className="flex items-center gap-3 px-4 py-2.75 text-tx"
                    >
                      <span className="grid size-7.5 place-items-center rounded-panel bg-ac text-12 font-semibold text-on-ac">
                        {(entry?.label ?? module.id).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">{entry?.label ?? module.id}</span>
                        <span className="text-12 text-tx5">Version {module.version}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            title={
              <>
                Inbox
                <InboxCount count={unreadCount} />
              </>
            }
            actions={<MarkAllRead unreadCount={unreadCount} />}
          />
          <NotificationList
            items={items.slice(0, 6)}
            loading={isPending}
            onOpen={openNotification}
          />
        </Card>
      </div>
    </div>
  );
}
