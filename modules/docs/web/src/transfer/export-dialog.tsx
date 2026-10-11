import type { PageDetail } from '@bemmoly/module-docs/shared';
import type { RichTextDoc } from '@bemmoly/editor';
import { Button, Checkbox, Modal, useToast } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { create } from 'zustand';
import { usePageScreen } from '../page/screen-context.ts';
import { api } from '../shared/api.ts';
import { useSession } from '../shared/people.ts';
import { printAsPdf } from './print-pdf.ts';
import { download } from './download.ts';

type Format = 'markdown' | 'html' | 'pdf';

/** Which page's Export… is open; the More menu closes before the dialog opens. */
export const useExportDialog = create<{ open: boolean; show: () => void; hide: () => void }>(
  (set) => ({
    open: false,
    show: () => set({ open: true }),
    hide: () => set({ open: false }),
  }),
);

const FORMATS: readonly { id: Format; label: string; hint: string; icon: IconName }[] = [
  { id: 'markdown', label: 'Markdown', hint: 'A .md file, for other tools and Git', icon: 'doc' },
  { id: 'html', label: 'HTML', hint: 'One file that reads the same offline', icon: 'globe' },
  { id: 'pdf', label: 'PDF', hint: 'Through your browser’s Save as PDF', icon: 'print' },
];

function FormatTile({
  format,
  chosen,
  onChoose,
}: {
  format: (typeof FORMATS)[number];
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

/** Starts the export: a download from the server, or the print view built here for PDF. */
async function runExport(
  page: PageDetail,
  live: RichTextDoc | null,
  format: Format,
  subtree: boolean,
) {
  if (format === 'pdf') {
    await printAsPdf(live ?? (page.snapshot as RichTextDoc | null), page.title, location.origin);
    return;
  }
  download(api.docs.transfer.exportUrl(page.id, { format, scope: subtree ? 'subtree' : 'page' }));
}

/**
 * Export…: Markdown, HTML or PDF, with the pages under it when the person may export the
 * space. PDF prints what is on screen, so an edit made a moment ago is in it.
 */
export function ExportDialogHost() {
  const { page, editor } = usePageScreen();
  const { open, hide } = useExportDialog();
  return (
    <ExportDialog
      open={open}
      page={page}
      liveDoc={() => (editor?.getJSON() as RichTextDoc | undefined) ?? null}
      onClose={hide}
    />
  );
}

export interface ExportDialogProps {
  open: boolean;
  page: PageDetail;
  /** The body as it is on screen now, when the editor is open. */
  liveDoc?: () => RichTextDoc | null;
  onClose: () => void;
}

export function ExportDialog({ open, page, liveDoc, onClose: hide }: ExportDialogProps) {
  const { can } = useSession();
  const toast = useToast();
  const [format, setFormat] = useState<Format>('markdown');
  const [subtree, setSubtree] = useState(false);
  const [busy, setBusy] = useState(false);
  const canSubtree = page.hasChildren && can('docs.space.export') && format !== 'pdf';

  const submit = async () => {
    setBusy(true);
    try {
      await runExport(page, liveDoc?.() ?? null, format, canSubtree && subtree);
      hide();
      if (format !== 'pdf')
        toast.show({ tone: 'info', title: 'Preparing your download', duration: 2500 });
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
            {format === 'pdf' ? 'Open print view' : 'Export'}
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
          {FORMATS.map((item) => (
            <FormatTile
              key={item.id}
              format={item}
              chosen={format === item.id}
              onChoose={() => setFormat(item.id)}
            />
          ))}
        </div>
        {canSubtree && (
          <Checkbox
            checked={subtree}
            onChange={(event) => setSubtree(event.target.checked)}
            label="Include the pages under it (a .zip)"
          />
        )}
      </div>
    </Modal>
  );
}
