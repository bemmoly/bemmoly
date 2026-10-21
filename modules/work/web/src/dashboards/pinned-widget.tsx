import { ReportCard, ReportNote } from '../reports/report-card.tsx';
import { pinnedRenderer, type WidgetProps } from './registry.ts';

/**
 * A report saved elsewhere and pinned here. Its spec's kind picks a renderer that whoever
 * produces the spec registers; a kind with none yet says so instead of failing the grid.
 */
export function PinnedWidget({ projectKey, widget, actions }: WidgetProps<'pinned'>) {
  const { spec } = widget.config;
  const Renderer = pinnedRenderer(spec.kind);
  return (
    <ReportCard title={spec.title} hint={spec.description} actions={actions}>
      {Renderer ? (
        <Renderer projectKey={projectKey} spec={spec} />
      ) : (
        <ReportNote>This report cannot be drawn here yet. Remove it, or pin it again.</ReportNote>
      )}
    </ReportCard>
  );
}
