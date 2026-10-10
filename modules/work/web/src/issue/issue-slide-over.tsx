import {
  Drawer,
  EmptyState,
  epicColor,
  epicFill,
  FieldSwatch,
  IconButton,
  KeyChip,
  Tooltip,
  TypeGlyph,
} from '@bemmoly/ui';
import { useState } from 'react';
import { useIssue } from '../hooks/issue-detail.ts';
import { keepLinksInApp, navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { IssuePanelSkeleton } from '../skeletons/issue-skeleton.tsx';
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
  /** Steps to the issue above in the list (↑ or k); absent at the top. */
  onPrevious?: () => void;
  /** Steps to the issue below in the list (↓ or j); absent at the bottom. */
  onNext?: () => void;
}

/**
 * The issue in the design system's drawer, so the Board can open one without leaving the
 * page: the epic and key trail, open-full-page and more, then the Issue page's body at panel
 * size with Details under the description, as the mock lays it out.
 */
export function IssueSlideOver({
  issueKey: openKey,
  onClose,
  variant = 'docked',
  onPrevious,
  onNext,
}: IssueSlideOverProps) {
  // The panel slides out after it is closed; it keeps showing the issue it had until it is gone.
  const [lastKey, setLastKey] = useState(openKey);
  if (openKey !== null && openKey !== lastKey) setLastKey(openKey);
  const issueKey = openKey ?? lastKey;
  const query = useIssue(issueKey ?? undefined);
  const issue = query.data;
  const open = openKey !== null;

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
                <FieldSwatch
                  colorClassName={epicFill(epicColor(issue.parent.color, issue.parent.id))}
                />
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
            {(onPrevious || onNext) && (
              <>
                <Tooltip label="Previous issue" keys="K">
                  <IconButton
                    label="Previous issue"
                    icon="arrow-up"
                    size="xs"
                    disabled={!onPrevious}
                    onClick={onPrevious}
                  />
                </Tooltip>
                <Tooltip label="Next issue" keys="J">
                  <IconButton
                    label="Next issue"
                    icon="arrow-down"
                    size="xs"
                    disabled={!onNext}
                    onClick={onNext}
                  />
                </Tooltip>
              </>
            )}
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
        {query.isPending && <IssuePanelSkeleton />}
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
