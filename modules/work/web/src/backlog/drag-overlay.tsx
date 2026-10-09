import type { Issue } from '@bemmoly/module-work/shared';
import { KeyChip } from '@bemmoly/ui';
import type { RefObject } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import type { DropTarget } from './move.ts';

export interface DragOverlayProps {
  previewRef: RefObject<HTMLDivElement | null>;
  issueById: (id: string) => Issue | undefined;
  containerName: (id: string) => string;
}

function describe(
  target: DropTarget | null,
  issueById: DragOverlayProps['issueById'],
  containerName: DragOverlayProps['containerName'],
): string {
  if (!target) return '';
  const where = containerName(target.containerId);
  const above = target.beforeId ? issueById(target.beforeId) : undefined;
  return above ? `Above ${above.key} in ${where}.` : `At the end of ${where}.`;
}

/**
 * The chip that follows the pointer while rows are dragged (positioned by
 * the drag hook, not by renders) and the polite announcement of a keyboard
 * move: what was picked up and where it would land.
 */
export function DragOverlay({ previewRef, issueById, containerName }: DragOverlayProps) {
  const drag = useBacklogUi((state) => state.drag);
  const first = drag ? issueById(drag.ids[0] ?? '') : undefined;
  const more = drag ? drag.ids.length - 1 : 0;
  const picked = drag
    ? `${drag.ids.length === 1 && first ? first.key : `${drag.ids.length} issues`}`
    : '';
  const announcement =
    drag?.mode === 'keyboard'
      ? `Picked up ${picked}. ${describe(drag.target, issueById, containerName)} ` +
        'Arrow keys move, space drops, Escape cancels.'
      : '';

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {drag?.mode === 'pointer' && first && (
        <div
          ref={previewRef}
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-80 items-center gap-2 rounded-sm border border-br bg-sf px-2.5 py-1.5 text-13 text-tx shadow-menu"
          style={{ transform: 'translate(-9999px, 0)' }}
        >
          <KeyChip issueKey={first.key} />
          <span className="truncate">{first.title}</span>
          {more > 0 && (
            <span className="shrink-0 rounded-pill bg-ac-fill px-1.5 font-mono text-11 font-medium text-on-ac">
              +{more}
            </span>
          )}
        </div>
      )}
    </>
  );
}
