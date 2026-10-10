import { ConfirmChange, EmptyState, useToast } from '@bemmoly/ui';
import { useEffect, useMemo, useState } from 'react';
import type { Project } from '../../../shared/index.ts';
import { useWorkflowEditor } from '../hooks/workflow-editor.ts';
import { useDraftLeaveGuard } from '../hooks/workflow-leave.ts';
import { usePublishWorkflow } from '../hooks/workflow-publish.ts';
import { useWorkflowUsage } from '../hooks/workflow-usage.ts';
import { WorkflowEditorSkeleton } from '../skeletons/settings-skeleton.tsx';
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
export function WorkflowEditor({ workflowId, listPath }: WorkflowEditorProps) {
  const toast = useToast();
  const model = useWorkflowEditor(workflowId, (item) =>
    toast.undo({
      title: `${item.kind === 'status' ? 'Status' : 'Transition'} "${item.name}" deleted`,
      body:
        item.takes > 0
          ? `Its ${item.takes} transition${item.takes === 1 ? '' : 's'} went too. Nothing is live until you publish.`
          : 'Nothing is live until you publish.',
      onUndo: () => model.actions.undo(),
    }),
  );
  const { workflow, draftState, validation, selection, actions, rules } = model;
  const { draft } = draftState;
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
  const leaving = useDraftLeaveGuard(draftState);
  useUndoKey(actions.undo);

  if (model.workflowError || draftState.loadError)
    return (
      <EmptyState
        title="This workflow did not open"
        description="It may have been removed, or you may need Configure project to edit it."
      />
    );
  if (!workflow || !draft) return <WorkflowEditorSkeleton />;

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
        listPath={listPath}
        changeCount={changes.length}
        saveState={draftState.saveState}
        isValidating={validation.isValidating}
        canUndo={model.canUndo}
        onUndo={actions.undo}
        onValidate={validate}
        onAddStatus={actions.addStatus}
        onPublish={() => setPublishing(true)}
      />
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto px-6 pb-6 max-md:px-4">
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
        open={leaving.asking}
        title="Leave without saving the last change?"
        consequences={[
          'The draft did not save, so your last change is lost if you leave.',
          'Stay and the editor tries again; the draft saves itself once it can.',
        ]}
        confirmLabel="Leave without saving"
        onConfirm={leaving.leave}
        onCancel={leaving.stay}
      />
    </div>
  );
}

/** ⌘Z or Ctrl+Z walks the draft back, unless the key belongs to a field being typed in. */
function useUndoKey(undo: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || event.shiftKey || !(event.metaKey || event.ctrlKey))
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);
}
