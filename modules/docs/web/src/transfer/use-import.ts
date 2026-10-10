import type { ImportResult } from '@bemmoly/module-docs/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { readImportFiles, type ImportFormat, type PickedFile } from './read-files.ts';

export interface ImportInput {
  format: ImportFormat;
  files: readonly PickedFile[];
  parentId?: string | undefined;
}

/**
 * Sends an import. A small one lands at once (completed, with its pages); a big one is
 * queued and the space's tree updates over realtime when it finishes. Either way the tree
 * and the space's counts are refetched now.
 */
export function useImport(spaceRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ format, files, parentId }: ImportInput): Promise<ImportResult> =>
      api.docs.transfer.import(spaceRef, {
        format,
        files: await readImportFiles(files),
        ...(parentId ? { parentId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: docsKeys.spaceTree(spaceRef) });
      void queryClient.invalidateQueries({ queryKey: docsKeys.space(spaceRef) });
      void queryClient.invalidateQueries({ queryKey: docsKeys.recent() });
    },
  });
}
