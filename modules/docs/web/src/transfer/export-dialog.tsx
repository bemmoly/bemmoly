import type { PageDetail, PdfPaper } from '@bemmoly/module-docs/shared';
import type { RichTextDoc } from '@bemmoly/editor';
import { Button, Checkbox, Modal, SegmentedControl, useToast } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { create } from 'zustand';
import { usePageScreen } from '../page/screen-context.ts';
import { api } from '../shared/api.ts';
import { useSession } from '../shared/people.ts';
import { download } from './download.ts';
import { exportPdf, useServerPdf } from './use-pdf-export.ts';

type Format = 'markdown' | 'html' | 'pdf';

/** Which page's Export… is open, and the format it opens on; the menu closes first. */
export const useExportDialog = create<{
  open: boolean;
  format: Format;
  show: (format?: Format) => void;
  hide: () => void;
}>((set) => ({
  open: false,
  format: 'markdown',
  show: (format = 'markdown') => set({ open: true, format }),
  hide: () => set({ open: false }),
}));

interface FormatChoice {
  id: Format;
  label: string;
  hint: string;
  icon: IconName;
}

const formatsFor = (serverPdf: boolean): readonly FormatChoice[] => [
  { id: 'markdown', label: 'Markdown', hint: 'A .md file, for other tools and Git', icon: 'doc' },
  { id: 'html', label: 'HTML', hint: 'One file that reads the same offline', icon: 'globe' },
  serverPdf
    ? { id: 'pdf', label: 'PDF', hint: 'A file with page numbers, ready to share', icon: 'print' }
    : { id: 'pdf', label: 'PDF', hint: 'Through your browser’s Save as PDF', icon: 'print' },
];

const PAPERS = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
] as const;

function FormatTile({
  format,
  chosen,
  onChoose,
}: {
  format: FormatChoice;
  chosen: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onChoose}
      className={
        'flex cursor-pointer flex-col gap-1 rounded-card border bg-card p-3 text-left font-sans outline-0 ' +
        'focus-visible:shadow-ring motion-safe:transition-[border-color,box-shadow] ' +
        (chosen ? 'border-acc bg-acc-50 shadow-ring' : 'border-line hover:border-line')
      }
    >
      <span className={`flex items-center gap-2 ${chosen ? 'text-acc' : 'text-tx-2'}`}>
        <Icon name={format.icon} size={15} />
        <span className="text-13 font-semibold text-tx">{format.label}</span>
      </span>
      <span className="text-12 leading-body text-tx-3">{format.hint}</span>
    </button>
  );
}

interface ExportRun {
  page: PageDetail;
  live: RichTextDoc | null;
  format: Format;
  subtree: boolean;
  paper: PdfPaper;
  serverPdf: boolean;
}

/** Starts the export: a server file, a PDF from the renderer, or the browser's print view. */
async function runExport(
  run: ExportRun,
): Promise<'downloading' | 'downloaded' | 'notify' | 'printed'> {
  const scope = run.subtree ? 'subtree' : 'page';
  if (run.format === 'pdf' && run.serverPdf) {
    return exportPdf(run.page.id, { scope, paper: run.paper });
  }
  if (run.format === 'pdf') {
    const { printAsPdf } = await import('./print-pdf.ts');
    await printAsPdf(
      run.live ?? (run.page.snapshot as RichTextDoc | null),
      run.page,
      location.origin,
    );
    return 'printed';
  }
  download(api.docs.transfer.exportUrl(run.page.id, { format: run.format, scope }));
  return 'downloading';
}

/**
 * Export…: Markdown, HTML or PDF, with the pages under it when the person may export the
 * space. With the PDF renderer the server makes the file; without it PDF prints what is on
 * screen through the browser, one page, so an edit made a moment ago is in it.
 */
export function ExportDialogHost() {
  const { page, editor } = usePageScreen();
  const { open, format, hide } = useExportDialog();
  return (
    <ExportDialog
      key={open ? `open-${format}` : 'closed'}
      open={open}
      initialFormat={format}
      page={page}
      liveDoc={() => (editor?.getJSON() as RichTextDoc | undefined) ?? null}
      onClose={hide}
    />
  );
}

export interface ExportDialogProps {
  open: boolean;
  page: PageDetail;
  initialFormat?: Format;
  /** The body as it is on screen now, when the editor is open. */
  liveDoc?: () => RichTextDoc | null;
  onClose: () => void;
}

const NOTICES = {
  downloading: { tone: 'info', title: 'Preparing your download', duration: 2500 },
  downloaded: { tone: 'ok', title: 'Your PDF is downloading', duration: 2500 },
  notify: {
    tone: 'info',
    title: 'Making your PDF',
    body: 'It will be in your inbox with a download link when it is ready.',
  },
} as const;

export function ExportDialog({
  open,
  page,
  initialFormat = 'markdown',
  liveDoc,
  onClose: hide,
}: ExportDialogProps) {
  const { can } = useSession();
  const toast = useToast();
  const serverPdf = useServerPdf();
  const [format, setFormat] = useState<Format>(initialFormat);
  const [subtree, setSubtree] = useState(false);
  const [paper, setPaper] = useState<PdfPaper>('a4');
  const [busy, setBusy] = useState(false);
  const browserPrint = format === 'pdf' && !serverPdf;
  const canSubtree = page.hasChildren && can('docs.space.export') && !browserPrint;

  const submit = async () => {
    setBusy(true);
    try {
      const result = await runExport({
        page,
        live: liveDoc?.() ?? null,
        format,
        subtree: canSubtree && subtree,
        paper,
        serverPdf,
      });
      hide();
      if (result !== 'printed') toast.show(NOTICES[result]);
    } catch (error) {
      toast.show({
        tone: 'danger',
        title: 'The export did not start',
        body: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open && !page.deletedAt}
      onClose={hide}
      width="md"
      title={`Export “${page.title || 'Untitled'}”`}
      footer={
        <>
          <Button variant="ghost" onClick={hide}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {browserPrint ? 'Open print view' : 'Export'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div
          role="radiogroup"
          aria-label="Format"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {formatsFor(serverPdf).map((item) => (
            <FormatTile
              key={item.id}
              format={item}
              chosen={format === item.id}
              onChoose={() => setFormat(item.id)}
            />
          ))}
        </div>
        {format === 'pdf' && serverPdf && (
          <div className="flex items-center justify-between gap-3">
            <span id="export-paper" className="text-13 text-tx-2">
              Paper
            </span>
            <SegmentedControl
              size="sm"
              aria-labelledby="export-paper"
              options={PAPERS}
              value={paper}
              onChange={setPaper}
            />
          </div>
        )}
        {canSubtree && (
          <Checkbox
            checked={subtree}
            onChange={(event) => setSubtree(event.target.checked)}
            label={
              format === 'pdf'
                ? 'Include the pages under it, with a contents page'
                : 'Include the pages under it (a .zip)'
            }
          />
        )}
      </div>
    </Modal>
  );
}
