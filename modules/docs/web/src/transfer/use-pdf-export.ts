import type { PdfExportBody } from '@bemmoly/module-docs/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { download } from './download.ts';

/** How long the dialog waits for one page's PDF before handing it to the inbox. */
const WAIT_MS = 20_000;
const POLL_MS = 1_000;

/**
 * Whether this install renders PDFs. Until the answer arrives, and if it fails, the answer is
 * no: the browser's print view always works, so nothing promises a file the server cannot make.
 */
export function useServerPdf(): boolean {
  const { data } = useQuery({
    queryKey: docsKeys.exportOptions(),
    queryFn: () => api.docs.transfer.options(),
    staleTime: Infinity,
    retry: false,
  });
  return data?.pdf ?? false;
}

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Queues the PDF and, for one page, waits for it and downloads it. A subtree, or a page that
 * takes longer than the wait, arrives as a notification with its link instead.
 */
export async function exportPdf(
  pageId: string,
  body: PdfExportBody,
): Promise<'downloaded' | 'notify'> {
  let current = await api.docs.transfer.createPdf(pageId, body);
  if (body.scope === 'subtree') return 'notify';
  const until = Date.now() + WAIT_MS;
  while (current.status === 'queued' && Date.now() < until) {
    await pause(POLL_MS);
    current = await api.docs.transfer.pdf(current.id);
  }
  if (current.status === 'failed') throw new Error(current.error ?? 'The PDF could not be made');
  if (current.status !== 'ready' || !current.downloadUrl) return 'notify';
  download(current.downloadUrl);
  return 'downloaded';
}
