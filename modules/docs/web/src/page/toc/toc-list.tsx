import { cx } from '../cx.ts';
import type { PageEditor } from '../screen-context.ts';
import { goToHeading, type OutlineEntry } from './use-outline.ts';

export interface TocListProps {
  outline: readonly OutlineEntry[];
  active: string | null;
  editor: PageEditor | null;
  /** Marks the heading jumped to as the one being read. */
  onPin?: (id: string) => void;
  /** After a jump, e.g. to close the panel it sits in on a phone. */
  onJump?: () => void;
  className?: string;
}

const INDENT = ['pl-3', 'pl-6', 'pl-9'] as const;

/**
 * "On this page": the outline as links to the headings' anchors, the one being read marked
 * with the accent bar the sidebar tree uses for the open page. A plain click scrolls smoothly
 * inside the page; the href still works for a new tab.
 */
export function TocList({ outline, active, editor, onPin, onJump, className }: TocListProps) {
  if (outline.length === 0) return null;
  const top = Math.min(...outline.map((entry) => entry.level));
  return (
    <nav aria-label="On this page" className={cx('flex flex-col gap-2', className)}>
      <span className="text-11 font-medium tracking-caps text-tx5 uppercase">On this page</span>
      <ol className="m-0 flex list-none flex-col border-l border-br-row p-0">
        {outline.map((entry) => {
          const current = entry.id === active;
          return (
            <li key={`${entry.id}:${entry.pos}`}>
              <a
                href={`#${entry.id}`}
                aria-current={current ? 'location' : undefined}
                onClick={(event) => {
                  if (!editor || event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  goToHeading(editor, entry);
                  onPin?.(entry.id);
                  onJump?.();
                }}
                className={cx(
                  '-ml-px block truncate border-l-2 py-1 pr-2 text-12h leading-snug no-underline',
                  'motion-safe:transition-colors focus-visible:shadow-ring focus-visible:outline-0',
                  INDENT[Math.min(entry.level - top, 2)],
                  current
                    ? 'border-ac font-medium text-tx'
                    : 'border-transparent text-tx4 hover:text-tx2',
                )}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
