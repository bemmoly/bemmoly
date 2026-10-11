import { useFrame } from '@bemmoly/core-web';
import { Menu, MenuGroup, MenuItem, Tooltip, type MenuTriggerProps } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Shell } from '../../hooks/use-shell.ts';
import { MODES } from '../appearance/mode-control.tsx';

/**
 * The footer's Appearance button, beside the person's row (stacked above the avatar on the
 * rail): its icon is the current mode, and it opens Light, Dark and Match system as a popover.
 * Mode is the person's only appearance choice; the workspace admin sets the theme in
 * Settings › Appearance (ADR 0021).
 */
export function AppearanceMenu({ shell }: { shell: Shell }) {
  const rail = useFrame().mode === 'rail';
  const current = MODES.find((mode) => mode.value === shell.mode.value) ?? MODES[0]!;
  const trigger = (props: MenuTriggerProps) => (
    <Tooltip label="Appearance" side={rail ? 'right' : 'top'}>
      <button
        type="button"
        {...props}
        aria-label="Appearance"
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-chip border-0 bg-transparent p-0 text-tx-3 hover:bg-hover hover:text-tx focus-ring aria-expanded:bg-hover aria-expanded:text-tx"
      >
        <Icon name={current.icon} size={16} />
      </button>
    </Tooltip>
  );
  return (
    <Menu align={rail ? 'start' : 'end'} trigger={trigger}>
      <MenuGroup label="Mode">
        {MODES.map((mode) => (
          <MenuItem
            key={mode.value}
            keepOpen
            checked={mode.value === shell.mode.value}
            icon={<Icon name={mode.icon} />}
            onSelect={() => shell.mode.set(mode.value)}
          >
            {mode.label}
          </MenuItem>
        ))}
      </MenuGroup>
    </Menu>
  );
}
