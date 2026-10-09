import { formatRelative } from '@bemmoly/core-web';
import { EmptyState, Skeleton } from '@bemmoly/ui';
import { useIssue } from '../hooks/issue-detail.ts';
import { keepLinksInApp } from '../hooks/issue-navigation.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject, useWorkRealtime } from '../shared/index.ts';
import { DetailsCard } from './details-card.tsx';
import { IssueBody } from './issue-body.tsx';
import { IssueMoreMenu, IssueTrail, ShareButton, WatchButton } from './issue-header.tsx';

const created = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });

/**
 * The Issue page at /work/issue/PLT-204: the trail and page actions over a main column and the
 * 360px Details sidebar, 24px apart, within 1240px. The path's second segment is the issue key.
 */
export default function IssueScreen({ projectKey: issueKey }: WorkScreenProps) {
  const key = issueKey?.toUpperCase();
  const query = useIssue(key);
  const { project } = useProject(key ? projectKeyOf(key) : undefined);
  useWorkRealtime(query.data?.projectId);
  const issue = query.data;

  return (
    <div className="min-h-0 flex-1 overflow-auto" onClick={keepLinksInApp}>
      <div className="mx-auto flex max-w-310 flex-col gap-4 px-10 pt-5 pb-15">
        {query.isPending && (
          <div aria-busy className="flex flex-col gap-4">
            <Skeleton width={240} />
            <Skeleton height={32} width="60%" />
            <Skeleton shape="block" height={240} />
          </div>
        )}
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
            <div className="flex items-center gap-1.5">
              <IssueTrail issue={issue} projectName={project?.name ?? projectKeyOf(issue.key)} />
              <div className="ml-auto flex gap-1.5">
                <WatchButton issue={issue} />
                <ShareButton issueKey={issue.key} />
                <IssueMoreMenu issue={issue} size="page" />
              </div>
            </div>
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
