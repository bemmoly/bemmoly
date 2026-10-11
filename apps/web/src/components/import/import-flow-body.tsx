import type { ImportFlow } from '../../hooks/use-import-flow.ts';
import { FormError, Loading } from '../form.tsx';
import { SettingsFailure } from '../settings/settings-states.tsx';
import { ConnectForm } from './connect-form.tsx';
import { DiscoveryPanel } from './discovery-panel.tsx';
import { ImportReport } from './import-report.tsx';
import { PlanPanel } from './plan-panel.tsx';
import { RunProgress } from './run-progress.tsx';

/**
 * Everything after a source is picked, by step: its connection form, what it found and the
 * plan, the live run, then the report. Settings › Import and the wizard's step share it.
 */
export function ImportFlowBody({ flow }: { flow: ImportFlow }) {
  const { job, source, actions } = flow;
  if (flow.jobError) return <SettingsFailure error={flow.jobError} />;
  if (flow.jobLoading) return <Loading label="Loading the import" />;
  if (flow.step === 'connect' && source) {
    return (
      <ConnectForm
        source={source}
        fields={flow.fields}
        values={flow.values}
        files={flow.files}
        fileError={flow.fileError}
        error={actions.create.error}
        busy={actions.create.isPending}
        canConnect={flow.canConnect}
        onChange={flow.setValue}
        onFile={(field, file) => void flow.chooseFile(field, file)}
        onConnect={flow.connect}
        onBack={flow.startOver}
      />
    );
  }
  if (!job) return null;
  if (flow.step === 'running') {
    return <RunProgress job={job} cancelling={actions.cancel.isPending} onCancel={flow.cancel} />;
  }
  if (flow.step === 'report') {
    return (
      <ImportReport
        job={job}
        rerunning={actions.run.isPending}
        error={actions.run.error}
        onRerun={flow.start}
        onStartOver={flow.startOver}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {job.discovery ? (
        <DiscoveryPanel
          discovery={job.discovery}
          chosen={flow.chosen}
          planCurrent={flow.planCurrent}
          busy={actions.plan.isPending}
          onToggle={flow.toggle}
          onPreview={flow.previewPlan}
        />
      ) : null}
      {job.plan ? (
        <PlanPanel
          plan={job.plan}
          current={flow.planCurrent}
          starting={actions.run.isPending}
          error={actions.run.error ?? actions.plan.error}
          onStart={flow.start}
        />
      ) : (
        <FormError error={actions.plan.error} />
      )}
    </div>
  );
}
