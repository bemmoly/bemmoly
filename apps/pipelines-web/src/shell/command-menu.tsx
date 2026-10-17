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
import type { Application } from '@bemmoly/module-pipelines/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { pipelinesKeys } from '../api/pipelines.ts';
import { useDomains } from '../hooks/use-catalog-tree.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { api } from '../lib/api.ts';
import { useUiStore } from '../store/ui.ts';
import {
  ApplicationActionsGroup,
  parseIntent,
  ScreenActionsGroup,
  type Verb,
} from './command-actions.tsx';
import { PLACES, SETTINGS } from './places.ts';

const matches = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());

/**
 * Mod+K: what this screen can do, applications by name, key or label with their actions
 * ("roll back pricing-svc", "who owns search-api"), places, and domains to zoom to.
 */
export function CommandMenu({ onToggleMode }: { onToggleMode: () => void }) {
  const t = useT(pipelinesText);
  const open = useUiStore((state) => state.paletteOpen);
  const close = useUiStore((state) => state.closePalette);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const intent = parseIntent(query.trim());
  const search = useDeferredValue(intent.rest);
  const domains = useDomains().data?.items ?? [];
  const applications = useQuery({
    queryKey: pipelinesKeys.applications({ q: search, limit: 8 }),
    queryFn: () => api.pipelines.applications({ q: search, limit: 8 }),
    enabled: open && search.length >= 2,
  });
  const openApplication = (application: Application, dialog?: Verb) => {
    close();
    setQuery('');
    void navigate({
      to: '/applications/$key',
      params: { key: application.key },
      search: {
        scope: `${application.domain.key}/${application.group.key}`,
        ...(dialog && dialog !== 'owner' ? { dialog } : {}),
      } as { scope?: string },
    });
  };
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
        {intent.verb ? null : (
          <ScreenActionsGroup
            query={query.trim()}
            onRun={() => {
              close();
              setQuery('');
            }}
          />
        )}
        <ApplicationActionsGroup applications={found} verb={intent.verb} onOpen={openApplication} />
        {found.length > 0 && !intent.verb && (
          <CommandGroup label={t('pipelines.shell.commandsApplications')}>
            {found.map((application) => (
              <CommandItem
                key={application.id}
                icon={<Icon name="box" size={16} />}
                title={application.name}
                meta={[application.domain.name, application.group.name, application.ownerTeam?.name]
                  .filter(Boolean)
                  .join(' · ')}
                onSelect={() => openApplication(application)}
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
          {matches(t('pipelines.shell.setUp'), query) ? (
            <CommandItem
              icon={<Icon name="checklist" size={16} />}
              title={t('pipelines.shell.setUp')}
              onSelect={() => go('/start')}
            />
          ) : null}
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
