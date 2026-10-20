import { ControlChartCard, TimeInStatusCard } from '../reports/cycle-reports.tsx';
import { CreatedResolvedCard, CumulativeFlowCard } from '../reports/flow-reports.tsx';
import { ReportCard, ReportNote, ReportPending } from '../reports/report-card.tsx';
import { ScopeBurnupCard } from '../reports/scope-report.tsx';
import { BurndownCard, BurnupCard, VelocityCard } from '../reports/sprint-reports.tsx';
import { QuarterBurnupCard } from '../quarter/quarter-parts.tsx';
import { useQuarterReport } from '../quarter/model.ts';
import { PinnedWidget } from './pinned-widget.tsx';
import { registerWidget, widgetLabel, type WidgetProps } from './registry.ts';
import {
  useWidgetControl,
  useWidgetFlow,
  useWidgetScope,
  useWidgetSprintReport,
  useWidgetTimeInStatus,
} from './widget-data.ts';

/*
 * The built-in widgets: each reads its own report and draws the Reports screen's card for it,
 * with the tile's controls in the card header. Registered once, on import.
 */

type SprintType = 'burndown' | 'burnup' | 'velocity';
const SPRINT_CARDS = { burndown: BurndownCard, burnup: BurnupCard, velocity: VelocityCard };

function SprintWidget({ projectKey, widget, actions }: WidgetProps<SprintType>) {
  const sprintId = widget.type === 'velocity' ? undefined : widget.config.sprintId;
  const { report, error, none } = useWidgetSprintReport(projectKey, sprintId);
  const Card = SPRINT_CARDS[widget.type];
  if (report) return <Card report={report} actions={actions} />;
  return (
    <ReportCard title={widgetLabel(widget.type)} actions={actions}>
      {none ? (
        <ReportNote>No sprint has started yet. This report starts with the first one.</ReportNote>
      ) : (
        <ReportPending error={error} />
      )}
    </ReportCard>
  );
}

type FlowType = 'cumulative-flow' | 'created-resolved';
const FLOW_CARDS = {
  'cumulative-flow': CumulativeFlowCard,
  'created-resolved': CreatedResolvedCard,
};

function FlowWidget({ projectKey, widget, actions }: WidgetProps<FlowType>) {
  const flow = useWidgetFlow(projectKey, widget.config.days);
  const Card = FLOW_CARDS[widget.type];
  if (flow.data) return <Card report={flow.data} actions={actions} />;
  return (
    <ReportCard title={widgetLabel(widget.type)} actions={actions}>
      <ReportPending error={flow.error} />
    </ReportCard>
  );
}

function ControlWidget({ projectKey, widget, actions }: WidgetProps<'control-chart'>) {
  const control = useWidgetControl(projectKey, widget.config.days);
  return <ControlChartCard chart={control.data} error={control.error} actions={actions} />;
}

function TimeInStatusWidget({ projectKey, widget, actions }: WidgetProps<'time-in-status'>) {
  const report = useWidgetTimeInStatus(projectKey, widget.config.days);
  return <TimeInStatusCard report={report.data} error={report.error} actions={actions} />;
}

function ScopeWidget({ projectKey, widget, actions }: WidgetProps<'scope-burnup'>) {
  const report = useWidgetScope(projectKey, widget.config.kind, widget.config.id);
  return (
    <ScopeBurnupCard
      kind={widget.config.kind}
      data={report.data}
      error={report.error}
      actions={actions}
    />
  );
}

function QuarterWidget({ projectKey, widget, actions }: WidgetProps<'quarter'>) {
  const report = useQuarterReport(projectKey, widget.config.quarter);
  return <QuarterBurnupCard report={report.data} error={report.error} actions={actions} />;
}

const SPRINT_HINT = 'The active sprint, else the latest one';
registerWidget({
  type: 'burndown',
  description: `Points remaining per day. ${SPRINT_HINT}.`,
  Component: SprintWidget,
  addable: true,
});
registerWidget({
  type: 'burnup',
  description: `Scope and completed points per day. ${SPRINT_HINT}.`,
  Component: SprintWidget,
  addable: true,
});
registerWidget({
  type: 'velocity',
  description: 'Committed and completed points of the last closed sprints.',
  Component: SprintWidget,
  addable: true,
});
registerWidget({
  type: 'cumulative-flow',
  description: 'Issues in each status category per day, last 30 days.',
  Component: FlowWidget,
  addable: true,
});
registerWidget({
  type: 'created-resolved',
  description: 'Running totals of issues created and resolved, last 30 days.',
  Component: FlowWidget,
  addable: true,
});
registerWidget({
  type: 'control-chart',
  description: 'Cycle time of each issue finished, last 90 days.',
  Component: ControlWidget,
  addable: true,
});
registerWidget({
  type: 'time-in-status',
  description: 'Average days an issue stands in each status, last 90 days.',
  Component: TimeInStatusWidget,
  addable: true,
});
registerWidget({
  type: 'scope-burnup',
  description: 'The first open epic’s scope and completed points by week.',
  Component: ScopeWidget,
  addable: true,
});
registerWidget({
  type: 'quarter',
  description: 'This quarter’s scope and finished work by week.',
  Component: QuarterWidget,
  addable: true,
});
registerWidget({
  type: 'pinned',
  description: 'A report saved from the assistant.',
  Component: PinnedWidget,
  addable: false,
});
