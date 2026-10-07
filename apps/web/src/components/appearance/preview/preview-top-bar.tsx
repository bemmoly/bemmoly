import { TopBar } from '@bemmoly/ui';

const NAV = ['Your work', 'Projects', 'Docs', 'Filters', 'Dashboards', 'Teams'];

const noop = () => undefined;

/** The real top bar with the mock's navigation; the preview canvas is inert, so nothing fires. */
export function PreviewTopBar({ active }: { active: 'Projects' | 'Docs' }) {
  return (
    <TopBar
      nav={NAV.map((label) => ({ id: label, label, active: label === active }))}
      onCreate={noop}
      onSearch={noop}
      onInbox={noop}
      inboxCount={3}
      user={{ name: 'Rohan S.' }}
    />
  );
}
