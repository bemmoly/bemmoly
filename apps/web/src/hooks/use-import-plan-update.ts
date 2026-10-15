import { queryKeys } from '@bemmoly/api-client';
import type { ImportJob, UpdateImportBody } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importsApi } from '../lib/imports-api.ts';

/**
 * One change on Options (a tick, a key, a target, a person): PATCH answers with the new plan,
 * which replaces the cached job; the rows and people it moved are read again.
 */
export function useImportPlanUpdate(jobId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateImportBody) => importsApi.update(jobId, body),
    onSuccess: (job: ImportJob) => {
      client.setQueryData(queryKeys.imports.detail(job.id), job);
      void client.invalidateQueries({
        queryKey: [...queryKeys.imports.detail(jobId), 'containers'],
      });
      void client.invalidateQueries({ queryKey: queryKeys.imports.people(jobId) });
    },
  });
}

export type ImportPlanUpdate = ReturnType<typeof useImportPlanUpdate>;
