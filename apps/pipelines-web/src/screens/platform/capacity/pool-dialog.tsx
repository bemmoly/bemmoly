import { useT } from '@bemmoly/core-web';
import type { PoolHosting, RunnerPool } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, SelectableCard, Select } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { useState, type KeyboardEvent } from 'react';
import { useAllCloudAccounts } from '../../../hooks/use-clouds.ts';
import { usePoolWrites } from '../../../hooks/use-capacity.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { slugOf } from '../../../lib/slug.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { AutopilotFields } from './autopilot-fields.tsx';
import { CloudBuildFields } from './cloud-build-fields.tsx';
import {
  buildProjects,
  createPoolBodyOf,
  draftOfPool,
  NEW_POOL,
  POOL_KINDS,
  poolReady,
  STARTED_HOSTINGS,
  updatePoolBodyOf,
  type PoolDraft,
  type PoolKind,
  type StartedHosting,
} from './pool-draft.ts';
import { TokenReveal } from './token-reveal.tsx';

const KIND_WORDS = {
  start: {
    icon: 'monitor',
    title: 'pipelines.capacity.kindStart',
    hint: 'pipelines.capacity.kindStartHint',
  },
  'cloud-build': {
    icon: 'cloud',
    title: 'pipelines.capacity.kindCloudBuild',
    hint: 'pipelines.capacity.kindCloudBuildHint',
  },
  'gke-autopilot': {
    icon: 'layers',
    title: 'pipelines.capacity.kindAutopilot',
    hint: 'pipelines.capacity.kindAutopilotHint',
  },
} as const satisfies Record<PoolKind, { icon: IconName; title: string; hint: string }>;

const HOSTING = {
  vm: 'pipelines.hosting.vm',
  kubernetes: 'pipelines.hosting.kubernetes',
  local: 'pipelines.hosting.local',
} as const satisfies Record<StartedHosting, string>;

/**
 * Add runner pool, or Change where it runs for one pool: machines people start with the pool's
 * token, Google Cloud Build starting one build per job, or GKE Autopilot starting one pod per
 * job. A new pool of machines you start shows its token once after; the others need none.
 * Mounted per opening.
 */
export function PoolDialog({ pool, onClose }: { pool: RunnerPool | null; onClose: () => void }) {
  const t = useT(pipelinesText);
  const { create, update } = usePoolWrites();
  const write = pool ? update : create;
  const clouds = useAllCloudAccounts();
  const projects = buildProjects(clouds.items);
  const [draft, setDraft] = useState<PoolDraft>(pool ? draftOfPool(pool) : NEW_POOL);
  const set = (patch: Partial<PoolDraft>) => setDraft((now) => ({ ...now, ...patch }));
  const key = slugOf(draft.name);
  const changes = pool ? updatePoolBodyOf(pool, draft, projects) : null;
  const ready = poolReady(draft, projects) && (!changes || Object.keys(changes).length > 0);
  const startsOwn = (hosting: PoolHosting) =>
    hosting === 'cloud-build' || hosting === 'gke-autopilot';
  const token =
    create.data && !startsOwn(create.data.pool.hosting) ? create.data.token.token : null;
  const added = create.data?.pool ?? null;
  const submit = () => {
    if (!ready || write.isPending) return;
    if (pool && changes) update.mutate({ key: pool.key, body: changes }, { onSuccess: onClose });
    else create.mutate(createPoolBodyOf(draft, projects));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  if (added) {
    return (
      <Modal
        open
        onClose={onClose}
        title={t('pipelines.capacity.poolAdded', { name: added.name })}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t('pipelines.capacity.done')}
          </Button>
        }
      >
        {token ? (
          <TokenReveal token={token} />
        ) : (
          <p className="text-13 text-tx">
            {added.hosting === 'gke-autopilot'
              ? t('pipelines.capacity.autopilotAdded')
              : t('pipelines.capacity.cloudBuildAdded')}
          </p>
        )}
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={
        pool
          ? t('pipelines.capacity.editTitle', { name: pool.name })
          : t('pipelines.capacity.addPool')
      }
      description={pool ? undefined : t('pipelines.capacity.addPoolDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={write.isPending} onClick={submit}>
            {pool ? t('pipelines.capacity.savePool') : t('pipelines.capacity.addPool')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5" onKeyDown={onKeyDown}>
        <Field
          label={t('pipelines.capacity.poolName')}
          hint={key && !pool ? t('pipelines.capacity.poolKey', { key }) : undefined}
        >
          <Input
            value={draft.name}
            onChange={(event) => set({ name: event.target.value })}
            autoFocus
          />
        </Field>
        <div
          role="radiogroup"
          aria-label={t('pipelines.capacity.hosting')}
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          {POOL_KINDS.map((kind) => (
            <SelectableCard
              key={kind}
              selected={draft.kind === kind}
              onClick={() => set({ kind })}
              className="gap-1 p-3.5"
            >
              <span className="flex items-center gap-2">
                <Icon name={KIND_WORDS[kind].icon} size={16} className="text-tx-2" />
                <span className="font-medium">{t(KIND_WORDS[kind].title)}</span>
              </span>
              <span className="text-12 text-tx-2">{t(KIND_WORDS[kind].hint)}</span>
            </SelectableCard>
          ))}
        </div>
        {draft.kind === 'cloud-build' ? (
          <CloudBuildFields draft={draft} projects={projects} set={set} />
        ) : draft.kind === 'gke-autopilot' ? (
          <AutopilotFields draft={draft} projects={projects} set={set} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('pipelines.capacity.startedOn')}>
              <Select
                value={draft.hosting}
                options={STARTED_HOSTINGS.map((value) => ({ value, label: t(HOSTING[value]) }))}
                onChange={(event) => set({ hosting: event.value as StartedHosting & PoolHosting })}
              />
            </Field>
            <Field label={t('pipelines.capacity.location')}>
              <Input
                value={draft.location}
                placeholder={t('pipelines.capacity.locationExample')}
                onChange={(event) => set({ location: event.target.value })}
              />
            </Field>
            <Field label={t('pipelines.capacity.minRunners')}>
              <Input
                type="number"
                min={0}
                value={draft.min}
                onChange={(event) => set({ min: event.target.value })}
              />
            </Field>
            <Field label={t('pipelines.capacity.maxRunners')}>
              <Input
                type="number"
                min={1}
                value={draft.max}
                onChange={(event) => set({ max: event.target.value })}
              />
            </Field>
          </div>
        )}
        <ActionError error={write.error} />
      </div>
    </Modal>
  );
}
