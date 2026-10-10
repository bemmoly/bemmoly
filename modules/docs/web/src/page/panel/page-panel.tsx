import type { PageDetail } from '@bemmoly/module-docs/shared';
import { IconButton, Tabs } from '@bemmoly/ui';
import { useEffect, useRef } from 'react';
import { cx } from '../cx.ts';
import { ABOUT_PANEL, usePageChrome, usePageScreen, useSlotProps } from '../screen-context.ts';
import { ABOUT_SLOTS, PANEL_SLOTS, type PanelSlot } from '../slots.ts';
import { TocList } from '../toc/toc-list.tsx';
import { AboutFacts } from './about-facts.tsx';

const HEADING = 'text-11 font-medium tracking-caps text-tx-3 uppercase';

/** "Comments (3)", the mock's tab label, with the count the slot reports. */
function SlotLabel({ slot, page }: { slot: PanelSlot; page: PageDetail }) {
  const count = slot.useCount?.(page);
  return (
    <>
      {slot.label}
      {count !== undefined && ` (${count})`}
    </>
  );
}

/** About: the page's facts, the outline when it has no rail of its own, and the slots after. */
function AboutTab({ onJump }: { onJump: () => void }) {
  const screen = usePageScreen();
  const slotProps = useSlotProps();
  return (
    <div className="flex flex-col gap-3 p-3.5 text-13 leading-desc">
      <h2 className={cx('m-0', HEADING)}>About this page</h2>
      <AboutFacts />
      {!screen.outlineInRail && (
        <TocList
          outline={screen.outline}
          active={screen.activeHeading}
          onPin={screen.pinHeading}
          editor={screen.editor}
          onJump={onJump}
          className="mt-1"
        />
      )}
      {ABOUT_SLOTS.map((Slot, index) => (
        <Slot key={index} {...slotProps} />
      ))}
    </div>
  );
}

/**
 * The 340px panel beside the body: About first, then the tabs other folders add (Comments,
 * Linked). From 1280px it sits beside the body as in the mock; below that it opens over the
 * body from the right, with a scrim that closes it, and Escape does too.
 */
export function PagePanel() {
  const screen = usePageScreen();
  const slotProps = useSlotProps();
  const panel = usePageChrome((state) => state.panel);
  const openPanel = usePageChrome((state) => state.openPanel);
  const closePanel = usePageChrome((state) => state.closePanel);
  const focusRequest = usePageChrome((state) => state.focusRequest);
  const aside = useRef<HTMLElement>(null);
  const slot = PANEL_SLOTS.find((item) => item.id === panel);
  const open = panel === ABOUT_PANEL || Boolean(slot);
  const overlay = () => !window.matchMedia?.('(min-width: 1280px)').matches;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && overlay() && !event.defaultPrevented) closePanel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closePanel]);

  // After the menu that opened it has handed focus back to its trigger.
  useEffect(() => {
    if (focusRequest === 0) return;
    aside.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus();
  }, [focusRequest]);

  if (!open) return null;
  const tabs = [
    { value: ABOUT_PANEL, label: 'About' },
    ...PANEL_SLOTS.filter((item) => item.tab !== false || item.id === panel).map((item) => ({
      value: item.id,
      label: <SlotLabel slot={item} page={screen.page} />,
    })),
  ];
  const Body = slot?.Component;

  return (
    <>
      <div
        aria-hidden
        onClick={closePanel}
        className="absolute inset-0 z-20 bg-scrim motion-safe:animate-fade-in xl:hidden"
      />
      <aside
        ref={aside}
        aria-label="Page details"
        className={cx(
          'absolute inset-y-0 right-0 z-30 flex w-full max-w-85 flex-col border-l border-line bg-card shadow-e3',
          'motion-safe:animate-slide-in xl:static xl:z-auto xl:w-85 xl:shrink-0 xl:shadow-none xl:motion-safe:animate-none',
        )}
      >
        <Tabs
          size="panel"
          bordered={false}
          aria-label="Page details"
          items={tabs}
          value={panel ?? ABOUT_PANEL}
          onChange={openPanel}
          className="h-11 shrink-0 border-b border-line-2 px-3.5"
          end={
            <IconButton
              label="Close panel"
              icon="close"
              size="xs"
              onClick={closePanel}
              className="xl:hidden"
            />
          }
        />
        <div className="min-h-0 flex-1 overflow-auto">
          {Body ? (
            <Body {...slotProps} onClose={closePanel} />
          ) : (
            <AboutTab onJump={() => overlay() && closePanel()} />
          )}
        </div>
      </aside>
    </>
  );
}
