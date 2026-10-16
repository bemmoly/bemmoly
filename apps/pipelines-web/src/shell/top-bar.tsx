import { useT } from '@bemmoly/core-web';
import { Kbd, Menu, MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useOverview } from '../hooks/use-overview.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { useUiStore } from '../store/ui.ts';
import { LiveCounter } from './live-counter.tsx';
import { ScopeSwitcher } from './scope-switcher.tsx';

const ICON_BUTTON =
  'grid size-8 shrink-0 place-items-center rounded-control text-tx-2 hover:bg-hover hover:text-tx focus-ring';

/**
 * The 48px top bar: the scope on the left, search in the middle (Mod+K opens commands), the
 * live counter, notifications and help on the right. On a phone the search box becomes an
 * icon and the counter shows only what is running.
 */
export function TopBar() {
  const t = useT(pipelinesText);
  const openPalette = useUiStore((state) => state.openPalette);
  const setKeysOpen = useUiStore((state) => state.setKeysOpen);
  const organisation = useOverview('').data?.scope.organisation ?? '';
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-canvas px-3 md:px-4">
      <div className="min-w-0 flex-1 md:flex-none">
        <ScopeSwitcher organisation={organisation} />
      </div>
      <button
        type="button"
        onClick={openPalette}
        className="mx-auto hidden h-8 w-full max-w-110 items-center gap-2 rounded-control border border-line bg-sunken px-3 text-13 text-tx-3 hover:border-acc-100 focus-ring md:flex"
      >
        <Icon name="search" size={14} />
        <span className="flex-1 truncate text-start">{t('pipelines.shell.search')}</span>
        <Kbd keys="Mod+K" variant="plain" />
      </button>
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <button
          type="button"
          onClick={openPalette}
          aria-label={t('pipelines.shell.search')}
          className={`${ICON_BUTTON} md:hidden`}
        >
          <Icon name="search" size={18} />
        </button>
        <span className="hidden md:inline-flex">
          <LiveCounter />
        </span>
        <span className="md:hidden">
          <LiveCounter compact />
        </span>
        <Menu
          align="end"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={t('pipelines.shell.notifications')}
              className={ICON_BUTTON}
            >
              <Icon name="bell" size={18} />
            </button>
          )}
        >
          <MenuItem onSelect={() => undefined} disabled>
            {t('pipelines.shell.notificationsEmpty')}
          </MenuItem>
        </Menu>
        <Menu
          align="end"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={t('pipelines.shell.help')}
              className={`${ICON_BUTTON} max-sm:hidden`}
            >
              <Icon name="help" size={18} />
            </button>
          )}
        >
          <MenuItem onSelect={openPalette} hint={<Kbd keys="Mod+K" />}>
            {t('pipelines.shell.helpCommands')}
          </MenuItem>
          <MenuItem onSelect={() => setKeysOpen(true)} hint={<Kbd keys="?" />}>
            {t('pipelines.shell.helpKeys')}
          </MenuItem>
          <MenuItem onSelect={() => undefined} disabled hint={<Kbd keys="T" />}>
            {t('pipelines.shell.helpMode')}
          </MenuItem>
          <MenuItem onSelect={() => undefined} disabled hint={<Kbd keys="G" />}>
            {t('pipelines.shell.helpGoTo')}
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}
