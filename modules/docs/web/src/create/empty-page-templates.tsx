import type { TemplateSummary } from '@bemmoly/module-docs/shared';
import { Kbd, Skeleton } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useSpace, useTemplates } from '../hooks/queries.ts';
import { TITLE_FIELD_ID } from '../page/body/page-title.tsx';
import { usePageScreen } from '../page/screen-context.ts';
import { ImportDialog } from '../transfer/import-dialog.tsx';
import { useFreshPages } from './fresh-pages.ts';
import {
  useApplyTemplate,
  useBodyEmpty,
  useDropAbandoned,
  useFocusTitle,
} from './use-empty-page.ts';

const COLUMNS = 4;
const TILE =
  'flex min-h-30 cursor-pointer flex-col gap-2 rounded-card border border-br bg-sf p-3 text-left font-sans outline-0 ' +
  'hover:border-br3 focus-visible:border-ac focus-visible:shadow-ring motion-safe:transition-[border-color,box-shadow]';

/** A drawn page in miniature: a heading bar and three lines, the same for every template. */
function Mini() {
  return (
    <span aria-hidden className="flex flex-col gap-1.5 rounded-sm bg-bg2 p-2.5">
      <span className="h-1.5 w-1/2 rounded-full bg-tx6/60" />
      {[90, 75, 82].map((width) => (
        <span key={width} className="h-1 rounded-full bg-tx6/35" style={{ width: `${width}%` }} />
      ))}
    </span>
  );
}

function TemplateTile({ template, onUse }: { template: TemplateSummary; onUse: () => void }) {
  return (
    <button type="button" className={TILE} onClick={onUse} data-template-tile>
      <Mini />
      <span className="flex items-center gap-2 text-13 font-semibold text-tx">
        <PageIcon value={template.icon} size={15} />
        <span className="truncate">{template.name}</span>
      </span>
      {template.description && (
        <span className="line-clamp-2 text-12 leading-body text-tx4">{template.description}</span>
      )}
    </button>
  );
}

/**
 * Inside a page with nothing in it: start writing, or pick one of the space's templates, or
 * import a file into the same place. Typing in the body takes them away; arrows move between
 * them and Enter uses one. A page made in place opens with the caret in its title.
 */
export function EmptyPageTemplates() {
  const { page, editable, editor } = usePageScreen();
  const fresh = useFreshPages((state) => state.ids.has(page.id));
  const empty = useBodyEmpty(editor);
  const templates = useTemplates(page.spaceId);
  const apply = useApplyTemplate(page);
  const space = useSpace(page.spaceKey).data;
  const [importing, setImporting] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  useFocusTitle(page.id, fresh, TITLE_FIELD_ID);
  useDropAbandoned(page, fresh, empty);

  if (!editable || page.deletedAt || !editor || !empty) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tiles = [...(grid.current?.querySelectorAll<HTMLElement>('[data-template-tile]') ?? [])];
    const at = tiles.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    tiles[Math.min(tiles.length - 1, Math.max(0, at + step))]?.focus();
  };

  return (
    <section
      aria-label="Start from a template"
      className="relative z-1 -mt-48 flex flex-col gap-2.5 pt-8"
    >
      <div className="flex items-center gap-3">
        <h2 className="m-0 flex-1 text-13 font-semibold text-tx">Start from a template</h2>
        <span className="hidden items-center gap-1.5 text-12 text-tx5 sm:flex">
          <Kbd keys="Up Down Left Right" /> choose <Kbd keys="Enter" /> use
        </span>
      </div>
      <div
        ref={grid}
        onKeyDown={onKeyDown}
        aria-busy={apply.isPending}
        className="grid grid-cols-2 gap-2.5 md:grid-cols-4"
      >
        {templates.isPending
          ? [0, 1, 2, 3].map((key) => <Skeleton key={key} height={120} className="rounded-card" />)
          : (templates.data ?? []).map((template) => (
              <TemplateTile
                key={template.id}
                template={template}
                onUse={() => apply.mutate(template.id)}
              />
            ))}
        {space && (
          <button
            type="button"
            data-template-tile
            className={`${TILE} items-center justify-center border-dashed text-tx2`}
            onClick={() => setImporting(true)}
          >
            <Icon name="upload" size={18} />
            <span className="text-13 font-medium">Import a file</span>
            <span className="text-12 text-tx5">Markdown or Confluence</span>
          </button>
        )}
      </div>
      {templates.isError && (
        <p className="m-0 text-12 text-tx5">
          Templates could not be loaded. Start writing instead.
        </p>
      )}
      {space && (
        <ImportDialog
          open={importing}
          onClose={() => setImporting(false)}
          space={space}
          parent={
            page.parentId
              ? { id: page.parentId, title: page.breadcrumbs.at(-1)?.title ?? '' }
              : null
          }
        />
      )}
    </section>
  );
}
