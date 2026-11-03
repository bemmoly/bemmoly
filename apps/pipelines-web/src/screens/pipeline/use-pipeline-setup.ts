import type {
  PipelineSetup,
  SavedPipelineSetup,
  SavePipelineDefinitionBody,
  SavePipelineSetupBody,
} from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryKeys } from '../../api/delivery.ts';
import { pipelineSetupKeys } from '../../api/pipeline-setup.ts';
import { setupKeys } from '../../api/setup.ts';
import { api } from '../../lib/api.ts';

/** A service's pipeline setup, its pipeline as stored, and the built-in templates. */
export function usePipelineSetup(key: string) {
  return useQuery({
    queryKey: pipelineSetupKeys.setup(key),
    queryFn: () => api.pipelineSetup.setup(key),
    enabled: key.length > 0,
  });
}

export function useBuiltInTemplates() {
  return useQuery({
    queryKey: pipelineSetupKeys.builtInTemplates(),
    queryFn: () => api.pipelineSetup.builtInTemplates(),
  });
}

export function useRepositoryFiles(key: string, enabled: boolean) {
  return useQuery({
    queryKey: pipelineSetupKeys.repositoryFiles(key),
    queryFn: () => api.pipelineSetup.repositoryFiles(key),
    enabled: enabled && key.length > 0,
  });
}

/** The pipeline as stored (GET …/pipeline), which the editor draws and edits. */
export function useStoredPipeline(key: string, enabled = true) {
  return useQuery({
    queryKey: deliveryKeys.pipeline(key),
    queryFn: () => api.delivery.applicationPipeline(key),
    enabled: enabled && key.length > 0,
  });
}

/**
 * Whether the fresh-install checklist is still open; a finished setup step goes back to it.
 * Answers false when the checklist cannot be read, so a step never strands anyone.
 */
export function useChecklistOpen(): boolean {
  const checklist = useQuery({
    queryKey: setupKeys.checklist(),
    queryFn: () => api.setup.checklist(),
    retry: false,
  });
  return checklist.data ? !checklist.data.complete : false;
}

function useSaved(key: string) {
  const client = useQueryClient();
  return (saved: SavedPipelineSetup) => {
    const setup: PipelineSetup = {
      application: saved.application,
      start: saved.start,
      template: saved.template,
      repositoryFile: saved.repositoryFile,
      store: saved.store,
      versionScheme: saved.versionScheme,
      triggers: saved.triggers,
    };
    client.setQueryData(pipelineSetupKeys.setup(key), setup);
    void client.invalidateQueries({ queryKey: deliveryKeys.pipeline(key) });
    void client.invalidateQueries({ queryKey: setupKeys.all });
  };
}

export function useSaveSetup(key: string) {
  const saved = useSaved(key);
  return useMutation({
    mutationFn: (body: Omit<SavePipelineSetupBody, 'triggers'>) =>
      api.pipelineSetup.save(key, body),
    onSuccess: saved,
  });
}

export function useSaveDefinition(key: string) {
  const saved = useSaved(key);
  return useMutation({
    mutationFn: (body: SavePipelineDefinitionBody) => api.pipelineSetup.saveDefinition(key, body),
    onSuccess: saved,
  });
}
