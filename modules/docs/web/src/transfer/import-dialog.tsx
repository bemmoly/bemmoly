import { Button, Modal, SegmentedControl, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { DropZone } from './drop-zone.tsx';
import { pickFiles, pickProblem, type ImportFormat, type PickedFile } from './read-files.ts';
import { useImport } from './use-import.ts';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** The space the pages land in, by key. */
  space: { key: string; name: string };
  /** Under this page; at the top of the space when absent. */
  parent?: { id: string; title: string } | null;
}

const FORMATS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'confluence', label: 'Confluence export' },
] as const;

/**
 * Import pages into a space: Markdown files (front matter "title" names a page, folders
 * become parent pages) or the HTML pages of a Confluence space export, whose unknown
 * macros become labelled placeholders. A small import lands at once and opens; a big one
 * runs in the background and the tree fills in when it is done.
 */
export function ImportDialog({ open, onClose, space, parent = null }: ImportDialogProps) {
  const [format, setFormat] = useState<ImportFormat>('markdown');
  const [picked, setPicked] = useState<File[]>([]);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const run = useImport(space.key);
  const toast = useToast();
  const problem = pickProblem(files);
  const skipped = picked.length - files.length;

  const pick = (next: File[], nextFormat = format) => {
    const all = [...picked, ...next];
    setPicked(all);
    setFiles(pickFiles(nextFormat, all));
  };

  const close = () => {
    setPicked([]);
    setFiles([]);
    run.reset();
    onClose();
  };

  const submit = () =>
    run.mutate(
      { format, files, parentId: parent?.id },
      {
        onSuccess: (result) => {
          close();
          if (result.status === 'queued') {
            toast.show({
              tone: 'info',
              title: 'Import started',
              body: `The pages appear in ${space.name} when it finishes.`,
            });
            return;
          }
          const placeholders = result.pages.reduce((sum, page) => sum + page.placeholders, 0);
          toast.show({
            tone: 'ok',
            title: `Imported ${result.pages.length} ${result.pages.length === 1 ? 'page' : 'pages'}`,
            ...(placeholders
              ? {
                  body: `${placeholders} unsupported ${placeholders === 1 ? 'macro became a placeholder' : 'macros became placeholders'}.`,
                }
              : {}),
          });
          const first =
            result.pages.find((page) => page.parentId === (parent?.id ?? null)) ?? result.pages[0];
          if (first) navigateTo(docsPaths.page(first.id));
        },
      },
    );

  return (
    <Modal
      open={open}
      onClose={close}
      width="md"
      title={`Import into ${space.name}`}
      description={
        parent
          ? `The pages go under “${parent.title || 'Untitled'}”.`
          : 'The pages go at the top of the space.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={run.isPending}
            disabled={files.length === 0 || Boolean(problem)}
            onClick={submit}
          >
            {files.length > 0
              ? `Import ${files.length} ${files.length === 1 ? 'file' : 'files'}`
              : 'Import'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <SegmentedControl
          size="sm"
          aria-label="Import from"
          options={FORMATS}
          value={format}
          onChange={(next) => {
            setFormat(next);
            setFiles(pickFiles(next, picked));
          }}
        />
        <DropZone
          format={format}
          files={files}
          onPick={(next) => pick(next)}
          onRemove={(path) => {
            const keep = files.filter((file) => file.path !== path);
            setFiles(keep);
            setPicked(keep.map((file) => file.file));
          }}
        />
        {skipped > 0 && (
          <p className="m-0 text-12 text-tx-3">
            {skipped} {skipped === 1 ? 'file is' : 'files are'} not{' '}
            {format === 'markdown' ? 'Markdown' : 'HTML'} and {skipped === 1 ? 'stays' : 'stay'}{' '}
            out.
          </p>
        )}
        {(problem || run.isError) && (
          <p role="alert" className="m-0 rounded-chip bg-red/8 px-3 py-2 text-13 text-red">
            {problem ?? run.error?.message ?? 'The import did not go through.'}
          </p>
        )}
      </div>
    </Modal>
  );
}
