import type { ImportedPage } from '@bemmoly/module-docs/shared';
import { Select } from '@bemmoly/ui';
import { Icon, PageIcon, type IconName } from '@bemmoly/ui/icons';
import { useSpaceTree } from '../space/use-space-tree.ts';
import type { ImportFormat } from './read-files.ts';

const SOURCES: readonly { id: ImportFormat; label: string; hint: string; icon: IconName }[] = [
  { id: 'markdown', label: 'Markdown', hint: '.md files or a folder', icon: 'doc' },
  {
    id: 'confluence',
    label: 'Confluence export',
    hint: 'The HTML pages of a space export',
    icon: 'layers',
  },
];

/** The two sources as tiles that say what each one takes. */
export function SourceTiles({
  value,
  onChange,
}: {
  value: ImportFormat;
  onChange: (format: ImportFormat) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Import from"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {SOURCES.map((source) => {
        const chosen = source.id === value;
        return (
          <button
            key={source.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={source.label}
            onClick={() => onChange(source.id)}
            className={
              'flex cursor-pointer flex-col gap-0.5 rounded-card border p-3 text-left font-sans outline-0 ' +
              'focus-visible:shadow-ring motion-safe:transition-[border-color,box-shadow] ' +
              (chosen ? 'border-ac bg-ac-bg shadow-ring' : 'border-br bg-sf hover:border-br3')
            }
          >
            <span className={`flex items-center gap-2 ${chosen ? 'text-ac' : 'text-tx3'}`}>
              <Icon name={source.icon} size={15} />
              <span className="text-13 font-semibold text-tx">{source.label}</span>
            </span>
            <span className="text-12 text-tx4">{source.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

const TOP = '';

/**
 * Where the pages land: the top of the space or under any page the tree shows. Opening a
 * page in the sidebar puts its children in the list too.
 */
export function ParentPicker({
  spaceKey,
  spaceName,
  value,
  onChange,
}: {
  spaceKey: string;
  spaceName: string;
  value: { id: string; title: string } | null;
  onChange: (parent: { id: string; title: string } | null) => void;
}) {
  const tree = useSpaceTree(spaceKey);
  const rows = tree.items.filter((row) => !row.loading);
  const options = [
    { value: TOP, label: `Top of ${spaceName}`, icon: <Icon name="layers" size={14} /> },
    ...rows.map((row) => ({
      value: row.id,
      label: `${' '.repeat(row.depth)}${row.title || 'Untitled'}`,
      icon: <PageIcon value={row.icon} size={14} />,
    })),
  ];
  if (value && !rows.some((row) => row.id === value.id)) {
    options.push({
      value: value.id,
      label: value.title || 'Untitled',
      icon: <PageIcon size={14} />,
    });
  }
  return (
    <label className="flex flex-wrap items-center gap-2 text-12h text-tx4">
      Put the pages under
      <Select
        size="sm"
        aria-label="Put the pages under"
        value={value?.id ?? TOP}
        options={options}
        onChange={(event) =>
          onChange(
            event.value === TOP ? null : { id: event.value, title: event.option.label.trim() },
          )
        }
      />
    </label>
  );
}

/** What each file became, with the macros that had to become placeholders. */
export function ImportResults({ pages }: { pages: readonly ImportedPage[] }) {
  return (
    <ul
      aria-label="Imported pages"
      className="m-0 flex max-h-64 list-none flex-col overflow-auto p-0 text-12h"
    >
      {pages.map((page) => (
        <li
          key={page.id}
          className="flex items-center gap-2.5 border-b border-br-row py-2 last:border-b-0"
        >
          <Icon name="check" size={14} className="shrink-0 text-ok" />
          <span className="min-w-0 flex-1 truncate text-tx2">{page.path}</span>
          {page.placeholders > 0 && (
            <span className="shrink-0 rounded-chip bg-warn-bg px-1.5 py-px text-11 font-medium text-warn-fg">
              {page.placeholders} {page.placeholders === 1 ? 'macro' : 'macros'} kept as
              placeholders
            </span>
          )}
          <span className="flex max-w-50 shrink-0 items-center gap-1 text-tx5">
            <Icon name="arrow" size={12} label="became" />
            <span className="truncate">{page.title || 'Untitled'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
