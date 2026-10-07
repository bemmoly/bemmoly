import { SegmentedControl } from '@bemmoly/ui';
import { PREVIEW_VIEWS, type PreviewView } from '../../hooks/use-appearance.ts';
import type { ThemeScope } from '../../hooks/use-appearance-draft.ts';
import { PreviewBoard } from './preview/preview-board.tsx';
import { PreviewDoc } from './preview/preview-doc.tsx';
import { PreviewLogin } from './preview/preview-login.tsx';

interface LivePreviewProps {
  label: string;
  view: PreviewView;
  onView: (view: PreviewView) => void;
  scope: ThemeScope;
  workspaceName: string;
}

/**
 * The live preview: a 1440x900 screen built from the real components, themed
 * with the draft and scaled to 0.425 so it fits the 612px column. The screen
 * is inert: it is a picture of the app, not a second copy to click through.
 */
export function LivePreview({ label, view, onView, scope, workspaceName }: LivePreviewProps) {
  return (
    <div className="sticky top-0 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 font-semibold">
        Live preview
        <span className="text-12 font-normal text-tx5">{label}</span>
        <SegmentedControl
          aria-label="Preview screen"
          size="sm"
          className="ml-auto"
          options={PREVIEW_VIEWS}
          value={view}
          onChange={onView}
        />
      </div>
      <div
        role="img"
        aria-label={`Preview of the ${view} screen: ${label}`}
        className="relative aspect-[8/5] w-full overflow-hidden rounded-card border border-br bg-sf shadow-card"
      >
        <div
          {...scope}
          inert
          aria-hidden="true"
          data-testid="appearance-preview"
          className="absolute top-0 left-0 h-225 w-360 origin-top-left scale-[0.425] bg-bg font-sans text-13 text-tx"
        >
          {view === 'board' ? <PreviewBoard /> : null}
          {view === 'doc' ? <PreviewDoc /> : null}
          {view === 'login' ? <PreviewLogin workspaceName={workspaceName} /> : null}
        </div>
      </div>
    </div>
  );
}
