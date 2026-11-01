import { useT } from '@bemmoly/core-web';
import { DEFAULT_BUILDER_IMAGE } from '@bemmoly/module-pipelines/shared';
import { Checkbox, Field, Input } from '@bemmoly/ui';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { autopilotProblems, createsCluster, mayCreateCluster } from './autopilot-draft.ts';
import { serviceAccountOfDraft, type BuildProject, type PoolDraft } from './pool-draft.ts';
import { ProjectAndRegion } from './project-field.tsx';

/**
 * A GKE Autopilot pool's settings: the project and region, the cluster (created by Pipelines
 * in a CI project it made, or one that exists), the runner image, what each runner pod asks
 * for, Spot capacity, the service account pods act as, how many runners stay warm and how
 * many may run at once, and the image builds run in. Errors show once a field has something.
 */
export function AutopilotFields({
  draft,
  projects,
  set,
}: {
  draft: PoolDraft;
  projects: readonly BuildProject[];
  set: (patch: Partial<PoolDraft>) => void;
}) {
  const t = useT(pipelinesText);
  const problems = new Set(autopilotProblems(draft, projects));
  const serviceAccount = serviceAccountOfDraft(draft, projects);
  const mayCreate = mayCreateCluster(draft, projects);
  const error = (
    field: Parameters<typeof problems.has>[0],
    value: string,
    key: Parameters<typeof t>[0],
  ) => (value && problems.has(field) ? t(key) : null);
  return (
    <div className="flex flex-col gap-3.5">
      <ProjectAndRegion
        draft={draft}
        projects={projects}
        set={set}
        regionInvalid={problems.has('location')}
      />
      <Field
        label={t('pipelines.capacity.podCluster')}
        hint={
          mayCreate
            ? t('pipelines.capacity.podClusterCreateHint')
            : t('pipelines.capacity.podClusterHint')
        }
        error={error('cluster', draft.cluster, 'pipelines.capacity.podClusterInvalid')}
      >
        <Input
          mono
          value={draft.cluster}
          onChange={(event) => set({ cluster: event.target.value.trim() })}
        />
      </Field>
      {mayCreate && (
        <Checkbox
          label={t('pipelines.capacity.podCreate')}
          description={t('pipelines.capacity.podCreateHint')}
          checked={createsCluster(draft, projects)}
          onChange={(event) => set({ createCluster: event.target.checked })}
        />
      )}
      <Field
        label={t('pipelines.capacity.buildImage')}
        hint={t('pipelines.capacity.podImageHint')}
        error={error('image', draft.image, 'pipelines.capacity.buildImageInvalid')}
      >
        <Input
          mono
          value={draft.image}
          placeholder={t('pipelines.capacity.podImageExample')}
          onChange={(event) => set({ image: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={t('pipelines.capacity.podCpu')}
          hint={t('pipelines.capacity.podSizeHint')}
          error={error('cpu', draft.cpu, 'pipelines.capacity.podCpuInvalid')}
        >
          <Input
            type="number"
            min={0.5}
            step={0.25}
            value={draft.cpu}
            onChange={(event) => set({ cpu: event.target.value })}
          />
        </Field>
        <Field
          label={t('pipelines.capacity.podMemory')}
          error={error('memoryGb', draft.memory, 'pipelines.capacity.podMemoryInvalid')}
        >
          <Input
            type="number"
            min={1}
            step={0.5}
            value={draft.memory}
            onChange={(event) => set({ memory: event.target.value })}
          />
        </Field>
      </div>
      <Checkbox
        label={t('pipelines.capacity.podSpot')}
        description={t('pipelines.capacity.podSpotHint')}
        checked={draft.spot}
        onChange={(event) => set({ spot: event.target.checked })}
      />
      <Field
        label={t('pipelines.capacity.podServiceAccount')}
        hint={t('pipelines.capacity.podServiceAccountHint')}
        error={error(
          'serviceAccount',
          serviceAccount,
          'pipelines.capacity.buildServiceAccountInvalid',
        )}
      >
        <Input
          mono
          value={serviceAccount}
          placeholder={t('pipelines.capacity.buildServiceAccountExample')}
          onChange={(event) => set({ serviceAccount: event.target.value.trim() })}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('pipelines.capacity.podWarm')} hint={t('pipelines.capacity.podWarmHint')}>
          <Input
            type="number"
            min={0}
            value={draft.min}
            onChange={(event) => set({ min: event.target.value })}
          />
        </Field>
        <Field label={t('pipelines.capacity.podMax')} hint={t('pipelines.capacity.buildMaxHint')}>
          <Input
            type="number"
            min={1}
            value={draft.max}
            onChange={(event) => set({ max: event.target.value })}
          />
        </Field>
      </div>
      <Field
        label={t('pipelines.capacity.podBuilder')}
        hint={t('pipelines.capacity.podBuilderHint')}
        error={error('builderImage', draft.builderImage, 'pipelines.capacity.buildImageInvalid')}
      >
        <Input
          mono
          value={draft.builderImage}
          placeholder={DEFAULT_BUILDER_IMAGE}
          onChange={(event) => set({ builderImage: event.target.value })}
        />
      </Field>
    </div>
  );
}
