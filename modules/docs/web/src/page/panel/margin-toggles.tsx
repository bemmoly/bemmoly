import type { PageDetail } from '@bemmoly/module-docs/shared';
import { ariaKeyShortcuts, Button, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { cx } from '../cx.ts';
import { marginShown, usePageChrome, usePageScreen } from '../screen-context.ts';
import { HISTORY_SLOT, MARGIN_SLOTS, type MarginSlot } from '../slots.ts';

/** A pressed toggle takes the review's open look: accent ink on the accent wash. */
const TOGGLE = 'aria-pressed:bg-acc-50 aria-pressed:text-acc';

function Count({ slot, page }: { slot: MarginSlot; page: PageDetail }) {
  const count = slot.useCount?.(page);
  if (!count) return null;
  return <span className="tabular-nums">{count}</span>;
}

/**
 * The header's margin toggles, as the review draws them: Outline, Comments with its count,
 * Linked work, then Version history, each with a tooltip naming it and its shortcut. One
 * margin shows at a time; pressing the one shown closes it. On phones only Comments stays;
 * the outline folds away and Linked work and history move into ···.
 */
export function MarginToggles() {
  const { page, docked, readOnly } = usePageScreen();
  const margin = usePageChrome((state) => state.margin);
  const chosen = usePageChrome((state) => state.chosen);
  const toggleMargin = usePageChrome((state) => state.toggleMargin);
  const mode = usePageChrome((state) => state.mode);
  const setMode = usePageChrome((state) => state.setMode);
  const history = mode === 'history';
  return (
    <span className="flex items-center gap-0.5">
      {!history &&
        MARGIN_SLOTS.map((slot) => {
          const shown = marginShown({ margin, chosen }, slot.id, docked);
          return (
            <Tooltip key={slot.id} label={slot.label} keys={slot.keys}>
              <Button
                size="sm"
                variant="ghost"
                aria-label={slot.label}
                aria-pressed={shown}
                aria-keyshortcuts={ariaKeyShortcuts(slot.keys)}
                data-margin-toggle={slot.id}
                icon={<Icon name={slot.icon} size={15} />}
                className={cx(TOGGLE, slot.id !== 'comments' && 'max-sm:hidden')}
                onClick={() => toggleMargin(slot.id, shown)}
              >
                <Count slot={slot} page={page} />
              </Button>
            </Tooltip>
          );
        })}
      {readOnly !== 'trashed' && (
        <Tooltip label={HISTORY_SLOT.label} keys={HISTORY_SLOT.keys}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={HISTORY_SLOT.label}
            aria-pressed={history}
            aria-keyshortcuts={ariaKeyShortcuts(HISTORY_SLOT.keys)}
            icon={<Icon name={HISTORY_SLOT.icon} size={15} />}
            className={cx(TOGGLE, 'max-sm:hidden')}
            onClick={() => setMode(history ? 'page' : 'history')}
          />
        </Tooltip>
      )}
    </span>
  );
}
