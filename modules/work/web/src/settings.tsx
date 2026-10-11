import { PageLayout, type ModuleSettingsProps, type PageTab } from '@bemmoly/core-web';
import { lazy, Suspense } from 'react';
import { isOrgSettingsPage, orgSettingsPath, type OrgSettingsPage } from './settings/pages.ts';
import {
  BoardSettingsSkeleton,
  SettingsListSkeleton,
  WorkflowEditorSkeleton,
} from './skeletons/settings-skeleton.tsx';

/** The org default pages, as the header's tabs, in the order of a project's settings tabs. */
export const ORG_TABS: readonly PageTab[] = [
  {
    id: 'issue-types',
    label: 'Issue types',
    icon: 'layers',
    path: orgSettingsPath('issue-types'),
  },
  { id: 'fields', label: 'Fields', icon: 'list', path: orgSettingsPath('fields') },
  { id: 'workflow', label: 'Workflow', icon: 'workflow', path: orgSettingsPath('workflow') },
  { id: 'board', label: 'Board', icon: 'board', path: orgSettingsPath('board') },
];

const OrgDefaultsScreen = lazy(() => import('./settings/org-defaults-screen.tsx'));

function Loading({ page, editing }: { page: OrgSettingsPage; editing: boolean }) {
  if (page === 'board') return <BoardSettingsSkeleton />;
  if (editing) return <WorkflowEditorSkeleton />;
  return (
    <SettingsListSkeleton
      label="Loading the org defaults"
      tracks={['minmax(0,1fr)', '120px', '160px']}
    />
  );
}

/**
 * Settings › Work (/settings/work/<page>): the org defaults every project inherits until it
 * overrides them. The shell hands over the trail; the pages are the project settings pages in
 * the org scope, loaded on their own, never with Work's screens. Lists sit in the reading
 * column; the board settings and the workflow editor go full width, as in a project.
 */
export default function WorkSettings({ subpath, crumbs }: ModuleSettingsProps) {
  const [first, workflowId] = subpath.split('/').filter(Boolean);
  const page: OrgSettingsPage = isOrgSettingsPage(first) ? first : 'issue-types';
  const editing = page === 'workflow' && Boolean(workflowId);
  return (
    <PageLayout
      layout={page === 'board' || editing ? 'full' : 'contained'}
      header={{ crumbs, tabs: ORG_TABS, activeTab: page }}
    >
      <Suspense fallback={<Loading page={page} editing={editing} />}>
        <OrgDefaultsScreen page={page} workflowId={page === 'workflow' ? workflowId : undefined} />
      </Suspense>
    </PageLayout>
  );
}
