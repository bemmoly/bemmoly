import type { ExportQuery } from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { exportKeys } from '../api/exports.ts';
import { api } from '../lib/api.ts';

/** Starts a download of `url` without leaving the page. */
function download(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

/** What the export holds now: one directory per connection. */
export function useExportPreview(query: ExportQuery = {}) {
  return useQuery({
    queryKey: exportKeys.preview(query),
    queryFn: () => api.exports.preview(query),
  });
}

/**
 * Downloads the zip. The preview is asked for first, so a refusal or an application with
 * nothing to export shows as an error here instead of a failed download in the browser.
 */
export function useExportDownload() {
  return useMutation({
    mutationFn: async (query: ExportQuery = {}) => {
      const preview = await api.exports.preview(query);
      download(api.exports.archiveUrl(query));
      return preview;
    },
  });
}
