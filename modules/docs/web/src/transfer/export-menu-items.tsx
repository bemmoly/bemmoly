import type { PageDetail } from '@bemmoly/module-docs/shared';
import { MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useExportDialog } from './export-dialog.tsx';

/** The More menu's Export…, which opens the format choice: Markdown, HTML or PDF. */
export function ExportMenuItems({ page }: { page: PageDetail }) {
  const show = useExportDialog((state) => state.show);
  if (page.deletedAt) return null;
  return (
    <MenuItem icon={<Icon name="download" size={14} />} onSelect={show}>
      Export…
    </MenuItem>
  );
}
