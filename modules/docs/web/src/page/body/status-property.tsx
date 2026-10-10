import { STATUS_TRANSITIONS, type PageStatus } from '@bemmoly/module-docs/shared';
import { Menu, MenuItem, PAGE_STATUS_LABELS, StatusGlyph, type StatusStage } from '@bemmoly/ui';
import { useState } from 'react';
import { useSession } from '../../shared/people.ts';
import { ReviewersDialog } from '../header/reviewers-dialog.tsx';
import { usePageScreen } from '../screen-context.ts';
import { useChangeStatus } from '../use-page-actions.ts';
import { PROP } from './property.tsx';

/** Page status in the status glyph family: draft is to do, in review is in progress, published is done. */
export const PAGE_STAGE: Record<PageStatus, StatusStage> = {
  draft: 'todo',
  in_review: 'review',
  published: 'done',
  archived: 'wont',
};

const VERB: Record<PageStatus, string> = {
  draft: 'Move back to draft',
  in_review: 'Request review…',
  published: 'Publish',
  archived: 'Archive',
};

const ORDER: readonly PageStatus[] = ['in_review', 'published', 'draft', 'archived'];

/** The server's rule: publishing and archiving need docs.page.publish. */
const NEEDS_PUBLISH: readonly PageStatus[] = ['published', 'archived'];

export function StatusLook({ status }: { status: PageStatus }) {
  return (
    <>
      <StatusGlyph stage={PAGE_STAGE[status]} size={14} decorative />
      <span>{PAGE_STATUS_LABELS[status]}</span>
    </>
  );
}

/**
 * The status as the first property: its glyph and name, a menu of the moves the server
 * allows from here. Asking for review picks reviewers first; the rest apply at once.
 */
export function StatusProperty() {
  const { page, readOnly } = usePageScreen();
  const { can, user } = useSession();
  const change = useChangeStatus(page.id);
  const [picking, setPicking] = useState(false);
  const status = page.status;
  // An archived page is read-only, yet its status can still move it out of the archive.
  if (readOnly === 'trashed' || readOnly === 'viewer') {
    return (
      <span className={PROP}>
        <StatusLook status={status} />
      </span>
    );
  }
  const moves = ORDER.filter((next) => STATUS_TRANSITIONS[status].includes(next));
  return (
    <>
      <Menu
        trigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label={`Status: ${PAGE_STATUS_LABELS[status]}. Change status`}
            className={PROP}
          >
            <StatusLook status={status} />
          </button>
        )}
      >
        {moves.map((next) => {
          const allowed = !NEEDS_PUBLISH.includes(next) || can('docs.page.publish');
          return (
            <MenuItem
              key={next}
              disabled={!allowed || change.isPending}
              icon={<StatusGlyph stage={PAGE_STAGE[next]} size={14} decorative />}
              hint={allowed ? undefined : 'Needs publish rights'}
              onSelect={() => {
                if (next === 'in_review') setPicking(true);
                else change.mutate({ status: next });
              }}
            >
              {VERB[next]}
            </MenuItem>
          );
        })}
      </Menu>
      <ReviewersDialog
        open={picking}
        spaceKey={page.spaceKey}
        initial={page.reviewers}
        exclude={[page.ownerId, user?.id].filter((id): id is string => Boolean(id))}
        confirmLabel="Request review"
        required
        error={change.error?.message ?? null}
        pending={change.isPending}
        onClose={() => {
          change.reset();
          setPicking(false);
        }}
        onConfirm={(reviewers) =>
          change.mutate({ status: 'in_review', reviewers }, { onSuccess: () => setPicking(false) })
        }
      />
    </>
  );
}
