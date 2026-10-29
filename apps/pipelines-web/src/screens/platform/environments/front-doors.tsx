import { useT } from '@bemmoly/core-web';
import type { Environment, FrontDoor } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, type BadgeTone } from '@bemmoly/ui';
import { useState } from 'react';
import { useFrontDoors } from '../../../hooks/use-front-doors.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { FrontDoorDialog } from './front-door-dialog.tsx';

const TONE: Record<FrontDoor['status'], BadgeTone> = {
  pending: 'neutral',
  applying: 'neutral',
  ready: 'ok',
  failed: 'danger',
  off: 'neutral',
};

/** One environment's front door: on or off, its address and domain, and what it serves. */
function FrontDoorRow({
  environment,
  door,
  onEdit,
}: {
  environment: Environment;
  door: FrontDoor | undefined;
  onEdit: () => void;
}) {
  const t = useT(pipelinesText);
  const on = door?.enabled ?? false;
  const addresses = [...new Set(door?.addresses.map((entry) => entry.address))];
  return (
    <li
      aria-label={environment.name}
      className="flex flex-col gap-2 border-t border-line-2 px-4 py-3 md:flex-row md:gap-6"
    >
      <div className="flex w-48 shrink-0 flex-col">
        <span className="truncate text-13 font-medium text-tx">{environment.name}</span>
        <span className="truncate font-mono text-12 text-tx-3">{environment.key}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {door && on ? (
            <Badge tone={TONE[door.status]}>{t(`pipelines.frontDoor.status.${door.status}`)}</Badge>
          ) : (
            <span className="text-12 text-tx-2">{t('pipelines.frontDoor.off')}</span>
          )}
          {on && (
            <span className="font-mono text-12 text-tx">
              {addresses.length === 0
                ? t('pipelines.frontDoor.addressLater')
                : addresses.length === 1
                  ? addresses[0]
                  : t('pipelines.frontDoor.addresses', { count: addresses.length })}
            </span>
          )}
          <Button size="sm" variant="secondary" className="ms-auto" onClick={onEdit}>
            {on ? t('pipelines.frontDoor.edit') : t('pipelines.frontDoor.turnOn')}
          </Button>
        </div>
        {on && door && (
          <p className="text-12 text-tx-3">
            {[
              door.domain
                ? t('pipelines.frontDoor.domainIs', { domain: door.domain })
                : t('pipelines.frontDoor.noDomain'),
              t('pipelines.frontDoor.serves', { count: door.routes.length }),
            ].join(' · ')}
          </p>
        )}
        {on && door && door.problems.length > 0 && (
          <ul
            aria-label={t('pipelines.frontDoor.problemsLabel', { env: environment.name })}
            className="flex list-disc flex-col gap-1 ps-5 text-12 leading-body text-tx-2"
          >
            {door.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Front doors, one row per environment: a stable address there, so an application moves
 * between runtimes as a traffic shift with no downtime. New Prod environments start with one.
 */
export function FrontDoors({ environments }: { environments: readonly Environment[] }) {
  const t = useT(pipelinesText);
  const doors = useFrontDoors();
  const [editing, setEditing] = useState<Environment | null>(null);
  const doorOf = (environment: Environment) =>
    doors.data?.items.find((door) => door.environment.id === environment.id);
  return (
    <Panel flush title={t('pipelines.frontDoor.titlePlural')} meta={t('pipelines.frontDoor.intro')}>
      {doors.isError ? (
        <LoadFailed bare size="sm" error={doors.error} onRetry={() => void doors.refetch()} />
      ) : !doors.data ? (
        <RowsSkeleton columns={3} rows={3} />
      ) : (
        <ul aria-label={t('pipelines.frontDoor.listLabel')}>
          {environments.map((environment) => (
            <FrontDoorRow
              key={environment.id}
              environment={environment}
              door={doorOf(environment)}
              onEdit={() => setEditing(environment)}
            />
          ))}
        </ul>
      )}
      {editing && (
        <FrontDoorDialog
          environment={editing}
          door={doorOf(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </Panel>
  );
}
