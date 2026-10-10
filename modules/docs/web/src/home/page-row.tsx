import type { PageStatus } from '@bemmoly/module-docs/shared';
import {
  Avatar,
  EntityTile,
  PAGE_STATUS_LABELS,
  RelativeTime,
  SPACE_TONE_HUES,
  spaceTone,
  StatusGlyph,
  type EntityTileProps,
  type StatusStage,
} from '@bemmoly/ui';
import { PageIcon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { docsPaths } from '../shared/navigation.ts';

/** A page's status as the status circle Work draws: grey, half blue, green. */
const STAGE: Record<PageStatus, StatusStage> = {
  draft: 'todo',
  in_review: 'review',
  published: 'done',
  archived: 'wont',
};

export function PageStatusGlyph({ status, size = 13 }: { status: PageStatus; size?: number }) {
  return <StatusGlyph stage={STAGE[status]} label={PAGE_STATUS_LABELS[status]} size={size} />;
}

/** A space's tile: one letter on its colour, the same as in the sidebar. */
export function SpaceMark({
  space,
  size = 16,
}: {
  space: { key: string; name: string; color: string | null };
  size?: number;
}) {
  const look = SPACE_TONE_HUES[spaceTone(space.key, space.color)];
  const tone: Partial<EntityTileProps> =
    look === 'accent' || look === 'ink' ? { tone: look } : { hue: look };
  return <EntityTile name={space.name} size={size} decorative {...tone} />;
}

export interface PageRowProps {
  page: { id: string; title: string; icon: string | null; status: PageStatus };
  /** The space tile and name, or another place ("Platform"). */
  place: ReactNode;
  person: { name: string } | null;
  when: string;
  /** "Waiting since" and the like, in place of the time. */
  whenLabel?: ReactNode;
}

/**
 * One row of the home and overview lists: icon, title, status circle, where it lives, who
 * and when, on one grid so every row lines up. The whole row is the link.
 */
export function PageRow({ page, place, person, when, whenLabel }: PageRowProps) {
  return (
    <a
      href={docsPaths.page(page.id)}
      data-list-row
      className="grid min-h-10 grid-cols-[18px_minmax(0,1fr)_16px_22px_64px] items-center gap-3 border-b border-line-2 px-3.5 text-13 text-tx no-underline outline-0 last:border-b-0 hover:bg-hover focus-visible:bg-hover focus-visible:shadow-[inset_2px_0_0_var(--color-ac)] sm:grid-cols-[18px_minmax(0,1fr)_16px_140px_22px_72px]"
    >
      <PageIcon value={page.icon} size={16} className="text-tx-3" />
      <span className="truncate font-medium">{page.title || 'Untitled'}</span>
      <PageStatusGlyph status={page.status} />
      <span className="hidden min-w-0 items-center gap-1.5 truncate text-13 text-tx-2 sm:flex">
        {place}
      </span>
      {person ? <Avatar name={person.name} size={20} /> : <span />}
      <span className="text-right text-12 text-tx-3 tabular-nums">
        {whenLabel ?? <RelativeTime iso={when} />}
      </span>
    </a>
  );
}

/** ↑↓ and j k move between the rows of a list; Enter follows the link as usual. */
export function moveInList(event: React.KeyboardEvent<HTMLElement>) {
  const keys: Record<string, number> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };
  const step = keys[event.key];
  if (step === undefined || event.metaKey || event.ctrlKey || event.altKey) return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-list-row]')];
  const at = rows.indexOf(document.activeElement as HTMLElement);
  if (at < 0 && step < 0) return;
  event.preventDefault();
  rows[Math.min(rows.length - 1, Math.max(0, at + step))]?.focus();
}
