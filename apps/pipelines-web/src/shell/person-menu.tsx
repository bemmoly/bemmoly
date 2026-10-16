import { useT } from '@bemmoly/core-web';
import { Avatar, Kbd, Menu, MenuItem, MenuSeparator } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMe } from '../hooks/use-me.ts';
import type { PipelinesMode } from '../hooks/use-mode.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { api } from '../lib/api.ts';
import { goToSignIn } from '../lib/sign-in.ts';

/** The person at the rail's foot: the look, a way back to Bemmoly and signing out. */
export function PersonMenu({
  mode,
  onToggleMode,
  align = 'start',
}: {
  mode: PipelinesMode;
  onToggleMode: () => void;
  align?: 'start' | 'end';
}) {
  const t = useT(pipelinesText);
  const { data: me } = useMe();
  const name = me?.user.name ?? '';
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
          aria-label={t('pipelines.shell.person', { name })}
          className="grid size-10 place-items-center rounded-full focus-ring"
        >
          <Avatar name={name || '?'} size={28} hue="accent" />
        </button>
      )}
    >
      <MenuItem
        onSelect={onToggleMode}
        icon={<Icon name={mode === 'dark' ? 'sun' : 'moon'} />}
        hint={<Kbd keys="T" />}
      >
        {mode === 'dark' ? t('pipelines.shell.lightMode') : t('pipelines.shell.darkMode')}
      </MenuItem>
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
