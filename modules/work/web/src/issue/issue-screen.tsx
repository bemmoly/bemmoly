import { HeaderActions } from '@bemmoly/core-web';
import { useIssue } from '../hooks/issue-detail.ts';
import { keepLinksInApp, navigateBack, workPaths } from '../hooks/issue-navigation.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import { useMediaQuery } from '../hooks/media-query.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { ISSUE_GRID, IssuePageSkeleton } from '../skeletons/issue-skeleton.tsx';
import { useProject, useWorkRealtime } from '../shared/index.ts';
import { IssueBody } from './issue-body.tsx';
import { IssueError } from './issue-error.tsx';
import { IssueMoreMenu, IssueStepper, ShareButton, WatchButton } from './issue-header.tsx';
import { useIssueNeighbours } from './issue-list-context.ts';
import { useIssueShortcuts } from './issue-shortcuts.ts';
import { useIssuePresence } from './issue-presence.tsx';
import { IssueRail } from './issue-rail.tsx';

/** Below this width the rail moves under the title, as one column. */
const WIDE = '(min-width: 768px)';

/**
 * The Issue page at /work/issue/PLT-204, in the frame's reading column: the issue as a document
 * on the left and its rail on the right; on a phone, one column with the rail under the title.
 * ↑↓ and j k step through the list the issue was opened from.
 */
export default function IssueScreen({ projectKey: issueKey }: WorkScreenProps) {
  const key = issueKey?.toUpperCase() ?? '';
  const query = useIssue(key || undefined);
  const { project } = useProject(key ? projectKeyOf(key) : undefined);
  useWorkRealtime(query.data?.projectId);
  const issue = query.data;
  useIssuePresence(issue, project?.name);
  const neighbours = useIssueNeighbours(key);
  useIssueShortcuts(neighbours);
  const wide = useMediaQuery(WIDE);

  return (
    <div onClick={keepLinksInApp}>
      {query.isPending && <IssuePageSkeleton />}
      {query.isError && (
        <IssueError
          issueKey={key}
          error={query.error}
          onRetry={() => void query.refetch()}
          onBack={() => navigateBack(workPaths.board(projectKeyOf(key)))}
        />
      )}
      {issue && (
        <>
          <HeaderActions>
            {neighbours && <IssueStepper neighbours={neighbours} />}
            <WatchButton issue={issue} />
            <ShareButton issueKey={issue.key} />
            <IssueMoreMenu issue={issue} size="page" />
          </HeaderActions>
          <div className={ISSUE_GRID}>
            <article aria-label={`${issue.key} ${issue.title}`} className="min-w-0">
              <IssueBody issue={issue} size="page" railInline={!wide} />
            </article>
            {wide && (
              <aside
                aria-label="Issue properties"
                className="sticky top-4 -my-2 border-l border-line py-2 pl-6"
              >
                <IssueRail issue={issue} />
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
