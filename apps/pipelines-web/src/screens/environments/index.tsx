import { useT } from '@bemmoly/core-web';
import type { EnvironmentV2View } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, Skeleton, buttonClassName } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  useEnvironmentsV2,
  useEnvironmentV2Writes,
  useReachableProjects,
} from '../../hooks/use-environments-v2.ts';
import { useChecklist } from '../../hooks/use-setup.ts';
import { environmentsText } from '../../i18n/catalog.ts';
import { ActionError } from '../../parts/action-error.tsx';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { EnvironmentCard } from './environment-card.tsx';
import { EnvironmentDialog } from './environment-dialog.tsx';
import { SuggestedDialog } from './suggested-dialog.tsx';

type Open =
  { kind: 'suggest' } | { kind: 'add' } | { kind: 'edit'; environment: EnvironmentV2View };

/**
 * Environments: the one ordered path versions move along, every environment equal (product
 * rule 3). Empty, it offers Add an environment and Use a suggested setup; each card lists
 * every setting, and the arrows reorder the path.
 */
export default function EnvironmentsScreen() {
  const t = useT(environmentsText);
  const list = useEnvironmentsV2();
  const projects = useReachableProjects();
  const checklist = useChecklist().data;
  const { reorder } = useEnvironmentV2Writes();
  const [open, setOpen] = useState<Open | null>(null);
  const items = list.data?.items ?? [];
  const cloud =
    checklist?.steps.find((step) => step.key === 'cloud')?.done ?? projects.data?.length !== 0;
  const move = (index: number, by: -1 | 1) => {
    const keys = items.map((environment) => environment.key);
    const [key] = keys.splice(index, 1);
    if (key) keys.splice(index + by, 0, key);
    reorder.mutate(keys);
  };
  const add = (
    <Button icon={<Icon name="plus" size={16} />} onClick={() => setOpen({ kind: 'add' })}>
      {t('pipelinesEnvironments.list.add')}
    </Button>
  );
  return (
    <ScreenFrame
      title={t('pipelinesEnvironments.list.title')}
      meta={
        items.length
          ? t('pipelinesEnvironments.list.meta', { count: items.length })
          : t('pipelinesEnvironments.list.intro')
      }
      actions={items.length ? add : undefined}
    >
      {list.isError ? (
        <LoadFailed error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-72" />
      ) : items.length === 0 ? (
        <div className="rounded-card border border-line bg-card py-12 shadow-e1">
          {cloud ? (
            <EmptyState
              icon={<Icon name="layers" size={18} />}
              title={t('pipelinesEnvironments.empty.title')}
              description={t('pipelinesEnvironments.empty.text')}
              headingLevel={2}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {add}
                  <Button
                    variant="primary"
                    icon={<Icon name="spark" size={16} />}
                    disabled={!projects.data}
                    onClick={() => setOpen({ kind: 'suggest' })}
                  >
                    {t('pipelinesEnvironments.list.suggest')}
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={<Icon name="cloud-off" size={18} />}
              title={t('pipelinesEnvironments.empty.cloudTitle')}
              description={t('pipelinesEnvironments.empty.cloudText')}
              headingLevel={2}
              action={
                <Link to="/setup/cloud" className={buttonClassName({ variant: 'primary' })}>
                  {t('pipelinesEnvironments.empty.cloudAction')}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <ol
          aria-label={t('pipelinesEnvironments.list.path')}
          className="grid grid-cols-1 gap-3 md:grid-flow-col md:auto-cols-fr md:gap-0"
        >
          {items.map((environment, index) => (
            <li key={environment.id} className="flex flex-col items-stretch md:flex-row">
              {index > 0 && (
                <span
                  aria-hidden
                  className="grid place-items-center py-1 text-tx-3 md:w-10 md:py-0"
                >
                  <Icon name="arrow-right" size={16} className="rotate-90 md:rotate-0" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <EnvironmentCard
                  environment={environment}
                  previous={items[index - 1]?.name ?? null}
                  first={index === 0}
                  last={index === items.length - 1}
                  onEdit={() => setOpen({ kind: 'edit', environment })}
                  onMove={(by) => move(index, by)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      <ActionError error={reorder.error} />
      {open?.kind === 'suggest' && (
        <SuggestedDialog projects={projects.data ?? []} onClose={() => setOpen(null)} />
      )}
      {(open?.kind === 'add' || open?.kind === 'edit') && (
        <EnvironmentDialog
          environment={open.kind === 'edit' ? open.environment : null}
          projects={projects.data ?? []}
          onClose={() => setOpen(null)}
        />
      )}
    </ScreenFrame>
  );
}
