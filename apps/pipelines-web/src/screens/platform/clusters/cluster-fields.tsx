import { useT } from '@bemmoly/core-web';
import { Field, Input } from '@bemmoly/ui';
import { pipelinesText } from '../../../i18n/catalog.ts';
import type { ClusterDraft, ClusterField, shownOf } from './cluster-draft.ts';

/** Where an attached cluster is, and the Gateway its owners run when routes should use it. */
export function ClusterFields({
  draft,
  shown,
  problems,
  set,
}: {
  draft: ClusterDraft;
  shown: ReturnType<typeof shownOf>;
  problems: ReadonlySet<ClusterField>;
  set: (patch: Partial<ClusterDraft>) => void;
}) {
  const t = useT(pipelinesText);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={t('pipelines.clouds.projectId')}
          error={problems.has('projectId') ? t('pipelines.clouds.projectIdInvalid') : null}
        >
          <Input
            mono
            value={shown.projectId}
            onChange={(event) => set({ projectId: event.target.value.trim() })}
          />
        </Field>
        <Field
          label={t('pipelines.clusters.location')}
          hint={t('pipelines.clusters.locationHint')}
          error={problems.has('location') ? t('pipelines.clusters.locationInvalid') : null}
        >
          <Input
            mono
            value={shown.location}
            onChange={(event) => set({ location: event.target.value.trim() })}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium text-tx">{t('pipelines.clusters.gateway')}</legend>
        <p className="text-12 text-tx-3">{t('pipelines.clusters.gatewayHint')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={t('pipelines.clusters.gatewayNamespace')}
            error={problems.has('gateway') ? t('pipelines.clusters.gatewayInvalid') : null}
          >
            <Input
              mono
              value={draft.gatewayNamespace}
              onChange={(event) => set({ gatewayNamespace: event.target.value })}
            />
          </Field>
          <Field label={t('pipelines.clusters.gatewayName')}>
            <Input
              mono
              value={draft.gatewayName}
              onChange={(event) => set({ gatewayName: event.target.value })}
            />
          </Field>
        </div>
      </fieldset>
    </>
  );
}
