import { Badge } from '@bemmoly/ui';
import type { WorkflowProblem } from '../../../shared/index.ts';
import type { WorkflowEditorModel } from '../hooks/workflow-editor.ts';
import type { DraftChange } from './draft-changes.ts';
import { PanelBody, PanelFrame, PanelHeader, PanelNote, PanelSection } from './panel-parts.tsx';

export interface SummaryPanelProps {
  name: string;
  version: number;
  problems: readonly WorkflowProblem[] | null;
  changes: readonly DraftChange[];
  select: WorkflowEditorModel['actions']['select'];
}

/**
 * The panel while nothing is selected: what Validate found, each problem a
 * link to the status or transition it names, and what publishing would change.
 */
export function SummaryPanel({ name, version, problems, changes, select }: SummaryPanelProps) {
  return (
    <PanelFrame label="Workflow">
      <PanelHeader
        title={name}
        chip={<Badge tone="neutral">{version > 0 ? `VERSION ${version}` : 'UNPUBLISHED'}</Badge>}
      />
      <PanelBody>
        <PanelSection title="Problems">
          {problems === null && (
            <PanelNote>Validate checks the draft before you publish it.</PanelNote>
          )}
          {problems?.length === 0 && <PanelNote>Validate found no problems.</PanelNote>}
          {problems && problems.length > 0 && (
            <ul aria-label="Problems" className="m-0 flex list-none flex-col gap-1.5 p-0">
              {problems.map((problem, index) => {
                const target = problem.statusId
                  ? ({ kind: 'status', id: problem.statusId } as const)
                  : problem.transitionId
                    ? ({ kind: 'transition', id: problem.transitionId } as const)
                    : null;
                return (
                  <li key={`${problem.code}-${index}`}>
                    <button
                      type="button"
                      disabled={!target}
                      onClick={() => target && select(target)}
                      className="w-full cursor-pointer rounded-control border border-danger bg-sf px-2.5 py-2 text-left font-sans text-12h leading-note text-danger enabled:hover:bg-bg2 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac"
                    >
                      {problem.message}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelSection>
        <PanelSection title="Unpublished changes">
          {changes.length === 0 ? (
            <PanelNote>The draft matches version {version}.</PanelNote>
          ) : (
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4.5 leading-note text-tx2">
              {changes.map((change) => (
                <li key={change.key}>{change.text}</li>
              ))}
            </ul>
          )}
        </PanelSection>
        <PanelNote>
          Select a status or a transition to edit it. Drag a status to move it; drag from the handle
          on a selected status to another status to add a transition.
        </PanelNote>
      </PanelBody>
    </PanelFrame>
  );
}
