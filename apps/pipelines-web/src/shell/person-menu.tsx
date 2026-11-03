import { useT } from '@bemmoly/core-web';
import { Avatar, Menu, MenuGroup, MenuItem, MenuSeparator } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMe } from '../hooks/use-me.ts';
import type { Appearance } from '../hooks/use-mode.ts';
import { usePipelinesMe } from '../hooks/use-roles.ts';
import { pipelinesText, rolesText } from '../i18n/catalog.ts';
import { api } from '../lib/api.ts';
import { goToSignIn } from '../lib/sign-in.ts';
import { MODE_CHOICES } from './mode-choices.ts';

/** The person at the rail's foot: their role, the look, a way back to Bemmoly, signing out. */
export function PersonMenu({
  appearance,
  align = 'start',
}: {
  appearance: Appearance;
  align?: 'start' | 'end';
}) {
  const t = useT(pipelinesText);
  const words = useT(rolesText);
  const { data: me } = useMe();
  const role = usePipelinesMe().data?.role;
  const name = me?.user.name ?? '';
  const roleName = role ? words(`pipelinesRoles.role.${role}`) : null;
  const signOut = async () => {
    await api.auth.logout().catch(() => undefined);
    goToSignIn();
  };
  return (
    <Menu
      align={align}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={
            roleName
              ? words('pipelinesRoles.menu.person', { name, role: roleName })
              : t('pipelines.shell.person', { name })
          }
          className="grid size-10 place-items-center rounded-full focus-ring"
        >
          <Avatar name={name || '?'} size={28} hue="accent" />
        </button>
      )}
    >
      <div className="flex flex-col px-2.5 py-1.5">
        <span className="truncate text-13 font-semibold text-tx">{name}</span>
        {roleName && <span className="text-12 text-tx-3">{roleName}</span>}
      </div>
      <MenuSeparator />
      <MenuGroup label={t('pipelines.settings.mode')}>
        {MODE_CHOICES.map((choice) => (
          <MenuItem
            key={choice.value}
            keepOpen
            checked={appearance.preference === choice.value}
            icon={<Icon name={choice.icon} />}
            onSelect={() => appearance.setPreference(choice.value)}
          >
            {t(choice.word)}
          </MenuItem>
        ))}
      </MenuGroup>
      <MenuSeparator />
      <MenuItem onSelect={() => window.location.assign('/')} icon={<Icon name="external" />}>
        {t('pipelines.shell.openBemmoly')}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={() => void signOut()} icon={<Icon name="log-out" />}>
        {t('pipelines.shell.signOut')}
      </MenuItem>
    </Menu>
  );
}
