import { IconButton, Tooltip } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { isActivePath, useFrame, useFrameLink } from './frame-context.ts';
import { SwitcherMenu, type SwitcherItem } from './switcher-menu.tsx';

export interface PageCrumb {
  label: string;
  /** Every crumb links, the current page's included, so the trail is always a way back. */
  path: string;
  /** A tile or icon before the label. */
  icon?: ReactNode;
  /** A crumb that switches (the project): the places it offers, searchable. */
  switcher?: {
    items: readonly SwitcherItem[];
    currentId?: string;
    placeholder: string;
    footer?: readonly SwitcherItem[];
  };
}

export interface PageTab {
  id: string;
  label: string;
  icon: IconName;
  path: string;
  /** The tab's shortcut, named in its tooltip ("G B"). */
  keys?: string;
}

export interface PageHeaderProps {
  crumbs: readonly PageCrumb[];
  /** Views of the same thing (Board, Backlog), or a settings area's sections. */
  tabs?: readonly PageTab[];
  /** The current tab; otherwise the one whose path the address is in. */
  activeTab?: string;
  /** Right-aligned buttons. Screens add their own with <HeaderActions>. */
  actions?: ReactNode;
  /** Who else is here, before the actions. */
  presence?: ReactNode;
  /** Right after the trail, about the thing it ends on: a document's status menu. */
  trailing?: ReactNode;
  /** Extra classes on the bar, for a screen that dims it (a document fades it while typing). */
  className?: string;
}

const CRUMB =
  'flex min-w-0 items-center gap-1.5 rounded-chip px-1.5 py-0.75 whitespace-nowrap text-tx-2 no-underline hover:bg-hover hover:text-tx focus-ring';

function CrumbLink({ crumb, here }: { crumb: PageCrumb; here: boolean }) {
  const link = useFrameLink(crumb.path);
  const body = (
    <>
      {crumb.icon}
      <span className="truncate">{crumb.label}</span>
    </>
  );
  if (crumb.switcher) {
    const { items, currentId, placeholder, footer } = crumb.switcher;
    return (
      <SwitcherMenu
        items={items}
        placeholder={placeholder}
        {...(currentId ? { currentId } : {})}
        {...(footer ? { footer } : {})}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label={`${crumb.label}, switch`}
            aria-current={here ? 'page' : undefined}
            className={`${CRUMB} cursor-pointer border-0 bg-transparent font-sans text-13 aria-[current=page]:font-medium aria-[current=page]:text-tx aria-expanded:bg-hover`}
          >
            {body}
            <Icon name="caret" size={13} className="text-tx-3" />
          </button>
        )}
      />
    );
  }
  return (
    <a
      {...link}
      aria-current={here ? 'page' : undefined}
      className={`${CRUMB} aria-[current=page]:font-medium aria-[current=page]:text-tx`}
    >
      {body}
    </a>
  );
}

function Tab({ tab, on }: { tab: PageTab; on: boolean }) {
  const link = useFrameLink(tab.path);
  const anchor = (
    <a
      {...link}
      aria-current={on ? 'page' : undefined}
      className="flex h-7 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-13 whitespace-nowrap text-tx-2 no-underline hover:bg-hover hover:text-tx focus-ring aria-[current=page]:bg-acc-50 aria-[current=page]:font-medium aria-[current=page]:text-acc [&_svg]:text-tx-3 aria-[current=page]:[&_svg]:text-acc"
    >
      <Icon name={tab.icon} size={15} />
      {tab.label}
    </a>
  );
  return tab.keys ? (
    <Tooltip label={`Go to ${tab.label.toLowerCase()}`} keys={tab.keys} side="bottom">
      {anchor}
    </Tooltip>
  ) : (
    anchor
  );
}

/** Where a screen's own header buttons are portalled to; PageHeader fills it. */
const ActionsSlot = createContext<HTMLElement | null | undefined>(undefined);
export const ActionsSlotProvider = ActionsSlot.Provider;

/** Where a screen's presence facepile is portalled to; absent on phones. */
const PresenceSlot = createContext<HTMLElement | null | undefined>(undefined);
export const PresenceSlotProvider = PresenceSlot.Provider;

/** Lets a screen that knows more (an issue's epic and type) refine the end of the trail. */
export const TrailContext = createContext<(tail: readonly PageCrumb[] | null) => void>(
  () => undefined,
);

/**
 * Replaces the trail's last crumb with these once the screen's data is in ("Auth service /
 * PLT-204" with its type tile); the route's own crumb shows until then.
 */
export function useHeaderTrail(tail: readonly PageCrumb[] | null): void {
  const set = useContext(TrailContext);
  const signature = tail ? JSON.stringify(tail.map((crumb) => [crumb.label, crumb.path])) : '';
  const latest = useRef(tail);
  useLayoutEffect(() => {
    latest.current = tail;
  });
  useEffect(() => {
    if (!signature) return undefined;
    set(latest.current);
    return () => set(null);
  }, [set, signature]);
}

/**
 * Header buttons from inside a screen (the board's ···, the issue's Watch): rendered into the
 * page header's actions, so the header stays put while the screen loads and swaps states.
 */
export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(ActionsSlot);
  // Outside a page layout (a test, a story) the buttons stay where they are written.
  if (slot === undefined) return <>{children}</>;
  return slot ? createPortal(children, slot) : null;
}

/**
 * Who else is here, from inside a screen: rendered into the header before the actions. Phones
 * have no slot, so nothing is drawn there.
 */
export function HeaderPresence({ children }: { children: ReactNode }) {
  const slot = useContext(PresenceSlot);
  if (slot === undefined) return <>{children}</>;
  return slot ? createPortal(children, slot) : null;
}

/**
 * The one page header (docs/design/premium/kit.css, `.hdr`): 52px, breadcrumbs on the left, the
 * view tabs after a rule, then presence and actions on the right. On a phone the menu button
 * opens the sidebar sheet, the trail keeps only the current page and the tabs scroll.
 */
export function PageHeader({
  crumbs,
  tabs,
  activeTab,
  actions,
  presence,
  trailing,
  className,
  onActionsSlot,
  onPresenceSlot,
}: PageHeaderProps & {
  onActionsSlot?: (element: HTMLElement | null) => void;
  onPresenceSlot?: (element: HTMLElement | null) => void;
}) {
  const { phone, pathname, openSheet } = useFrame();
  const shown = phone ? crumbs.slice(-1) : crumbs;
  const current =
    activeTab ?? tabs?.find((tab) => isActivePath(pathname, tab.path))?.id ?? undefined;
  const tabList =
    tabs && tabs.length > 0 ? (
      <nav
        aria-label="Views"
        className={
          phone
            ? 'flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line px-3'
            : 'ml-1.5 flex h-6 items-center gap-0.5 border-l border-line pl-3'
        }
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} tab={tab} on={tab.id === current} />
        ))}
      </nav>
    ) : null;
  return (
    <>
      <header
        className={`flex h-13 shrink-0 items-center gap-2.5 border-b border-line bg-canvas px-3 md:px-6 ${className ?? ''}`}
      >
        {phone ? <IconButton label="Open menu" icon="lines" size="sm" onClick={openSheet} /> : null}
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="m-0 flex min-w-0 list-none items-center gap-1 p-0 text-13">
            {shown.map((crumb, index) => (
              <Fragment key={`${crumb.path}-${index}`}>
                {index > 0 ? (
                  <li aria-hidden className="text-tx-3 opacity-60">
                    /
                  </li>
                ) : null}
                <li className="flex min-w-0">
                  <CrumbLink crumb={crumb} here={index === shown.length - 1} />
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
        {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
        {phone ? null : tabList}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {phone ? null : presence}
          {phone ? null : <span ref={onPresenceSlot} className="flex items-center empty:hidden" />}
          {phone ? null : actions}
          <span ref={onActionsSlot} className="flex items-center gap-2 empty:hidden" />
        </div>
      </header>
      {phone ? tabList : null}
      {phone && actions ? (
        <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-3">
          {actions}
        </div>
      ) : null}
    </>
  );
}
