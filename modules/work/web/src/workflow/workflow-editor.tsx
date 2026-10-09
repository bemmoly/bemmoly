import { ConfirmChange, EmptyState, Skeleton, useToast } from '@bemmoly/ui';
import { useMemo, useState } from 'react';
import type { Project } from '../../../shared/index.ts';
import { useWorkflowEditor } from '../hooks/workflow-editor.ts';
import { usePublishWorkflow } from '../hooks/workflow-publish.ts';
import { useWorkflowUsage } from '../hooks/workflow-usage.ts';
import { draftChanges } from './draft-changes.ts';
import { statusById, transitionById } from './draft-model.ts';
import { EditorCanvas } from './editor-canvas.tsx';
import { EditorHeader } from './editor-header.tsx';
import { PublishDialog } from './publish-dialog.tsx';
import { StatusPanel } from './status-panel.tsx';
import { SummaryPanel } from './summary-panel.tsx';
import { TransitionPanel } from './transition-panel.tsx';

export interface WorkflowEditorProps {
  project: Project;
  workflowId: string;
  listPath: string;
}

/** The visual workflow editor: header, canvas and the panel for whatever is selected. */
export function WorkflowEditor({ project, workflowId, listPath }: WorkflowEditorProps) {
  const model = useWorkflowEditor(workflowId);
  const { workflow, draftState, validation, selection, actions, rules } = model;
  const { draft } = draftState;
  const toast = useToast();
  const usage = useWorkflowUsage();
  const [publishing, setPublishing] = useState(false);
  const publisher = usePublishWorkflow(workflowId, draftState.flush, async (published) => {
    await draftState.reset();
    validation.clear();
    actions.select(null);
    toast.show({
      tone: 'ok',
      title: `${published.name} version ${published.publishedVersion} is live`,
      body: 'Issues follow the new transitions and rules from their next move.',
    });
  });
  const changes = useMemo(
    () => (workflow && draft ? draftChanges(workflow, draft) : []),
    [workflow, draft],
  );

  if (model.workflowError || draftState.loadError)
    return (
      <EmptyState
        title="This workflow did not open"
        description="It may have been removed, or you may need Configure project to edit it."
      />
    );
  if (!workflow || !draft) return <Skeleton className="m-6 h-140" />;

  const problems = validation.problems ?? [];
  const status = selection?.kind === 'status' ? statusById(draft, selection.id) : undefined;
  const transition =
    selection?.kind === 'transition' ? transitionById(draft, selection.id) : undefined;

  const validate = () => {
    void validation
      .run()
      .then((found) => {
        actions.select(null);
        if (found.length === 0) toast.show({ tone: 'ok', title: 'Validate found no problems' });
      })
      .catch(() =>
        toast.show({ tone: 'danger', title: 'Validate did not run', body: 'Try again.' }),
      );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EditorHeader
        workflow={workflow}
        projectName={project.name}
        listPath={listPath}
        changeCount={changes.length}
        saveState={draftState.saveState}
        isValidating={validation.isValidating}
        onValidate={validate}
        onAddStatus={actions.addStatus}
        onPublish={() => setPublishing(true)}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto px-6 pb-6">
          <EditorCanvas
            label={workflow.name}
            draft={draft}
            selection={selection}
            counts={model.counts}
            invalidStatuses={validation.invalidStatuses}
            invalidTransitions={validation.invalidTransitions}
            actions={actions}
          />
        </div>
        {status ? (
          <StatusPanel
            key={status.id}
            draft={draft}
            status={status}
            registry={rules}
            problems={problems.filter((problem) => problem.statusId === status.id)}
            actions={actions}
          />
        ) : transition ? (
          <TransitionPanel
            key={transition.id}
            draft={draft}
            transition={transition}
            registry={rules}
            problems={problems.filter((problem) => problem.transitionId === transition.id)}
            actions={actions}
          />
        ) : (
          <SummaryPanel
            name={workflow.name}
            version={workflow.publishedVersion}
            problems={validation.problems}
            changes={changes}
            select={actions.select}
          />
        )}
      </div>
      <PublishDialog
        open={publishing}
        name={workflow.name}
        version={workflow.publishedVersion}
        changeCount={changes.length}
        projects={usage.usage(workflow)}
        draft={draft}
        publisher={publisher}
        onClose={() => setPublishing(false)}
      />
      <ConfirmChange
        open={model.deleteTarget !== null}
        title={`Delete ${model.deleteTarget?.kind === 'status' ? 'status' : 'transition'} "${model.deleteTarget?.name ?? ''}"?`}
        consequences={deleteConsequences(model.deleteTarget)}
        confirmLabel={model.deleteTarget?.kind === 'status' ? 'Delete status' : 'Delete transition'}
        onConfirm={actions.confirmDelete}
        onCancel={actions.cancelDelete}
      />
    </div>
  );
}

function deleteConsequences(target: ReturnType<typeof useWorkflowEditor>['deleteTarget']) {
  if (!target) return [];
  const draftOnly = 'It leaves the draft now; the published version keeps it until you publish.';
  if (target.kind === 'transition') return [draftOnly];
  return [
    target.takes > 0
      ? `The ${target.takes} transition${target.takes === 1 ? '' : 's'} into and out of it go too.`
      : 'No transition uses it.',
    target.issues && target.issues > 0
      ? `Publish will ask where its ${target.issues === 1 ? 'issue goes' : `${target.issues} issues go`}.`
      : 'No issue is in it.',
    draftOnly,
  ];
}
