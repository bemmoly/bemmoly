import { STATUS_TRANSITIONS, type PageStatus } from '@bemmoly/module-docs/shared';
import { Menu, MenuItem, PageStatusPill } from '@bemmoly/ui';
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

/**
 * The status pill beside the breadcrumbs, as a menu of the moves the server allows from here.
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

  if (locked) return <PageStatusPill status={status} className="ml-3.5" />;

  return (
    <>
      <Menu
        className="ml-3.5"
        trigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label={`Status: ${status.replace('_', ' ')}. Change status`}
            className="inline-flex cursor-pointer items-center rounded-chip border-0 bg-transparent p-0 focus-visible:shadow-ring focus-visible:outline-0"
          >
            <PageStatusPill status={status} className="hover:brightness-95" />
          </button>
        )}
      >
        {moves.map((next) => {
          const allowed = !NEEDS_PUBLISH.includes(next) || can('docs.page.publish');
          return (
            <MenuItem
              key={next}
              disabled={!allowed || change.isPending}
              icon={<PageStatusPill status={next} className="w-21 justify-center" />}
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
        initial={page.reviewers}
        exclude={[page.ownerId, user?.id].filter((id): id is string => Boolean(id))}
        confirmLabel="Request review"
        pending={change.isPending}
        onClose={() => setPicking(false)}
        onConfirm={(reviewers) =>
          change.mutate({ status: 'in_review', reviewers }, { onSuccess: () => setPicking(false) })
        }
      />
    </>
  );
}
