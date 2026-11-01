import { useT } from '@bemmoly/core-web';
import { cloudBuildMachineSchema, type CloudBuildMachine } from '@bemmoly/module-pipelines/shared';
import { Field, Input, Select } from '@bemmoly/ui';
import { pipelinesText } from '../../../i18n/catalog.ts';
import {
  cloudBuildProblems,
  serviceAccountOfDraft,
  type BuildProject,
  type PoolDraft,
} from './pool-draft.ts';
import { ProjectAndRegion } from './project-field.tsx';

/**
 * A Cloud Build pool's settings: the project builds run in, its region, the runner image,
 * the machine size, the service account builds run as and how many may run at once. Errors
 * show once a field has something in it, so an empty form is not a wall of red.
 */
export function CloudBuildFields({
  draft,
  projects,
  set,
}: {
  draft: PoolDraft;
  projects: readonly BuildProject[];
  set: (patch: Partial<PoolDraft>) => void;
}) {
  const t = useT(pipelinesText);
  const problems = new Set(cloudBuildProblems(draft, projects));
  const serviceAccount = serviceAccountOfDraft(draft, projects);
  return (
    <div className="flex flex-col gap-3.5">
      <ProjectAndRegion
        draft={draft}
        projects={projects}
        set={set}
        regionInvalid={problems.has('region')}
      />
      <Field
        label={t('pipelines.capacity.buildImage')}
        hint={t('pipelines.capacity.buildImageHint')}
        error={
          draft.image && problems.has('image') ? t('pipelines.capacity.buildImageInvalid') : null
        }
      >
        <Input
          mono
          value={draft.image}
          placeholder={t('pipelines.capacity.buildImageExample')}
          onChange={(event) => set({ image: event.target.value })}
        />
      </Field>
      <Field
        label={t('pipelines.capacity.buildServiceAccount')}
        hint={t('pipelines.capacity.buildServiceAccountHint')}
        error={
          serviceAccount && problems.has('serviceAccount')
            ? t('pipelines.capacity.buildServiceAccountInvalid')
            : null
        }
      >
        <Input
          mono
          value={serviceAccount}
          placeholder={t('pipelines.capacity.buildServiceAccountExample')}
          onChange={(event) => set({ serviceAccount: event.target.value.trim() })}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('pipelines.capacity.buildMachine')}>
          <Select
            value={draft.machine}
            options={cloudBuildMachineSchema.options.map((value) => ({
              value,
              label: value === 'default' ? t('pipelines.capacity.buildMachineDefault') : value,
            }))}
            onChange={(event) => set({ machine: event.value as CloudBuildMachine })}
          />
        </Field>
        <Field label={t('pipelines.capacity.buildMax')} hint={t('pipelines.capacity.buildMaxHint')}>
          <Input
            type="number"
            min={1}
            value={draft.max}
            onChange={(event) => set({ max: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
