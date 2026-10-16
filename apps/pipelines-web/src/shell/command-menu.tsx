import { useT } from '@bemmoly/core-web';
import {
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPalette,
  EntityTile,
  type EntityHue,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { pipelinesKeys } from '../api/pipelines.ts';
import { useDomains } from '../hooks/use-catalog-tree.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { api } from '../lib/api.ts';
import { useUiStore } from '../store/ui.ts';
import { PLACES, SETTINGS } from './places.ts';

const matches = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());

/**
 * Mod+K: places, domains to zoom the scope to, and applications by name, key or label. The
 * actions (deploy, roll back, who owns) join as the screens that do them land.
 */
export function CommandMenu({ onToggleMode }: { onToggleMode: () => void }) {
  const t = useT(pipelinesText);
  const open = useUiStore((state) => state.paletteOpen);
  const close = useUiStore((state) => state.closePalette);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim());
  const domains = useDomains().data?.items ?? [];
  const applications = useQuery({
    queryKey: pipelinesKeys.applications({ q: search, limit: 8 }),
    queryFn: () => api.pipelines.applications({ q: search, limit: 8 }),
    enabled: open && search.length >= 2,
  });
  const go = (to: string, search?: Record<string, string>) => {
    close();
    setQuery('');
    void navigate({ to, search: search ?? {} });
  };
  const places = [...PLACES, SETTINGS].filter((place) =>
    matches(t(`pipelines.shell.place.${place.id}`), query),
  );
  const scopes = domains.filter((domain) => matches(domain.name, query)).slice(0, 6);
  const found = applications.data?.items ?? [];
  const empty = places.length === 0 && scopes.length === 0 && found.length === 0;
  return (
    <CommandPalette open={open} onClose={close} label={t('pipelines.shell.commandsLabel')}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('pipelines.shell.commandsPlaceholder')}
      />
      <CommandList>
        {found.length > 0 && (
          <CommandGroup label={t('pipelines.shell.commandsApplications')}>
            {found.map((application) => (
              <CommandItem
                key={application.id}
                icon={<Icon name="box" size={16} />}
                title={application.name}
                meta={`${application.domain.name} · ${application.group.name}`}
                onSelect={() => go('/catalog', { q: application.key })}
              />
            ))}
          </CommandGroup>
        )}
        {places.length > 0 && (
          <CommandGroup label={t('pipelines.shell.commandsGroup')}>
            {places.map((place) => (
              <CommandItem
                key={place.id}
                icon={<Icon name={place.icon} size={16} />}
                title={t(`pipelines.shell.place.${place.id}`)}
                keys={place.keys}
                onSelect={() => go(place.path)}
              />
            ))}
          </CommandGroup>
        )}
        {scopes.length > 0 && (
          <CommandGroup label={t('pipelines.shell.commandsScopes')}>
            {scopes.map((domain) => (
              <CommandItem
                key={domain.id}
                icon={<EntityTile name={domain.name} hue={domain.color as EntityHue} size={16} />}
                title={domain.name}
                meta={t('pipelines.shell.commandsApplicationCount', {
                  count: domain.applicationCount,
                })}
                onSelect={() => go('/map', { scope: domain.key })}
              />
            ))}
          </CommandGroup>
        )}
        <CommandGroup label={t('pipelines.shell.commandsActions')}>
          <CommandItem
            icon={<Icon name="theme" size={16} />}
            title={t('pipelines.shell.commandsToggleMode')}
            keys="T"
            onSelect={() => {
              close();
              onToggleMode();
            }}
          />
        </CommandGroup>
        {empty && search.length >= 2 && !applications.isFetching ? (
          <p className="px-3.5 py-3 text-13 text-tx-3">{t('pipelines.shell.commandsNoResults')}</p>
        ) : null}
      </CommandList>
    </CommandPalette>
  );
}
