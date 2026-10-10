import { EntityTile } from '@bemmoly/ui';
import type { ThemeScope } from '../../hooks/use-appearance-draft.ts';

interface LogoRowProps {
  workspaceName: string;
  /** The draft theme, so the tile shows the brand being chosen rather than the saved one. */
  scope: ThemeScope;
}

/**
 * Logo: the mock's dashed drop box with the workspace initial on a 36px brand
 * tile. Uploads need the storage service, so the box is shown disabled and
 * says so instead of accepting a file it cannot keep.
 */
export function LogoRow({ workspaceName, scope }: LogoRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium">Logo</span>
      <div
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-3 rounded-control border border-dashed border-line bg-side px-3 py-2.5"
      >
        <span {...scope} className="flex">
          <EntityTile name={workspaceName} tone="accent" size={36} decorative={false} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-tx-3">Upload SVG or PNG</span>
          <span className="text-12 text-tx-3">
            Shown in the top bar and login page. Square, 128px minimum. Logo upload arrives in a
            later release.
          </span>
        </div>
      </div>
    </div>
  );
}
