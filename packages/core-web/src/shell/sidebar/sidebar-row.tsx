import { Tooltip } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { MouseEvent, ReactNode, Ref } from 'react';
import { isActivePath, useFrame, useFrameLink } from '../frame-context.ts';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/**
 * A sidebar row (docs/design/premium/kit.css, `.nav`): 30px, 8px padding, the icon in the
 * muted ink; the current row is a raised card with the icon in the accent. Hover is the shared
 * overlay; keyboard focus draws the ring inside the row so the sidebar never clips it.
 */
export const ROW = cx(
  'group/row relative flex h-7.5 min-w-0 items-center gap-2 rounded-control px-2 text-13 text-tx-2 no-underline',
  'cursor-pointer border-0 bg-transparent text-left font-sans hover:bg-hover hover:text-tx',
  'focus-ring-inset [&_svg]:text-tx-3',
  'aria-[current=page]:bg-card aria-[current=page]:font-medium aria-[current=page]:text-tx aria-[current=page]:shadow-e1',
  'aria-[current=page]:[&_svg]:text-acc',
);

/** A rail button: 36 by 32, the icon centred, the current one raised like a row. */
export const RAIL_BUTTON = cx(
  'relative grid h-8 w-9 shrink-0 place-items-center rounded-card border-0 bg-transparent p-0 text-tx-3 no-underline',
  'cursor-pointer hover:bg-hover hover:text-tx focus-ring',
  'aria-[current=page]:bg-card aria-[current=page]:text-acc aria-[current=page]:shadow-e1',
);

export interface SidebarRowProps {
  label: string;
  /** An icon name, or a drawn mark (a project tile, a status glyph). */
  icon: IconName | ReactNode;
  /** A link when set; otherwise a button that runs onSelect. */
  path?: string;
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
  /** Overrides the path match (a project row is current on any of its views). */
  active?: boolean;
  /** Only this exact path is current (Home). */
  exact?: boolean;
  /** An unread count, as an accent pill. */
  pill?: number;
  /** A quiet count, right-aligned in tabular figures. */
  count?: number;
  /** Anything at the end of the row: a badge, a caret, a hover action. */
  end?: ReactNode;
  /** The shortcut named in the rail's tooltip. */
  keys?: string;
  /** Indented under a parent row, with a guide line (a project's views). */
  child?: boolean;
  /** For tests and the bottom bar's own copies. */
  testId?: string;
  ref?: Ref<HTMLAnchorElement & HTMLButtonElement>;
}

function Mark({ icon, size }: { icon: SidebarRowProps['icon']; size: number }) {
  return typeof icon === 'string' ? <Icon name={icon as IconName} size={size} /> : <>{icon}</>;
}

/** One row of the sidebar, or one button of the rail, from the same description. */
export function SidebarRow(props: SidebarRowProps) {
  const { mode, pathname } = useFrame();
  const { label, icon, path, onSelect, active, exact, pill, count, end, keys, child, testId } =
    props;
  const link = useFrameLink(path ?? '');
  const current = active ?? (path ? isActivePath(pathname, path, exact) : false);
  const common = {
    'aria-current': current ? ('page' as const) : undefined,
    'data-testid': testId,
  };
  const linkProps = path
    ? {
        href: link.href,
        onClick: (event: MouseEvent<HTMLElement>) => {
          onSelect?.(event);
          link.onClick(event);
        },
      }
    : null;

  if (mode === 'rail') {
    const spoken = pill ? `${label}, ${pill}` : label;
    const inner = (
      <>
        <Mark icon={icon} size={17} />
        {pill ? (
          <span
            aria-hidden
            className="absolute top-1 right-1.5 size-2 rounded-full bg-acc ring-2 ring-side"
          />
        ) : null}
      </>
    );
    return (
      <Tooltip label={label} side="top" {...(keys ? { keys } : {})}>
        {linkProps ? (
          <a {...common} {...linkProps} aria-label={spoken} className={RAIL_BUTTON}>
            {inner}
          </a>
        ) : (
          <button
            type="button"
            {...common}
            aria-label={spoken}
            onClick={onSelect}
            className={RAIL_BUTTON}
          >
            {inner}
          </button>
        )}
      </Tooltip>
    );
  }

  const body = (
    <>
      {child ? (
        <span aria-hidden className="absolute top-0 bottom-0 left-4.5 border-l border-line" />
      ) : null}
      <Mark icon={icon} size={child ? 15 : 16} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {pill ? (
        <span className="ml-auto rounded-full bg-acc-fill px-1.5 text-11 leading-4.25 font-semibold text-on-acc tabular-nums">
          {pill}
        </span>
      ) : count !== undefined ? (
        <span className="ml-auto text-11 text-tx-3 tabular-nums">{count}</span>
      ) : null}
      {end}
    </>
  );
  const className = cx(ROW, child && 'h-7 pl-8.5');
  const spoken = pill ? `${label}, ${pill} unread` : undefined;
  return linkProps ? (
    <a {...common} {...linkProps} aria-label={spoken} className={className}>
      {body}
    </a>
  ) : (
    <button type="button" {...common} aria-label={spoken} onClick={onSelect} className={className}>
      {body}
    </button>
  );
}

export interface SidebarHeadingProps {
  label: string;
  /** The module's tile, drawn before the label. */
  tile?: ReactNode;
  /** The heading's own "+": a short label for its tooltip and what it runs. */
  add?: { label: string; onSelect: () => void } | undefined;
}

/**
 * A section heading (kit.css `.sec`): 11px semibold in the muted ink, the module's tile
 * before it and its "+" after, shown on hover and focus. The rail draws a short rule instead.
 */
export function SidebarHeading({ label, tile, add }: SidebarHeadingProps) {
  const { mode } = useFrame();
  if (mode === 'rail') {
    return <span aria-hidden className="my-2 w-6 shrink-0 border-t border-line" />;
  }
  return (
    <div className="group/heading mx-2 mt-3.5 mb-1 flex h-5 items-center gap-1.5 text-11 font-semibold tracking-[.01em] text-tx-3">
      {tile}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {add ? (
        <Tooltip label={add.label}>
          <button
            type="button"
            aria-label={add.label}
            onClick={add.onSelect}
            className="grid size-6 cursor-pointer place-items-center rounded-chip border-0 bg-transparent p-0 text-tx-3 opacity-0 group-hover/heading:opacity-100 hover:bg-hover hover:text-tx focus-ring focus-visible:opacity-100 pointer-coarse:opacity-100"
          >
            <Icon name="plus" size={14} />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
