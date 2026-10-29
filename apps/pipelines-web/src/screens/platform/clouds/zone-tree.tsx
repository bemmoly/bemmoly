import { useT } from '@bemmoly/core-web';
import type { LandingZoneNode } from '@bemmoly/module-pipelines/shared';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { cx } from '../../../lib/cx.ts';

const ICON: Record<LandingZoneNode['kind'], IconName> = {
  folder: 'layers',
  account: 'box',
  resource: 'dot',
};

const STATUS: Record<LandingZoneNode['status'], string | null> = {
  exists: null,
  create: 'bg-acc-50 text-acc',
  update: 'bg-line-2 text-tx-2',
  drifted: 'bg-amber-50 text-amber-tx',
  kept: 'bg-line-2 text-tx-3',
};

/** Children shown before "N more": enough to read the shape without a wall of names. */
const SHOWN = 4;

function Node({ node, depth }: { node: LandingZoneNode; depth: number }) {
  const t = useT(pipelinesText);
  const [all, setAll] = useState(false);
  // An account's resources repeat from account to account, so they fold until asked for.
  const folded = node.kind === 'account' && !all;
  const children = folded ? [] : node.children;
  const shown = all || node.kind === 'account' ? children : children.slice(0, SHOWN);
  const tone = STATUS[node.status];
  return (
    <li className="flex flex-col">
      <span className="flex min-w-0 items-center gap-2 py-0.75 text-12">
        <Icon name={ICON[node.kind]} size={14} className="shrink-0 text-tx-3" />
        <span
          className={cx(
            'truncate',
            node.kind === 'resource' ? 'text-tx-2' : 'font-mono font-medium text-tx',
          )}
        >
          {node.name}
        </span>
        {node.note && <span className="min-w-0 truncate text-tx-3">{node.note}</span>}
        {folded && node.children.length > 0 && (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setAll(true)}
            className="shrink-0 text-acc hover:underline"
          >
            {t('pipelines.clouds.resources', { count: node.children.length })}
          </button>
        )}
        {tone && (
          <span
            className={cx('ms-auto shrink-0 rounded-chip px-1.5 py-px text-11 font-medium', tone)}
          >
            {t(`pipelines.clouds.node.${node.status as 'create' | 'update' | 'drifted' | 'kept'}`)}
          </span>
        )}
      </span>
      {children.length > 0 && depth < 4 && (
        <ul className="ms-1.5 flex flex-col border-s border-line ps-3">
          {shown.map((child, index) => (
            <Node key={`${child.name}:${index}`} node={child} depth={depth + 1} />
          ))}
          {children.length > shown.length && (
            <li>
              <button
                type="button"
                onClick={() => setAll(true)}
                className="py-0.75 text-12 text-acc hover:underline"
              >
                {t('pipelines.clouds.moreNodes', { count: children.length - shown.length })}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** What will be created, folder by folder and account by account, before anything is. */
export function ZoneTree({ root }: { root: LandingZoneNode }) {
  const t = useT(pipelinesText);
  return (
    <ul aria-label={t('pipelines.clouds.treeLabel')} className="rounded-control bg-sunken p-3">
      <Node node={root} depth={0} />
    </ul>
  );
}
