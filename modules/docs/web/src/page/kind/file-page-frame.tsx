import { pageFileOf, type PageDetail } from '@bemmoly/module-docs/shared';
import { EmptyState, FileEmbed, fileEmbedKind } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { KindFrame } from './kind-frame.tsx';

/**
 * A page that is one HTML or PDF file (ADR 0049): under the header the file fills the rest of
 * the screen, edge to edge, its bar kept above it so a form inside never passes for the app.
 * HTML runs in its sandbox (ADR 0047). A body that no longer holds one file says so.
 */
export function FilePageFrame({ page }: { page: PageDetail }) {
  const file = pageFileOf(page.snapshot);
  const kind = file ? fileEmbedKind(file.mime) : null;
  return (
    <KindFrame page={page}>
      {file && (kind === 'html' || kind === 'pdf') ? (
        <FileEmbed
          fill
          src={file.src}
          name={file.name || (kind === 'pdf' ? 'PDF file' : 'HTML file')}
          kind={kind}
        />
      ) : (
        <EmptyState
          className="flex-1 justify-center"
          icon={<Icon name="file-page" />}
          title="This page has no file to show"
          description="Upload one with Replace file in ···, or turn it into a page to write in it."
        />
      )}
    </KindFrame>
  );
}
