import { useT } from '@bemmoly/core-web';
import type { EnvironmentV2View } from '@bemmoly/module-pipelines/shared';
import { Button, Card } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { environmentsText } from '../../i18n/catalog.ts';
import { cx } from '../../lib/cx.ts';
import { approvalText, deployersText, versionsText, windowText } from './words.ts';

function Setting({ name, value, off }: { name: string; value: string; off: boolean }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-2 py-2 text-13 last:border-b-0">
      <dt className="flex-1 text-tx-2">{name}</dt>
      <dd className={cx('text-end', off ? 'text-tx-3' : 'text-tx')}>{value}</dd>
    </div>
  );
}

/** One environment on the path: its project and every optional setting, each "Off" until on. */
export function EnvironmentCard({
  environment,
  previous,
  first,
  last,
  onEdit,
  onMove,
}: {
  environment: EnvironmentV2View;
  previous: string | null;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const t = useT(environmentsText);
  const { name, project } = environment;
  return (
    <Card role="region" aria-label={name} className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-1">
        <h2 className="flex-1 truncate text-15 font-semibold text-tx">{name}</h2>
        <Button
          size="xs"
          variant="ghost"
          aria-label={t('pipelinesEnvironments.list.moveLeft', { name })}
          disabled={first}
          icon={<Icon name="arrow-left" size={14} />}
          onClick={() => onMove(-1)}
        />
        <Button
          size="xs"
          variant="ghost"
          aria-label={t('pipelinesEnvironments.list.moveRight', { name })}
          disabled={last}
          icon={<Icon name="arrow-right" size={14} />}
          onClick={() => onMove(1)}
        />
        <Button
          size="xs"
          variant="ghost"
          aria-label={t('pipelinesEnvironments.list.edit', { name })}
          icon={<Icon name="sliders" size={14} />}
          onClick={onEdit}
        />
      </div>
      <div className="flex items-center gap-2.5 rounded-control border border-line bg-side px-3 py-2">
        <Icon name="cloud" size={16} className="shrink-0 text-tx-3" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-12 text-tx">
            {project?.externalId ?? t('pipelinesEnvironments.card.noProject')}
          </span>
          <span className="text-11 text-tx-3">
            {project
              ? project.region
                ? t('pipelinesEnvironments.card.linked', { region: project.region })
                : t('pipelinesEnvironments.card.linkedNoRegion')
              : t('pipelinesEnvironments.card.id', { key: environment.key })}
          </span>
        </span>
      </div>
      <dl>
        <Setting
          name={t('pipelinesEnvironments.card.deployers')}
          value={deployersText(t, environment)}
          off={!environment.deployers}
        />
        <Setting
          name={t('pipelinesEnvironments.card.approval')}
          value={approvalText(t, environment)}
          off={!environment.approvalRule}
        />
        <Setting
          name={t('pipelinesEnvironments.card.window')}
          value={windowText(t, environment.window)}
          off={!environment.window}
        />
        <Setting
          name={t('pipelinesEnvironments.card.versions')}
          value={versionsText(t, environment, previous)}
          off={environment.versionsAllowed === 'any'}
        />
      </dl>
      <span className="mt-auto border-t border-line-2 pt-3 text-12 text-tx-3">
        {t('pipelinesEnvironments.card.services', { count: environment.serviceCount })}
      </span>
    </Card>
  );
}
