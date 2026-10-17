import { useT } from '@bemmoly/core-web';
import { EntityTile, focusRing, Skeleton, type EntityHue } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { useDomains, useGroups } from '../../../hooks/use-catalog-tree.ts';
import { useOverview } from '../../../hooks/use-overview.ts';
import { useScope } from '../../../hooks/use-scope.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { cx } from '../../../lib/cx.ts';

function Node({
  depth,
  selected,
  expanded,
  onSelect,
  children,
}: {
  depth: number;
  selected: boolean;
  expanded?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        aria-expanded={expanded}
        onClick={onSelect}
        style={{ paddingInlineStart: `${8 + depth * 16}px` }}
        className={cx(
          'flex h-7 w-full items-center gap-1.5 rounded-control pe-2 text-start text-13',
          selected ? 'bg-acc-50 font-medium text-tx' : 'text-tx-2 hover:bg-hover hover:text-tx',
          focusRing,
        )}
      >
        {expanded === undefined ? (
          <span aria-hidden className="w-3 shrink-0" />
        ) : (
          <Icon name={expanded ? 'caret' : 'chevron'} size={12} className="shrink-0 text-tx-3" />
        )}
        {children}
      </button>
    </li>
  );
}

/**
 * The catalog as a tree of scopes: the organisation, its domains, and the chosen domain's
 * groups. Choosing one sets ?scope=, so the bindings, policies and the top bar follow.
 */
export function ScopeTree() {
  const t = useT(pipelinesText);
  const { path, domain, group, setScope } = useScope();
  const domains = useDomains();
  const groups = useGroups(domain);
  const organisation = useOverview('').data?.scope.organisation ?? '';
  return (
    <nav aria-label={t('pipelines.access.scope')} className="flex flex-col gap-1.5">
      <h2 className="px-2 text-11 font-semibold text-tx-2">{t('pipelines.access.scope')}</h2>
      <ul className="flex flex-col gap-px">
        <Node depth={0} selected={path === ''} expanded onSelect={() => setScope('')}>
          <span className="truncate">{organisation}</span>
        </Node>
        {domains.isPending &&
          Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="flex h-7 items-center ps-7">
              <Skeleton width={96 + ((index * 23) % 40)} height={10} />
            </li>
          ))}
        {domains.data?.items.map((item) => (
          <li key={item.id}>
            <ul className="flex flex-col gap-px">
              <Node
                depth={1}
                selected={domain === item.key && !group}
                expanded={domain === item.key}
                onSelect={() => setScope(item.key)}
              >
                <EntityTile name={item.name} hue={item.color as EntityHue} size={16} />
                <span className="truncate">{item.name}</span>
              </Node>
              {domain === item.key &&
                groups.data?.items.map((child) => (
                  <Node
                    key={child.id}
                    depth={2}
                    selected={group === child.key}
                    onSelect={() => setScope(`${item.key}/${child.key}`)}
                  >
                    <span className="truncate">{child.name}</span>
                  </Node>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
