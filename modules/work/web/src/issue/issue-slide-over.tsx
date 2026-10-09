import {
  Drawer,
  EmptyState,
  FieldSwatch,
  IconButton,
  KeyChip,
  Skeleton,
  TypeGlyph,
} from '@bemmoly/ui';
import { useIssue } from '../hooks/issue-detail.ts';
import { keepLinksInApp, navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { IssueBody } from './issue-body.tsx';
import { IssueMoreMenu } from './issue-header.tsx';
import { typeGlyph } from './vocabulary.ts';

export interface IssueSlideOverProps {
  /** The issue to show; null closes the panel. */
  issueKey: string | null;
  onClose: () => void;
  /**
   * docked: the Board mock's 400px column beside the board. overlay: the same panel over a
   * scrim, for narrow screens and pages without room beside them.
   */
  variant?: 'docked' | 'overlay';
}

/**
 * The issue in the design system's drawer, so the Board can open one without leaving the
 * page: the epic and key trail, open-full-page and more, then the Issue page's body at panel
 * size with Details under the description, as the mock lays it out.
 */
export function IssueSlideOver({ issueKey, onClose, variant = 'docked' }: IssueSlideOverProps) {
  const query = useIssue(issueKey ?? undefined);
  const issue = query.data;
  const open = issueKey !== null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      variant={variant}
      label={issueKey ? `${issueKey} details` : 'Issue details'}
      header={
        issue ? (
          <>
            {issue.parent && (
              <>
                <FieldSwatch colorClassName="bg-ac" />
                <span className="truncate">{issue.parent.title}</span>
                <span aria-hidden>/</span>
              </>
            )}
            <TypeGlyph type={typeGlyph(issue.type)} />
            <KeyChip issueKey={issue.key} size="md" />
          </>
        ) : (
          issueKey && <KeyChip issueKey={issueKey} size="md" />
        )
      }
      actions={
        issue && (
          <>
            <IconButton
              label="Open full page"
              icon="expand"
              size="xs"
              onClick={() => navigateTo(workPaths.issue(issue.key))}
            />
            <IssueMoreMenu issue={issue} size="panel" onDeleted={onClose} />
          </>
        )
      }
    >
      {/*
       * Links inside the panel stay in the page, as the shell's own links do. A block of its own
       * keeps the clipped cards from shrinking inside the drawer's scrolling column.
       */}
      <div className="flex flex-col gap-4.5" onClick={keepLinksInApp}>
        {query.isPending && (
          <div aria-busy className="flex flex-col gap-4">
            <Skeleton height={24} width="70%" />
            <Skeleton shape="block" height={160} />
          </div>
        )}
        {query.isError && (
          <EmptyState
            title={`${issueKey ?? 'The issue'} could not be opened`}
            description={query.error.message}
          />
        )}
        {issue && <IssueBody issue={issue} size="panel" />}
      </div>
    </Drawer>
  );
}
