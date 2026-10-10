import { Button } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { cx } from '../cx.ts';
import { usePageScreen } from '../screen-context.ts';
import { useChangeStatus, useTrashPage } from '../use-page-actions.ts';

const TONES = {
  warn: 'bg-amber-50 text-amber-tx',
  quiet: 'bg-side text-tx-2',
} as const;

function Bar({
  tone,
  icon,
  children,
  action,
}: {
  tone: keyof typeof TONES;
  icon: IconName;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cx(
        'flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-1.5 text-13 sm:px-5',
        TONES[tone],
      )}
    >
      <Icon name={icon} size={14} />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

function TrashedBanner() {
  const { page } = usePageScreen();
  const { restore } = useTrashPage(page);
  return (
    <Bar
      tone="warn"
      icon="trash"
      action={
        <Button size="xs" loading={restore.isPending} onClick={() => restore.mutate()}>
          Restore
        </Button>
      }
    >
      This page is in the trash. Restore it to edit it and put it back in the tree.
    </Bar>
  );
}

function ArchivedBanner() {
  const { page, collab } = usePageScreen();
  const change = useChangeStatus(page.id);
  const mayEdit = collab.status !== 'read-only' && collab.status !== 'denied';
  return (
    <Bar
      tone="quiet"
      icon="alert"
      action={
        mayEdit && (
          <Button
            size="xs"
            loading={change.isPending}
            onClick={() => change.mutate({ status: 'draft' })}
          >
            Move back to draft
          </Button>
        )
      }
    >
      Archived. It reads as it was left; move it back to draft to change it.
    </Bar>
  );
}

/**
 * One line over the body when the page is not an ordinary editable page: in the trash, archived,
 * offline, or open to read only. Saving itself is never announced here; the header does that.
 */
export function PageBanner() {
  const { readOnly, collab, page } = usePageScreen();
  if (readOnly === 'trashed') return <TrashedBanner />;
  if (readOnly === 'archived') return <ArchivedBanner />;
  if (collab.status === 'offline') {
    return (
      <Bar tone="warn" icon="alert">
        You are offline. Keep writing: your changes stay here and merge when you reconnect.
      </Bar>
    );
  }
  if (readOnly === 'viewer') {
    return (
      <Bar tone="quiet" icon="doc">
        You can read this page. Ask an editor of {page.spaceKey} for edit access to change it.
      </Bar>
    );
  }
  return null;
}
