import { SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ThemeMode, ThemeSource } from '@bemmoly/ui/tokens';
import { PREVIEW_VIEWS, type PreviewView } from '../../hooks/use-appearance.ts';
import { themeScope } from '../../lib/theme-scope.ts';
import { PreviewBoard } from './preview/preview-board.tsx';
import { PreviewDoc } from './preview/preview-doc.tsx';
import { PreviewLogin } from './preview/preview-login.tsx';

interface LivePreviewProps {
  source: ThemeSource;
  view: PreviewView;
  onView: (view: PreviewView) => void;
  workspaceName: string;
  aiEnabled: boolean;
}

interface ScreenProps extends Omit<LivePreviewProps, 'onView'> {
  mode: ThemeMode;
}

/**
 * One 1440x900 screen built from the real components, painted with the theme in one mode and
 * scaled to a quarter so it fits the aside. It is inert: a picture of the app. Like the app,
 * it draws its AI cards only while AI is on.
 */
function Screen({ source, mode, view, workspaceName, aiEnabled }: ScreenProps) {
  const label = `${source.name}, ${mode === 'dark' ? 'Dark' : 'Light'}`;
  return (
    <div
      role="img"
      aria-label={`Preview of the ${view} screen: ${label}`}
      className="relative aspect-[8/5] w-full overflow-hidden rounded-card bg-card shadow-e1"
    >
      <div
        {...themeScope(source, mode)}
        inert
        aria-hidden="true"
        data-testid={`appearance-preview-${mode}`}
        className="absolute top-0 left-0 h-225 w-360 origin-top-left scale-[0.25] bg-sunken font-sans text-13 text-tx"
      >
        {view === 'board' ? <PreviewBoard aiEnabled={aiEnabled} /> : null}
        {view === 'doc' ? <PreviewDoc aiEnabled={aiEnabled} /> : null}
        {view === 'login' ? <PreviewLogin workspaceName={workspaceName} /> : null}
      </div>
    </div>
  );
}

/** The preview aside: the chosen theme in both modes, because every theme is a pair. */
export function LivePreview({ onView, ...props }: LivePreviewProps) {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-0">
      <div className="flex items-center gap-2 font-semibold">
        Preview
        <span className="text-12 font-normal text-tx-3">{props.source.name}, both modes</span>
        <SegmentedControl
          aria-label="Preview screen"
          size="sm"
          className="ml-auto"
          options={PREVIEW_VIEWS}
          value={props.view}
          onChange={onView}
        />
      </div>
      <Screen {...props} mode="light" />
      <Screen {...props} mode="dark" />
      <p className="m-0 flex gap-1.5 text-12 text-tx-3">
        <Icon name="lock" size={14} className="shrink-0" />
        The logo, AI lilac, issue types and status colours are the same in every theme.
      </p>
    </aside>
  );
}
