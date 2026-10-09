import { DocEditor } from '@bemmoly/editor';
import { Skeleton } from '@bemmoly/ui';
import type { PageDetail } from '../../../shared/pages.ts';
import type { CollabState } from '../collab/session.ts';
import { useCollabPage } from '../collab/use-collab-page.ts';
import { useCollabUser } from '../collab/use-collab-user.ts';

/** The connection in a few words, as the mock's header puts it ("Saved · Priya is editing"). */
export function collabStatusLine({ status, unsynced, peers }: CollabState): string {
  const others =
    peers.length === 0
      ? ''
      : ` · ${peers.length === 1 ? `${peers[0]!.name} is editing` : `${peers.length} people editing`}`;
  switch (status) {
    case 'connecting':
      return 'Connecting…';
    case 'live':
      return `${unsynced > 0 ? 'Saving…' : 'Saved'}${others}`;
    case 'offline':
      return 'Offline · your changes sync when you reconnect';
    case 'read-only':
      return `Read only${others}`;
    case 'denied':
      return 'You do not have access to this page';
    case 'local':
      return 'Not connected to a collaboration server · changes stay in this tab';
  }
}

/**
 * The page body, edited live with everyone who has it open. A minimal mount for the
 * collaboration layer; the editor screen (header, outline, comments) builds on the same hook.
 */
export function PageBody({ page }: { page: PageDetail }) {
  const user = useCollabUser();
  const collab = useCollabPage(page.id, user, page.snapshot);
  return (
    <section aria-label="Page body" className="flex flex-col gap-2">
      <p role="status" className="m-0 text-12 text-tx4" data-collab-status={collab.status}>
        {collabStatusLine(collab)}
      </p>
      {collab.extensions ? (
        <DocEditor
          key={collab.editorKey}
          label="Page body"
          extensions={collab.extensions}
          editable={collab.editable}
          contentClassName="min-h-60"
        />
      ) : (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton width="75%" />
          <Skeleton width="50%" />
        </div>
      )}
    </section>
  );
}
