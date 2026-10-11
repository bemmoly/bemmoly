import type { ImportedPage } from '@bemmoly/module-docs/shared';
import { Button, Modal, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { DropZone } from './drop-zone.tsx';
import { ImportResults, ParentPicker, SourceTiles } from './import-parts.tsx';
import { pickFiles, pickProblem, type ImportFormat, type PickedFile } from './read-files.ts';
import { useImport } from './use-import.ts';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** The space the pages land in, by key. */
  space: { key: string; name: string };
  /** Under this page to start with; at the top of the space when absent. Changeable. */
  parent?: { id: string; title: string } | null;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Import pages into a space: Markdown files (front matter "title" names a page, folders
 * become parent pages) or the HTML pages of a Confluence space export, whose unknown macros
 * become labelled placeholders. The person picks where they land. A small import lands at
 * once and lists what each file became; a big one runs in the background, and a toast says
 * so while the tree fills in.
 */
export function ImportDialog(props: ImportDialogProps) {
  return props.open ? <ImportForm {...props} /> : null;
}

function ImportForm({ open, onClose, space, parent: startParent = null }: ImportDialogProps) {
  const [format, setFormat] = useState<ImportFormat>('markdown');
  const [parent, setParent] = useState(startParent);
  const [picked, setPicked] = useState<File[]>([]);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [landed, setLanded] = useState<readonly ImportedPage[] | null>(null);
  const run = useImport(space.key);
  const toast = useToast();
  const problem = pickProblem(files);
  const skipped = picked.length - files.length;

  const pick = (next: File[]) => {
    const all = [...picked, ...next];
    setPicked(all);
    setFiles(pickFiles(format, all));
  };

  const openFirst = (pages: readonly ImportedPage[]) => {
    const first = pages.find((page) => page.parentId === (parent?.id ?? null)) ?? pages[0];
    onClose();
    if (first) navigateTo(docsPaths.page(first.id));
  };

  const submit = () =>
    run.mutate(
      { format, files, parentId: parent?.id },
      {
        onSuccess: (result) => {
          if (result.status === 'queued') {
            onClose();
            toast.show({
              tone: 'info',
              title: `Importing ${plural(files.length, 'file', 'files')} into ${space.name}`,
              body: 'It keeps going in the background; the pages appear in the tree as they land.',
              duration: 10_000,
            });
            return;
          }
          setLanded(result.pages);
          toast.show({
            tone: 'ok',
            title: `Imported ${plural(result.pages.length, 'page', 'pages')}`,
            action: { label: 'Open', onClick: () => openFirst(result.pages) },
          });
        },
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={`Import into ${space.name}`}
      footer={
        landed ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" onClick={() => openFirst(landed)}>
              Open pages
            </Button>
          </>
        ) : (
          <>
            {!run.isPending && files.length === 0 && (
              <span className="mr-auto text-12 text-tx-3">
                A big import keeps going after you close this.
              </span>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={run.isPending}
              disabled={files.length === 0 || Boolean(problem)}
              onClick={submit}
            >
              {files.length > 0 ? `Import ${plural(files.length, 'file', 'files')}` : 'Import'}
            </Button>
          </>
        )
      }
    >
      {landed ? (
        <ImportResults pages={landed} />
      ) : (
        <div className="flex flex-col gap-3.5">
          <ParentPicker
            spaceKey={space.key}
            spaceName={space.name}
            value={parent}
            onChange={setParent}
          />
          <SourceTiles
            value={format}
            onChange={(next) => {
              setFormat(next);
              setFiles(pickFiles(next, picked));
            }}
          />
          <DropZone
            format={format}
            files={files}
            onPick={pick}
            onRemove={(path) => {
              const keep = files.filter((file) => file.path !== path);
              setFiles(keep);
              setPicked(keep.map((file) => file.file));
            }}
          />
          {skipped > 0 && (
            <p className="m-0 text-12 text-tx-3">
              {plural(skipped, 'file is', 'files are')} not{' '}
              {format === 'markdown' ? 'Markdown' : 'HTML'} and {skipped === 1 ? 'stays' : 'stay'}{' '}
              out.
            </p>
          )}
          {(problem || run.isError) && (
            <p role="alert" className="m-0 rounded-chip bg-red/8 px-3 py-2 text-13 text-red">
              {problem ?? run.error?.message ?? 'The import did not go through.'} Your files are
              still picked; try again.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
