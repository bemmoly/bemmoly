import { useT } from '@bemmoly/core-web';
import { Menu, MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { useBrowserPath } from '../hooks/use-browser-path.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlaceLink } from './place-link.tsx';
import { MORE_PLACES, PHONE_PLACES, placeAt } from './places.ts';

/**
 * Below 768px the rail becomes this bottom bar: For you, Map, Catalog and Runs, then More for
 * Releases, Insights, Platform and Settings (ADR 0037). Thumb-reachable, 48px targets.
 */
export function PhoneBar() {
  const t = useT(pipelinesText);
  const navigate = useNavigate();
  const current = placeAt(useBrowserPath());
  const inMore = MORE_PLACES.some((place) => place.id === current?.id);
  return (
    <nav
      aria-label={t('pipelines.shell.mainNavigation')}
      className="flex shrink-0 items-stretch gap-1 border-t border-line bg-side px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] md:hidden"
    >
      {PHONE_PLACES.map((place) => (
        <PlaceLink key={place.id} place={place} active={current?.id === place.id} layout="bar" />
      ))}
      <div className="flex min-w-0 flex-1">
        <Menu
          align="end"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className={`flex h-12 w-full flex-col items-center justify-center gap-1 rounded-control text-11 font-medium focus-ring ${
                inMore ? 'bg-acc-50 text-acc' : 'text-tx-2'
              }`}
            >
              <Icon name="more" size={18} />
              {t('pipelines.shell.more')}
            </button>
          )}
        >
          {MORE_PLACES.map((place) => (
            <MenuItem
              key={place.id}
              icon={<Icon name={place.icon} />}
              checked={current?.id === place.id}
              onSelect={() => void navigate({ to: place.path })}
            >
              {t(`pipelines.shell.place.${place.id}`)}
            </MenuItem>
          ))}
        </Menu>
      </div>
    </nav>
  );
}
