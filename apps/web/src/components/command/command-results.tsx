import type { CommandGroup, CommandItem } from '@bemmoly/core-web';
import { initials } from '@bemmoly/core-web';

interface CommandResultsProps {
  listId: string;
  groups: readonly CommandGroup<CommandItem>[];
  visible: readonly CommandItem[];
  activeIndex: number;
  optionId: (index: number) => string;
  onHover: (index: number) => void;
  onOpen: (index: number) => void;
  hidden?: boolean;
}

const GLYPH: Record<string, { glyph: string; shape: string; tone: string }> = {
  People: { glyph: '', shape: 'rounded-full', tone: 'bg-ac-av text-ac' },
  Settings: { glyph: '⚙', shape: 'rounded-chip', tone: 'bg-tx4 text-on-ac' },
  Actions: { glyph: '›', shape: 'rounded-chip', tone: 'bg-ac text-on-ac' },
};

/** Grouped results from the Command mock: 16px glyph, title, meta; the active row is tinted. */
export function CommandResults({
  listId,
  groups,
  visible,
  activeIndex,
  optionId,
  onHover,
  onOpen,
  hidden,
}: CommandResultsProps) {
  if (hidden) return <div id={listId} role="listbox" hidden />;
  if (visible.length === 0) {
    return (
      <div id={listId} role="listbox" className="px-4 py-6 text-center text-small text-tx5">
        Nothing matches. Try a person's name or a settings page.
      </div>
    );
  }
  return (
    <div
      id={listId}
      role="listbox"
      aria-label="Results"
      className="flex max-h-105 flex-col overflow-auto pb-1.5"
    >
      {groups.map((group) => (
        <div key={group.name} role="group" aria-label={group.name}>
          <div className="px-4 pt-2.5 pb-1 text-mono font-medium tracking-[.06em] text-tx5 uppercase">
            {group.name}
          </div>
          {group.items.map((item) => {
            const index = visible.indexOf(item);
            const active = index === activeIndex;
            const look = GLYPH[group.name] ?? (GLYPH['Actions'] as (typeof GLYPH)[string]);
            return (
              <div
                key={item.id}
                id={optionId(index)}
                role="option"
                aria-selected={active}
                onMouseMove={() => onHover(index)}
                onClick={() => onOpen(index)}
                className={`flex cursor-pointer items-center gap-2.5 px-4 py-2 text-tx ${active ? 'bg-ac-bg' : 'bg-sf'}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-4 shrink-0 place-items-center text-glyph leading-none font-semibold ${look.shape} ${look.tone}`}
                >
                  {group.name === 'People' ? initials(item.title).slice(0, 1) : look.glyph}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.subtitle ? (
                  <span className="text-caption text-tx5">{item.subtitle}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
