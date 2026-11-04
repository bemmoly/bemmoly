import type {
  PipelineSetup,
  PipelineSpec,
  PipelineStepSpec,
  PipelineTrigger,
} from '@bemmoly/module-pipelines/shared';
import { useState } from 'react';
import { useEnvironments } from '../../../hooks/use-environments.ts';
import { useSaveDefinition } from '../use-pipeline-setup.ts';
import {
  addStep,
  editable,
  removeStep,
  updateStep,
  type EditorEnvironment,
  type NewStep,
} from './model.ts';

/*
 * The editor's state: the pipeline as it is being drawn, its triggers, the selected step and
 * which view shows. Nothing is saved until Save; the stored pipeline stays the truth until then.
 */

export type EditorView = 'visual' | 'yaml';

export function useEditor(service: string, setup: PipelineSetup, stored: unknown) {
  const [definition, setDefinition] = useState<PipelineSpec | null>(() => editable(stored));
  const [triggers, setTriggers] = useState<PipelineTrigger[]>(setup.triggers);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<EditorView>('visual');
  const [dirty, setDirty] = useState(false);
  const save = useSaveDefinition(service);
  const environmentsQuery = useEnvironments();

  // A save or another tab's change arrives as a new stored pipeline: start from it again.
  const [basis, setBasis] = useState({ stored, triggers: setup.triggers });
  if (basis.stored !== stored || basis.triggers !== setup.triggers) {
    setBasis({ stored, triggers: setup.triggers });
    setDefinition(editable(stored));
    setTriggers(setup.triggers);
    setDirty(false);
  }

  const environments: EditorEnvironment[] = (environmentsQuery.data?.items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((environment) => ({
      key: environment.key,
      name: environment.name,
      where: environment.cloudAccount?.externalId ?? null,
    }));
  const order = environments.map((environment) => environment.key);

  const change = (next: PipelineSpec) => {
    setDefinition(next);
    setDirty(true);
  };

  return {
    definition,
    triggers,
    environments,
    selected,
    select: setSelected,
    view,
    setView,
    dirty: dirty || triggers !== setup.triggers,
    save,
    add(kind: NewStep, name: string, environment: string | null) {
      if (!definition) return;
      const added = addStep(definition, kind, name, environment, order);
      change(added.definition);
      setSelected(added.key);
    },
    update(key: string, patch: Partial<PipelineStepSpec>) {
      if (definition) change(updateStep(definition, key, patch));
    },
    updateBuild(patch: Partial<NonNullable<PipelineSpec['build']>>) {
      if (definition?.build) change({ ...definition, build: { ...definition.build, ...patch } });
    },
    remove(key: string) {
      if (!definition) return;
      change(removeStep(definition, key));
      setSelected(null);
    },
    setTriggers,
    submit() {
      if (!definition) return;
      save.mutate({ definition, triggers });
    },
  };
}

export type Editor = ReturnType<typeof useEditor>;
