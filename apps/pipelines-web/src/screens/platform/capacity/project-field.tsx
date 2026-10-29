import { useT } from '@bemmoly/core-web';
import { Field, Input, Select } from '@bemmoly/ui';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { regionOfDraft, type BuildProject } from './build-projects.ts';
import type { PoolDraft } from './pool-draft.ts';

/**
 * The project and region a pool's machines run in, for every pool Pipelines starts machines
 * for: CI projects it made and attached ones, grouped by connection. The region follows the
 * project's connection until someone types one.
 */
export function ProjectAndRegion({
  draft,
  projects,
  set,
  regionInvalid,
}: {
  draft: PoolDraft;
  projects: readonly BuildProject[];
  set: (patch: Partial<PoolDraft>) => void;
  regionInvalid: boolean;
}) {
  const t = useT(pipelinesText);
  const region = regionOfDraft(draft, projects);
  const groups = [...new Set(projects.map((project) => project.connection))].map((connection) => ({
    label: connection,
    options: projects
      .filter((project) => project.connection === connection)
      .map((project) => ({
        value: project.id,
        label: project.externalId,
        ...(project.name !== project.externalId ? { description: project.name } : {}),
      })),
  }));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field
        label={t('pipelines.capacity.buildProject')}
        hint={projects.length === 0 ? t('pipelines.capacity.noBuildProjects') : undefined}
      >
        <Select
          searchable
          value={draft.accountId ?? ''}
          placeholder={t('pipelines.capacity.buildProjectPick')}
          groups={groups}
          onChange={(event) => set({ accountId: event.value })}
        />
      </Field>
      <Field
        label={t('pipelines.capacity.buildRegion')}
        error={region && regionInvalid ? t('pipelines.clouds.regionInvalid') : null}
      >
        <Input
          mono
          value={region}
          placeholder={t('pipelines.environments.regionExample')}
          onChange={(event) => set({ region: event.target.value.trim() })}
        />
      </Field>
    </div>
  );
}
