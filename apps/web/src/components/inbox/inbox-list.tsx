import { actorLabel } from '@bemmoly/core-web';
import type { Notification } from '@bemmoly/shared';
import { Avatar, avatarHue, RelativeTime } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useRef } from 'react';
import type { DayGroup } from './inbox-model.ts';

/** What the notification is about, by the module that sent it, in that module's colour. */
export function TargetMark({ item, size = 14 }: { item: Notification; size?: number }) {
  const from = (area: string) =>
    item.target.kind.startsWith(`${area}.`) || item.target.url?.startsWith(`/${area}/`);
  if (from('docs')) return <Icon name="doc" size={size} className="text-brand-2" />;
  if (from('work')) return <Icon name="board" size={size} className="text-brand-1" />;
  return <Icon name="bell" size={size} className="text-tx-3" />;
}

export const rowId = (id: string) => `inbox-row-${id}`;

function Row({
  item,
  selected,
  onSelect,
}: {
  item: Notification;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  const who = actorLabel(
    item.actors.map((actor) => actor.name),
    item.actorCount,
  );
  return (
    <div
      ref={ref}
      id={rowId(item.id)}
      role="option"
      aria-selected={selected}
      data-unread={!item.read || undefined}
      onClick={onSelect}
      className="grid cursor-pointer grid-cols-[26px_minmax(0,1fr)_auto] gap-2.5 px-4.5 py-2.5 hover:bg-hover aria-selected:bg-acc-50 aria-selected:shadow-[inset_2px_0_0_var(--acc)]"
    >
      <Avatar
        name={item.actors[0]?.name ?? 'Bemmoly'}
        hue={avatarHue(item.actors[0]?.id ?? item.id)}
        size={26}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-13">
          <b className="font-medium">{who}</b> <span className="text-tx-3">{item.verb}</span>
        </span>
        <span
          className={`flex min-w-0 items-center gap-1.5 text-13 ${item.read ? 'text-tx-2' : 'font-medium text-tx'}`}
        >
          <TargetMark item={item} />
          <span className="truncate">{item.target.label ?? item.summary}</span>
        </span>
        {item.body ? <span className="truncate text-13 text-tx-3">{item.body}</span> : null}
      </div>
      <div className="flex flex-col items-end gap-2">
        <RelativeTime iso={item.createdAt} className="text-12 text-tx-3" />
        {item.read ? null : <span aria-label="Unread" className="size-1.75 rounded-full bg-acc" />}
      </div>
    </div>
  );
}

export interface InboxListProps {
  groups: readonly DayGroup[];
  selectedId: string | null;
  onSelect: (item: Notification) => void;
}

/** The list you work through, grouped by day; the selected row carries the accent edge. */
export function InboxList({ groups, selectedId, onSelect }: InboxListProps) {
  return (
    <div
      role="listbox"
      aria-label="Notifications"
      tabIndex={0}
      aria-activedescendant={selectedId ? rowId(selectedId) : undefined}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6 focus-ring-inset"
    >
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={group.label}>
          <div className="px-4.5 pt-3.5 pb-1.5 text-12 font-semibold text-tx-3">{group.label}</div>
          {group.items.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
