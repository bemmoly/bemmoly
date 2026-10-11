import type { PageDetail } from '@bemmoly/module-docs/shared';
import { MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useExportDialog } from './export-dialog.tsx';
import { useServerPdf } from './use-pdf-export.ts';

/**
 * The More menu's Export…, which opens the format choice, and Export as PDF, which opens it on
 * PDF. Export as PDF shows only when the install runs the PDF renderer: without it, PDF is the
 * browser's print view inside Export…, and the menu promises no file it cannot make.
 */
export function ExportMenuItems({ page }: { page: PageDetail }) {
  const show = useExportDialog((state) => state.show);
  const serverPdf = useServerPdf();
  if (page.deletedAt) return null;
  return (
    <>
      <MenuItem icon={<Icon name="download" size={14} />} onSelect={() => show()}>
        Export…
      </MenuItem>
      {serverPdf && (
        <MenuItem icon={<Icon name="print" size={14} />} onSelect={() => show('pdf')}>
          Export as PDF
        </MenuItem>
      )}
    </>
  );
}
