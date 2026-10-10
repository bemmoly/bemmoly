import { openCreate } from '@bemmoly/core-web';
import { Button, Kbd, RelativeTime, SegmentedControl, StatusGlyph, statusStage } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { linkTo, workPaths } from '../hooks/issue-navigation.ts';
import { useRememberIssueList } from '../issue/issue-list-context.ts';
import { MyWorkRow, MyWorkRowSkeleton, ROW } from './my-work-row.tsx';
import { MY_WORK_TABS, useMyWork, type Mention, type MyWorkTab } from './use-my-work.ts';
import { ROW_KEY, useRowKeys } from './use-row-keys.ts';

const EMPTY: Record<MyWorkTab, string> = {
  assigned: 'Nothing is assigned to you right now.',
  reported: 'You have not created an issue yet.',
  watching: 'You are not watching any other issue. Watch one from its page to follow it here.',
  mentions: 'No one has mentioned you in an issue lately.',
};

function MentionRow({ mention }: { mention: Mention }) {
  const body = (
    <>
      <Icon name="at" size={15} className="text-tx-3" />
      <span className="font-mono text-11 text-tx-3">{mention.key ?? ''}</span>
      <span className="truncate">
        <b className="font-medium">{mention.who}</b>{' '}
        <span className="text-tx-2">{mention.title}</span>
      </span>
      <RelativeTime iso={mention.createdAt} className="text-12 text-tx-3" />
      <span />
    </>
  );
  const url = mention.url?.startsWith('/') ? mention.url : null;
  return url ? (
    <a
      {...linkTo(url)}
      {...{ [ROW_KEY]: '' }}
      className={`${ROW} text-13 text-tx no-underline hover:bg-hover focus-ring-inset`}
    >
      {body}
    </a>
  ) : (
    <div className={`${ROW} text-13`}>{body}</div>
  );
}

/**
 * My issues (docs/design/premium/screens.js, `screenHome`): Assigned, Created, Watching and
 * Mentions, each grouped by status with its glyph, in the list row Backlog uses. Home shows a
 * few per tab with a way to the full page; the My issues page shows them all.
 */
export function MyIssuesCard({ limit, full = false }: { limit: number; full?: boolean }) {
  const work = useMyWork(limit);
  const rows = useRowKeys();
  const total = (tab: MyWorkTab) => (tab === 'mentions' ? undefined : work.lists?.[tab].total);
  const shownMentions = work.mentions.slice(0, full ? 50 : limit);
  // The issue page's j and k walk this list, in the order it is drawn, for the tab on show.
  const keys =
    work.tab === 'mentions'
      ? shownMentions.flatMap((mention) => (mention.key ? [mention.key] : []))
      : work.groups.flatMap((group) => group.issues.map((issue) => issue.key));
  const tabLabel = MY_WORK_TABS.find((tab) => tab.value === work.tab)?.label ?? '';
  useRememberIssueList(
    work.isPending ? null : { label: `My issues · ${tabLabel}`, keys: [...new Set(keys)] },
  );
  return (
    <section
      ref={rows.list}
      onKeyDown={rows.onKeyDown}
      aria-label="My issues"
      className="overflow-hidden rounded-card bg-card shadow-e1"
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-3.5 py-2">
        {full ? null : <h2 className="m-0 text-13 font-semibold">My issues</h2>}
        <SegmentedControl
          size="sm"
          aria-label="Which issues"
          className="max-w-full overflow-x-auto"
          value={work.tab}
          onChange={work.setTab}
          options={MY_WORK_TABS.map((tab) => ({
            value: tab.value,
            label:
              total(tab.value) === undefined ? tab.label : `${tab.label} · ${total(tab.value)}`,
          }))}
        />
        {full ? null : (
          <a {...linkTo(workPaths.myIssues())} className="ml-auto text-12 font-medium">
            View all
          </a>
        )}
      </div>
      {work.isPending ? (
        <div role="status" aria-label="Loading your issues" aria-busy>
          {[0, 1, 2, 3].map((index) => (
            <MyWorkRowSkeleton key={index} index={index} />
          ))}
        </div>
      ) : work.error ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-13 text-tx-2">
          Your issues did not load.
          <Button size="sm" onClick={work.retry}>
            Try again
          </Button>
        </div>
      ) : work.tab === 'mentions' ? (
        work.mentions.length > 0 ? (
          shownMentions.map((mention) => <MentionRow key={mention.id} mention={mention} />)
        ) : (
          <p className="m-0 px-4 py-8 text-center text-13 text-tx-3">{EMPTY.mentions}</p>
        )
      ) : work.groups.length > 0 ? (
        work.groups.map((group) => (
          <div key={group.name} role="group" aria-label={group.name}>
            <div className="flex h-7.5 items-center gap-2 border-b border-line bg-sunken px-3.5 text-12 font-semibold">
              <StatusGlyph stage={statusStage(group.category, group.name)} size={12} decorative />
              {group.name}
              <span className="font-normal text-tx-3 tabular-nums">{group.issues.length}</span>
            </div>
            {group.issues.map((issue) => (
              <MyWorkRow key={issue.id} issue={issue} />
            ))}
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-13 text-tx-3">
          {EMPTY[work.tab]}
          {work.tab === 'assigned' || work.tab === 'reported' ? (
            <Button
              size="sm"
              onClick={() => openCreate('work.create-issue')}
              iconEnd={<Kbd keys="C" />}
            >
              New issue
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
