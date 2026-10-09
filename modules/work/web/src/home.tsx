import type { HomeSectionProps } from '@bemmoly/core-web';
import { Button, Card, EmptyState, SkeletonText, Tabs } from '@bemmoly/ui';
import { MyWorkRow } from './home/my-work-row.tsx';
import { MY_WORK_TABS, useMyWork, type MyWorkTab } from './home/use-my-work.ts';

const EMPTY: Record<MyWorkTab, string> = {
  assigned: 'Nothing is assigned to you. Issues assigned to you show up here.',
  reported: 'You have not reported an issue yet.',
  watching: 'You are not watching any other issue. Watch one from its page to follow it here.',
};

/**
 * Work's section of Home: the Home mock's tabbed "my work" card, with the
 * issues assigned to, reported by and watched by the person.
 */
export default function MyWorkSection({ manifest }: HomeSectionProps) {
  const work = useMyWork();
  const top = manifest.navigation.find((entry) => entry.placement === 'top');
  return (
    <Card aria-label="My work">
      <Tabs
        size="sm"
        aria-label="My work"
        className="px-4"
        items={MY_WORK_TABS.map((tab) => ({
          ...tab,
          ...(work.lists ? { count: work.lists[tab.value].total } : {}),
        }))}
        value={work.tab}
        onChange={work.setTab}
        end={
          top ? (
            <a href={top.path} className="ml-auto text-12h font-medium text-ac no-underline">
              View all
            </a>
          ) : null
        }
      />
      {work.isPending ? (
        <div role="status" aria-label="Loading your work" className="p-4">
          <SkeletonText lines={4} />
        </div>
      ) : work.error ? (
        <EmptyState
          title="Your work did not load"
          action={
            <Button variant="secondary" onClick={work.retry}>
              Try again
            </Button>
          }
        />
      ) : work.list && work.list.items.length > 0 ? (
        <div className="flex flex-col">
          {work.list.items.map((issue) => (
            <MyWorkRow key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <EmptyState title="All clear" description={EMPTY[work.tab]} />
      )}
    </Card>
  );
}
