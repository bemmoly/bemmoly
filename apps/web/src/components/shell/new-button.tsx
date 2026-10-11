import { knownIcon, useFrame } from '@bemmoly/core-web';
import { Menu, MenuItem, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Shell } from '../../hooks/use-shell.ts';

const FILL =
  'grid cursor-pointer place-items-center border-0 bg-acc-fill p-0 text-on-acc shadow-e1 hover:brightness-110 active:brightness-95 focus-ring';

/**
 * New (docs/design/premium/kit.css, `.new-btn`): the accent square makes the primary thing at
 * once (a new issue in the current project, C); the narrow segment beside it lists what else
 * the enabled modules make. With no module on it explains where creating comes from.
 */
export function NewButton({ shell, size = 30 }: { shell: Shell; size?: number }) {
  const { mode } = useFrame();
  const first = shell.primaryCreate;
  const others = shell.creates.slice(1);
  if (!first) {
    return (
      <Menu
        align="end"
        widthClassName="w-64"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label="New"
            style={{ width: size, height: size }}
            className={`${FILL} rounded-control`}
          >
            <Icon name="plus" size={16} />
          </button>
        )}
      >
        <div className="flex flex-col gap-1 px-2.5 py-2 text-12 text-tx-2">
          <b className="text-13 font-semibold text-tx">Nothing to create yet</b>
          Issues, docs and other work come from modules.{' '}
          {shell.me.can('workspace.modules.manage')
            ? 'Enable one and what it makes shows up here.'
            : 'Once an admin enables one, what it makes shows up here.'}
        </div>
        {shell.me.can('workspace.modules.manage') ? (
          <MenuItem icon={<Icon name="modules" />} onSelect={() => shell.go('/settings/modules')}>
            Open Settings › Modules
          </MenuItem>
        ) : null}
      </Menu>
    );
  }
  const label = `New ${first.label.toLowerCase()}`;
  const main = (
    <Tooltip label={label} keys="C" side={mode === 'rail' ? 'right' : 'top'}>
      <button
        type="button"
        aria-label={label}
        onClick={first.open}
        style={{ width: size, height: size }}
        className={`${FILL} ${others.length > 0 && mode !== 'rail' ? 'rounded-l-control' : 'rounded-control'}`}
      >
        <Icon name="plus" size={16} />
      </button>
    </Tooltip>
  );
  if (others.length === 0 || mode === 'rail') return main;
  return (
    <span className="flex shrink-0 rounded-control">
      {main}
      <Menu
        align="end"
        widthClassName="w-52"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label="More to create"
            style={{ height: size }}
            className={`${FILL} w-6 rounded-r-control border-l border-on-acc/25`}
          >
            <Icon name="caret" size={12} />
          </button>
        )}
      >
        {shell.creates.map((entry, index) => (
          <MenuItem
            key={entry.id}
            icon={<Icon name={knownIcon(entry.icon) ?? 'plus'} />}
            onSelect={entry.open}
            {...(index === 0 ? { hint: 'C' } : {})}
          >
            New {entry.label.toLowerCase()}
          </MenuItem>
        ))}
      </Menu>
    </span>
  );
}
