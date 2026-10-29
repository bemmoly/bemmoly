import { useT } from '@bemmoly/core-web';
import type { CloudConnection, Environment } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, SegmentedControl } from '@bemmoly/ui';
import { useId, useState, type KeyboardEvent } from 'react';
import { useClusterWrites } from '../../../hooks/use-runtimes.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import {
  clusterBodyOf,
  clusterDefaults,
  clusterProblems,
  NEW_CLUSTER,
  shownOf,
  type ClusterDraft,
} from './cluster-draft.ts';
import { ClusterSummary } from './cluster-summary.tsx';
import { ClusterFields } from './cluster-fields.tsx';

/**
 * Create a cluster… on a managed connection (Autopilot or Standard, and its name), or Attach a
 * cluster… on an attached one (where it is, and optionally the Gateway its owners run). The
 * answer is the cluster as GKE and its check left it; a failed check is kept, so the dialog
 * shows what to grant rather than an error.
 */
export function ClusterDialog({
  environment,
  connection,
  open,
  onClose,
}: {
  environment: Environment;
  connection: CloudConnection;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const modeLabel = useId();
  const { add } = useClusterWrites();
  const attaching = connection.mode === 'attached';
  const [draft, setDraft] = useState<ClusterDraft>(NEW_CLUSTER);
  const set = (patch: Partial<ClusterDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const defaults = clusterDefaults(environment, connection);
  const shown = shownOf(draft, defaults);
  const problems = clusterProblems(draft, defaults, attaching);
  const result = add.data;
  const close = () => {
    add.reset();
    setDraft(NEW_CLUSTER);
    onClose();
  };
  const submit = () => {
    if (problems.size === 0 && !add.isPending) {
      add.mutate(clusterBodyOf(draft, defaults, environment.id, attaching));
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') submit();
  };
  const titleOf = () => {
    if (!result) {
      return t(attaching ? 'pipelines.clusters.attachTitle' : 'pipelines.clusters.createTitle', {
        env: environment.name,
      });
    }
    const key = (
      {
        creating: 'pipelines.clusters.resultCreating',
        ready: 'pipelines.clusters.resultReady',
        failed: 'pipelines.clusters.resultNeeds',
      } as const
    )[result.status];
    return t(key, { name: result.name });
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={titleOf()}
      description={
        result
          ? undefined
          : attaching
            ? t('pipelines.clusters.attachDescription')
            : t('pipelines.clusters.createDescription', {
                project: defaults.projectId,
                location: defaults.location,
              })
      }
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            {t('pipelines.capacity.done')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t('pipelines.common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={problems.size > 0}
              loading={add.isPending}
              onClick={submit}
            >
              {t(
                attaching ? 'pipelines.clusters.attachConfirm' : 'pipelines.clusters.createConfirm',
              )}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-3">
          <ClusterSummary cluster={result} />
          <p className="text-12 text-tx-3">
            {result.status === 'creating'
              ? t('pipelines.clusters.resultCreatingNext')
              : result.status === 'ready'
                ? t('pipelines.clusters.resultReadyNext', { env: environment.name })
                : t('pipelines.clusters.resultNeedsNext')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5" onKeyDown={onKeyDown}>
          {!attaching && (
            <div className="flex flex-col gap-1.5">
              <span id={modeLabel} className="font-medium text-tx">
                {t('pipelines.clusters.mode')}
              </span>
              <SegmentedControl
                aria-labelledby={modeLabel}
                value={draft.mode}
                options={[
                  { value: 'autopilot', label: t('pipelines.clusters.modeAutopilot') },
                  { value: 'standard', label: t('pipelines.clusters.modeStandard') },
                ]}
                onChange={(mode) => set({ mode })}
              />
              <p className="text-12 text-tx-3">
                {t(
                  draft.mode === 'autopilot'
                    ? 'pipelines.clusters.autopilotHint'
                    : 'pipelines.clusters.standardHint',
                )}
              </p>
            </div>
          )}
          <Field
            label={t('pipelines.clusters.name')}
            error={problems.has('name') ? t('pipelines.clusters.nameInvalid') : null}
          >
            <Input
              mono
              autoFocus
              value={shown.name}
              onChange={(event) => set({ name: event.target.value.trim() })}
            />
          </Field>
          {attaching ? (
            <ClusterFields draft={draft} shown={shown} problems={problems} set={set} />
          ) : (
            <div className="flex flex-col gap-2 text-12 leading-body text-tx-2">
              <p>{t('pipelines.clusters.runsFor')}</p>
              <p>{t('pipelines.clusters.cost')}</p>
            </div>
          )}
          <ActionError error={add.error} />
        </div>
      )}
    </Modal>
  );
}
