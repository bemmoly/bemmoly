import { MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { PageSlotProps } from '../../slots.ts';
import { useDocAi, useGhostTextPreference } from './use-doc-ai.ts';

/**
 * The More menu's ghost text switch: the person's own, on this device. Drawn only where the
 * editor has AI at all, so with AI off, for readers and in excluded spaces it is not there.
 */
export function GhostTextMenuItem({ page, editable }: PageSlotProps) {
  const ai = useDocAi({ pageId: page.id, spaceKey: page.spaceKey, editable });
  const [on, setOn] = useGhostTextPreference();
  if (!ai) return null;
  return (
    <MenuItem
      kind="checkbox"
      checked={on}
      keepOpen
      icon={<Icon name="spark" size={14} className="text-ai-600" />}
      onSelect={() => setOn(!on)}
    >
      Ghost text suggestions
    </MenuItem>
  );
}
