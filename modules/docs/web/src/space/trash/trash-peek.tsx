import type { TrashItem } from '@bemmoly/module-docs/shared';
import { RichTextView, type RichTextDoc } from '@bemmoly/editor';
import { Button, Drawer, RelativeTime, Skeleton } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { pageTitle, useTrashedPage } from './use-trash.ts';

export interface TrashPeekProps {
  page: TrashItem | null;
  /** Docked beside the table on wide screens; over it on narrow ones. */
  variant: 'docked' | 'overlay';
  canPurge: boolean;
  restoring: boolean;
  onRestore: (page: TrashItem) => void;
  onDeleteForever: (page: TrashItem) => void;
  onClose: () => void;
}

/** A trashed page read before it is restored: who deleted it, then the page, read-only. */
export function TrashPeek({
  page,
  variant,
  canPurge,
  restoring,
  onRestore,
  onDeleteForever,
  onClose,
}: TrashPeekProps) {
  const detail = useTrashedPage(page?.id ?? null);
  const doc = detail.data?.snapshot as RichTextDoc | null | undefined;

  return (
    <Drawer
      open={Boolean(page)}
      onClose={onClose}
      variant={variant}
      label={page ? `${pageTitle(page)}, in the trash` : 'Page in the trash'}
      header={
        page && (
          <span className="flex min-w-0 items-center gap-2 text-13 font-semibold text-tx">
            <PageIcon value={page.icon} size={15} />
            <span className="truncate">{pageTitle(page)}</span>
          </span>
        )
      }
    >
      {page && (
        <>
          <p className="-mx-5 -mt-4 mb-0 flex items-center gap-2 border-b border-br2 bg-bg2 px-5 py-2.5 text-12h text-tx3">
            <Icon name="trash" size={14} />
            <span>
              Deleted {page.deletedBy ? `by ${page.deletedBy.name} ` : ''}
              {page.deletedAt && <RelativeTime iso={page.deletedAt} />} · read-only
            </span>
          </p>
          <h2 className="m-0 text-20 font-semibold tracking-display text-tx">{pageTitle(page)}</h2>
          {detail.isPending ? (
            <div className="flex flex-col gap-3" aria-label="Loading the page">
              {[92, 80, 64].map((width) => (
                <Skeleton key={width} width={`${width}%`} height={11} />
              ))}
            </div>
          ) : detail.isError ? (
            <p className="m-0 text-13 text-tx4">
              The page could not be read.{' '}
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 font-medium text-ac"
                onClick={() => void detail.refetch()}
              >
                Retry
              </button>
            </p>
          ) : doc?.content?.length ? (
            <RichTextView doc={doc} size="doc" />
          ) : (
            <p className="m-0 text-13 text-tx5">This page has nothing written in it.</p>
          )}
          <div className="sticky bottom-0 -mx-5 mt-auto -mb-6 flex items-center gap-2 border-t border-br2 bg-sf px-5 py-3">
            {canPurge && (
              <Button
                variant="ghost"
                className="text-danger! enabled:hover:text-danger!"
                icon={<Icon name="trash" size={14} />}
                onClick={() => onDeleteForever(page)}
              >
                Delete forever
              </Button>
            )}
            <Button
              variant="primary"
              className="ml-auto"
              loading={restoring}
              icon={<Icon name="undo" size={14} />}
              onClick={() => onRestore(page)}
            >
              Restore to {page.wasIn ? pageTitle(page.wasIn) : 'the top'}
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
}
