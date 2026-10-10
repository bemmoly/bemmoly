import { STATUS_TRANSITIONS, type PageStatus } from '@bemmoly/module-docs/shared';
import { Menu, MenuItem, PAGE_STATUS_STAGES, PageStatusMark, StatusGlyph } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useSession } from '../../shared/people.ts';
import { usePageScreen } from '../screen-context.ts';
import { useChangeStatus } from '../use-page-actions.ts';
import { ReviewersDialog } from './reviewers-dialog.tsx';

/** What each move is called from where the page is now. */
const VERB: Record<PageStatus, string> = {
  draft: 'Move back to draft',
  in_review: 'Request review…',
  published: 'Publish',
  archived: 'Archive',
};

/** The order the menu lists them in, whatever the page is now. */
const ORDER: readonly PageStatus[] = ['in_review', 'published', 'draft', 'archived'];

/** The server's rule: publishing and archiving need docs.page.publish. */
const NEEDS_PUBLISH: readonly PageStatus[] = ['published', 'archived'];

/** The status beside the trail: its glyph and name in a quiet outlined button. */
const TRIGGER =
  'inline-flex h-7 items-center gap-1 rounded-control border-0 bg-transparent px-2 font-sans text-13 text-tx-2 shadow-[inset_0_0_0_1px_var(--line)]';

/**
 * The page's status right after the header's trail, as a menu of the moves the server allows from here.
 * Asking for review picks reviewers first; the rest apply at once. A person who may not
 * publish sees Publish and Archive greyed with the reason, rather than an error after.
 */
export function StatusMenu() {
  const { page, readOnly } = usePageScreen();
  const { can, user } = useSession();
  const change = useChangeStatus(page.id);
  const [picking, setPicking] = useState(false);
  const status = page.status;
  const moves = ORDER.filter((next) => STATUS_TRANSITIONS[status].includes(next));
  const locked = readOnly === 'trashed' || readOnly === 'viewer';

  if (locked) return <PageStatusMark status={status} className={`${TRIGGER} cursor-default`} />;

  return (
    <>
      <Menu
        trigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label={`Status: ${status.replace('_', ' ')}. Change status`}
            className={`${TRIGGER} cursor-pointer hover:bg-hover hover:text-tx focus-ring aria-expanded:bg-hover`}
          >
            {/* On a phone the glyph alone keeps room for the page's name. */}
            <PageStatusMark status={status} className="max-sm:hidden" />
            <StatusGlyph
              stage={PAGE_STATUS_STAGES[status]}
              size={13}
              decorative
              className="sm:hidden"
            />
            <Icon name="caret" size={12} className="text-tx-3" />
          </button>
        )}
      >
        {moves.map((next) => {
          const allowed = !NEEDS_PUBLISH.includes(next) || can('docs.page.publish');
          return (
            <MenuItem
              key={next}
              disabled={!allowed || change.isPending}
              icon={<StatusGlyph stage={PAGE_STATUS_STAGES[next]} size={14} decorative />}
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
