import { SwitcherMenu, useFrameLink, useT, type SwitcherItem } from '@bemmoly/core-web';
import { EntityTile, type EntityHue } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useDomains, useGroups } from '../hooks/use-catalog-tree.ts';
import { useScope } from '../hooks/use-scope.ts';
import { useBrowserPath } from '../hooks/use-browser-path.ts';
import { pipelinesText } from '../i18n/catalog.ts';

const CRUMB =
  'flex h-8 min-w-0 items-center gap-1.5 rounded-control px-2 text-13 font-medium text-tx-2 hover:bg-hover hover:text-tx focus-ring';

/**
 * Acme › Commerce › Checkout: the scope every screen shows, with a searchable switcher at
 * the domain and group levels. Choosing keeps the screen and changes only ?scope=.
 */
export function ScopeSwitcher({ organisation }: { organisation: string }) {
  const t = useT(pipelinesText);
  const { domain, group } = useScope();
  const pathname = useBrowserPath();
  const domains = useDomains().data?.items ?? [];
  const groups = useGroups(domain).data?.items ?? [];
  const at = (scope: string) => (scope ? `${pathname}?scope=${scope}` : pathname);
  const organisationLink = useFrameLink(at(''));
  const current = domains.find((item) => item.key === domain);
  const currentGroup = groups.find((item) => item.key === group);
  const domainItems: SwitcherItem[] = domains.map((item) => ({
    id: item.key,
    label: item.name,
    path: at(item.key),
    icon: <EntityTile name={item.name} hue={item.color as EntityHue} size={16} />,
  }));
  const groupItems: SwitcherItem[] = groups.map((item) => ({
    id: item.key,
    label: item.name,
    path: at(`${domain}/${item.key}`),
  }));
  const caret = <Icon name="caret" size={12} className="text-tx-3" />;
  const separator = <Icon name="chevron" size={12} className="shrink-0 text-tx-3" />;
  return (
    <nav aria-label={t('pipelines.shell.scope')} className="flex min-w-0 items-center gap-0.5">
      <a {...organisationLink} className={`${CRUMB} ${domain ? '' : 'text-tx'}`}>
        <EntityTile name={organisation} tone="ink" size={18} />
        <span className="truncate max-sm:hidden">{organisation}</span>
      </a>
      {separator}
      <SwitcherMenu
        items={domainItems}
        currentId={domain ?? undefined}
        placeholder={t('pipelines.shell.scopeDomainSearch')}
        footer={[{ id: 'all', label: t('pipelines.shell.scopeAllDomains'), path: at('') }]}
        trigger={(props) => (
          <button type="button" {...props} className={`${CRUMB} ${current ? 'text-tx' : ''}`}>
            {current ? (
              <EntityTile name={current.name} hue={current.color as EntityHue} size={16} />
            ) : null}
            <span className="truncate">
              {current?.name ?? t('pipelines.shell.scopeAllDomains')}
            </span>
            {caret}
          </button>
        )}
      />
      {current ? (
        <>
          <span className="max-sm:hidden">{separator}</span>
          <SwitcherMenu
            items={groupItems}
            currentId={group ?? undefined}
            placeholder={t('pipelines.shell.scopeGroupSearch')}
            footer={[
              {
                id: 'all',
                label: t('pipelines.shell.scopeAllGroups', { domain: current.name }),
                path: at(current.key),
              },
            ]}
            trigger={(props) => (
              <button type="button" {...props} className={`${CRUMB} max-sm:hidden`}>
                <span className="truncate">
                  {currentGroup?.name ??
                    t('pipelines.shell.scopeAllGroups', { domain: current.name })}
                </span>
                {caret}
              </button>
            )}
          />
        </>
      ) : null}
    </nav>
  );
}
