import { IconButton } from '@bemmoly/ui';
import { usePageScreen } from '../screen-context.ts';
import type { MarginProps, MarginSlot } from '../slots.ts';
import { TocList } from './toc-list.tsx';

/**
 * The outline in the margin: sticky beside the column where it fits, following the scroll
 * with the heading being read marked; over the page on narrow screens, where a jump closes
 * it. A page without headings says how to get one.
 */
function OutlineMargin({ docked, onClose }: MarginProps) {
  const { outline, activeHeading, pinHeading, editor } = usePageScreen();
  return (
    <div className={docked ? 'sticky top-0 pt-12 pr-6' : 'flex flex-col gap-2 p-4'}>
      {!docked && (
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-13 font-semibold text-tx">Outline</h2>
          <IconButton
            label="Close outline"
            icon="close"
            size="xs"
            variant="ghost"
            onClick={onClose}
          />
        </div>
      )}
      {outline.length === 0 ? (
        !docked && <p className="m-0 text-12h text-tx-3">Headings in the page show here.</p>
      ) : (
        <TocList
          outline={outline}
          active={activeHeading}
          editor={editor}
          onPin={pinHeading}
          onJump={docked ? undefined : onClose}
        />
      )}
    </div>
  );
}

export const OUTLINE_MARGIN: MarginSlot = {
  id: 'outline',
  label: 'Outline',
  icon: 'lines',
  keys: 'Mod+Alt+O',
  bare: true,
  Component: OutlineMargin,
};
