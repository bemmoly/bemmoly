import type { ImportFlow } from '../../hooks/use-import-flow.ts';
import { FormError, Loading } from '../form.tsx';
import { SettingsFailure } from '../settings/settings-states.tsx';
import { ConnectForm } from './connect-form.tsx';
import { ContainerChooser } from './container-chooser.tsx';
import { ImportReport } from './import-report.tsx';
import { PlanPanel } from './plan-panel.tsx';
import { RunProgress } from './run-progress.tsx';

/**
 * Everything after a source is picked, by step: its connection form, choosing what to bring,
 * the plan, the live run, then the report. Settings › Import and the wizard's step share it.
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
  if (flow.step === 'choose') {
    return (
      <ContainerChooser
        key={job.id}
        job={job}
        source={source}
        continuing={actions.plan.isPending}
        error={actions.plan.error}
        onContinue={flow.planChosen}
        onBack={flow.backToConnect}
      />
    );
  }
  // Options and Review take this place next; until then the plan is the step after Choose.
  return job.plan ? (
    <PlanPanel
      plan={job.plan}
      current
      starting={actions.run.isPending}
      error={actions.run.error}
      onStart={flow.start}
    />
  ) : (
    <FormError error={actions.plan.error} />
  );
}
