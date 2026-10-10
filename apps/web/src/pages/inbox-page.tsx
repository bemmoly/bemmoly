import {
  PageLayout,
  useEntityRenderer,
  useFrame,
  useGlobalKeys,
  useShortcutHelp,
} from '@bemmoly/core-web';
import type { Notification } from '@bemmoly/shared';
import {
  Button,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  SegmentedControl,
  SkeletonRow,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { InboxDetail } from '../components/inbox/inbox-detail.tsx';
import { InboxList } from '../components/inbox/inbox-list.tsx';
import {
  applyFilter,
  groupByDay,
  inApp,
  INBOX_FILTERS,
  type InboxFilter,
} from '../components/inbox/inbox-model.ts';
import { MarkAllRead } from '../components/inbox/mark-all-read.tsx';
import {
  snoozeChoices,
  useInboxView,
  useTriage,
  type InboxView,
} from '../hooks/use-inbox-triage.ts';
import { useMarkRead } from '../hooks/use-notifications.ts';
import type { InboxSearch } from '../router/app-routes.tsx';

const EMPTY: Record<InboxView, { title: string; description: string }> = {
  inbox: {
    title: 'You’re all caught up',
    description: 'Mentions, reviews and assignments land here.',
  },
  snoozed: {
    title: 'Nothing snoozed',
    description: 'Snooze an item with S and it comes back when you asked.',
  },
  done: {
    title: 'Nothing marked done yet',
    description: 'Mark an item done with E once you have dealt with it.',
  },
};

const VIEWS: readonly { value: InboxView; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'snoozed', label: 'Snoozed' },
  { value: 'done', label: 'Done' },
];

/**
 * The Inbox as a two-pane triage view (docs/design/premium/screens.js, `screenInbox`): segments
 * for All, Mentions, Reviews and Assigned, the list grouped by day, and the selected item in
 * context on the right. J and K move, Enter opens, E marks done, S snoozes until tomorrow
 * morning; both offer Undo. The selection, segment and view live in the address.
 */
export function InboxPage() {
  const search = useSearch({ from: '/app/inbox' }) as InboxSearch;
  const routerNavigate = useNavigate();
  const { phone } = useFrame();
  const filter: InboxFilter = search.filter ?? 'all';
  const view: InboxView = search.view ?? 'inbox';
  const inbox = useInboxView(view);
  const triage = useTriage(view);
  const { markRead, markUnread } = useMarkRead();
  const readNow = useRef(markRead.mutate);
  useLayoutEffect(() => {
    readNow.current = markRead.mutate;
  });
  const shown = useMemo(() => applyFilter(inbox.items, filter), [inbox.items, filter]);
  const groups = useMemo(() => groupByDay(shown), [shown]);
  const order = groups.flatMap((group) => group.items);
  const selected = order.find((item) => item.id === search.item) ?? (phone ? undefined : order[0]);

  const setSearch = (next: InboxSearch, replace = true) =>
    void routerNavigate({ to: '/inbox', search: next, replace });
  const select = (item: Notification | undefined) =>
    item && setSearch({ ...search, item: item.id });

  // The item shown without one in the address is written into it, so an item that arrives
  // above it while the person reads never takes the selection (and is never read unseen).
  const pinned = selected && selected.id !== search.item ? selected.id : null;
  useEffect(() => {
    if (pinned) setSearch({ ...search, item: pinned });
  });

  // Opening an item reads it; the list says so at once.
  const selectedId = selected?.id;
  const selectedUnread = selected ? !selected.read : false;
  useEffect(() => {
    if (selectedId && selectedUnread && view === 'inbox') readNow.current(selectedId);
  }, [selectedId, selectedUnread, view]);

  const step = (by: number) => {
    const at = selected ? order.indexOf(selected) : -1;
    select(order[Math.min(order.length - 1, Math.max(0, at + by))]);
  };
  const next = (item: Notification) =>
    order[order.indexOf(item) + 1] ?? order[order.indexOf(item) - 1];
  // The module that owns the selected item learns the list it came from, for its j and k.
  const owner = useEntityRenderer(selected?.target.kind ?? '');
  const open = (item: Notification) => {
    if (!inApp(item.target.url)) return;
    const keys = order.flatMap((entry) =>
      entry.target.kind === item.target.kind && entry.target.label ? [entry.target.label] : [],
    );
    owner?.rememberList?.({ label: 'Inbox', keys: [...new Set(keys)] });
    void routerNavigate({ to: item.target.url });
  };
  const done = (item: Notification) => {
    select(next(item));
    triage.done(item);
  };
  const snooze = (item: Notification, until: Date, label: string) => {
    select(next(item));
    triage.snooze(item, until, label);
  };

  // Arrows and Enter belong to whatever control has focus; the list takes them otherwise.
  const listKey = (run: () => void) => () => {
    const active = document.activeElement;
    if (!active || active === document.body || active.closest('[aria-label="Notifications"]'))
      run();
  };
  useGlobalKeys({
    j: () => step(1),
    k: () => step(-1),
    ArrowDown: listKey(() => step(1)),
    ArrowUp: listKey(() => step(-1)),
    Enter: listKey(() => selected && open(selected)),
    e: () => selected && view === 'inbox' && done(selected),
    s: () => {
      const choice = snoozeChoices().find((entry) => entry.id === 'tomorrow');
      if (selected && view === 'inbox' && choice) snooze(selected, choice.until, choice.label);
    },
  });
  useShortcutHelp({
    id: 'inbox',
    label: 'Inbox',
    keys: [
      { keys: 'J K', label: 'Next and previous item' },
      { keys: 'Enter', label: 'Open the item' },
      { keys: 'E', label: 'Mark done (with Undo)' },
      { keys: 'S', label: 'Snooze until tomorrow morning' },
    ],
  });

  const counts = (value: InboxFilter) => applyFilter(inbox.items, value).length;
  const header = {
    crumbs: [{ label: 'Inbox', path: '/inbox', icon: <Icon name="inbox" size={15} /> }],
    actions: (
      <>
        <SegmentedControl
          size="sm"
          aria-label="Show"
          value={filter}
          onChange={(value) =>
            setSearch({
              ...(view === 'inbox' ? {} : { view }),
              ...(value === 'all' ? {} : { filter: value }),
            })
          }
          options={INBOX_FILTERS.map((entry) => ({
            value: entry.value,
            label: entry.value === 'all' ? `All · ${counts('all')}` : entry.label,
          }))}
        />
        {view === 'inbox' ? <MarkAllRead unreadCount={inbox.unreadCount} /> : null}
        <Menu
          align="end"
          trigger={(props) => (
            <IconButton {...props} label="Show snoozed or done" icon="sliders" size="sm" />
          )}
        >
          {VIEWS.map((entry) => (
            <MenuItem
              key={entry.value}
              checked={entry.value === view}
              onSelect={() =>
                setSearch(
                  entry.value === 'inbox' ? {} : { view: entry.value as 'snoozed' | 'done' },
                  false,
                )
              }
            >
              {entry.label}
            </MenuItem>
          ))}
        </Menu>
      </>
    ),
  };

  let list;
  if (inbox.isPending) {
    list = (
      <div aria-busy aria-label="Loading the inbox" className="pt-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <SkeletonRow key={index} />
        ))}
      </div>
    );
  } else if (inbox.isError) {
    list = (
      <EmptyState
        icon={<Icon name="alert" />}
        title="The inbox did not load"
        description={inbox.error.message}
        action={<Button onClick={() => void inbox.refetch()}>Try again</Button>}
      />
    );
  } else if (order.length === 0) {
    const empty =
      filter === 'all'
        ? EMPTY[view]
        : { title: 'Nothing here', description: `No ${filter} in this view.` };
    list = <EmptyState icon={<Icon name="inbox" />} {...empty} />;
  } else {
    list = <InboxList groups={groups} selectedId={selected?.id ?? null} onSelect={select} />;
  }
  const detail = selected ? (
    <InboxDetail
      item={selected}
      view={view}
      onOpen={() => open(selected)}
      onDone={() => done(selected)}
      onSnooze={(until, label) => snooze(selected, until, label)}
      onToInbox={() => {
        select(next(selected));
        triage.toInbox(selected);
      }}
      onMarkUnread={() => markUnread.mutate(selected.id)}
      {...(phone ? { onBack: () => setSearch({ ...search, item: undefined }) } : {})}
    />
  ) : null;

  return (
    <PageLayout
      layout="full"
      header={header}
      title={[view === 'inbox' ? 'Inbox' : `Inbox · ${view}`]}
    >
      {phone ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{detail ?? list}</div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,440px)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-line">{list}</div>
          <div className="min-h-0 overflow-y-auto bg-canvas">{detail}</div>
        </div>
      )}
    </PageLayout>
  );
}
