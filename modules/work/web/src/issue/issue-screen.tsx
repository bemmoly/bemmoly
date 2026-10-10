import { formatRelative, HeaderActions } from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { useIssue } from '../hooks/issue-detail.ts';
import { keepLinksInApp } from '../hooks/issue-navigation.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { IssuePageSkeleton } from '../skeletons/issue-skeleton.tsx';
import { useProject, useWorkRealtime } from '../shared/index.ts';
import { DetailsCard } from './details-card.tsx';
import { IssueBody } from './issue-body.tsx';
import { IssueMoreMenu, ShareButton, WatchButton } from './issue-header.tsx';
import { useIssuePresence } from './issue-presence.tsx';

const created = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });

/**
 * The Issue page at /work/issue/PLT-204: a main column and the 360px Details sidebar, 24px
 * apart, in the frame's reading column; the trail and the page actions are in its header. The
 * path's second segment is the issue key.
 */
export default function IssueScreen({ projectKey: issueKey }: WorkScreenProps) {
  const key = issueKey?.toUpperCase();
  const query = useIssue(key);
  const { project } = useProject(key ? projectKeyOf(key) : undefined);
  useWorkRealtime(query.data?.projectId);
  const issue = query.data;
  useIssuePresence(issue, project?.name);

  return (
    <div onClick={keepLinksInApp}>
      <div className="flex flex-col gap-4">
        {query.isPending && <IssuePageSkeleton />}
        {query.isError && (
          <EmptyState
            title={`${key ?? 'This issue'} could not be opened`}
            description={
              query.error.message.includes('not found')
                ? 'It may have been deleted or moved, or you may not have access to its project.'
                : query.error.message
            }
          />
        )}
        {issue && (
          <>
            <HeaderActions>
              <WatchButton issue={issue} />
              <ShareButton issueKey={issue.key} />
              <IssueMoreMenu issue={issue} size="page" />
            </HeaderActions>
            <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6">
              <div className="flex min-w-0 flex-col gap-5">
                <IssueBody issue={issue} size="page" />
              </div>
              <aside className="sticky top-0 flex flex-col gap-3.5" aria-label="Issue details">
                <DetailsCard issue={issue} size="page" />
                <div className="flex flex-col gap-0.75 px-1 text-12 text-tx5">
                  <span>
                    Created {created(issue.createdAt)}
                    {issue.reporter ? ` by ${issue.reporter.name}` : ''}
                  </span>
                  <span>Updated {formatRelative(issue.updatedAt)}</span>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
