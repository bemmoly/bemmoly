import { Badge, Field, Input, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { WorkflowProblem, WorkflowRuleDefinition } from '../../../shared/index.ts';
import type { WorkflowEditorModel } from '../hooks/workflow-editor.ts';
import type { DraftTransition, EditorDraft } from './draft-model.ts';
import {
  AddLink,
  PanelBody,
  PanelFrame,
  PanelHeader,
  PanelProblems,
  PanelSection,
} from './panel-parts.tsx';
import { RuleSection } from './rule-section.tsx';

const ANY = '__any__';

export interface TransitionPanelProps {
  draft: EditorDraft;
  transition: DraftTransition;
  registry: readonly WorkflowRuleDefinition[];
  problems: readonly WorkflowProblem[];
  actions: WorkflowEditorModel['actions'];
}

/**
 * A selected transition: its name and ends, then the conditions that decide
 * who sees it, the validators the move must pass and the post-actions that
 * run after it, each picked from the rules registry.
 */
export function TransitionPanel({
  draft,
  transition,
  registry,
  problems,
  actions,
}: TransitionPanelProps) {
  const statuses = draft.statuses.map((status) => ({ value: status.id, label: status.name }));
  const any = transition.fromStatusId === null;
  const target = { kind: 'transition', id: transition.id } as const;
  return (
    <PanelFrame label="Transition">
      <PanelHeader
        mark={<Icon name="arrow" size={14} className="shrink-0 text-tx5" />}
        title={transition.name}
        chip={<Badge>{any ? 'ANY STATUS' : 'TRANSITION'}</Badge>}
      />
      <PanelBody>
        <PanelProblems problems={problems} />
        <PanelSection title="Transition">
          <Field
            label="Name"
            error={
              transition.name.trim() ? undefined : 'Name the transition so the draft can save.'
            }
          >
            <Input
              value={transition.name}
              maxLength={60}
              onChange={(event) =>
                actions.updateTransition(transition.id, { name: event.target.value })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <Select
                value={transition.fromStatusId ?? ANY}
                options={[{ value: ANY, label: 'Any status' }, ...statuses]}
                onChange={(event) =>
                  actions.updateTransition(transition.id, {
                    fromStatusId: event.value === ANY ? null : event.value,
                  })
                }
              />
            </Field>
            <Field label="To">
              <Select
                value={transition.toStatusId}
                options={statuses}
                onChange={(event) =>
                  actions.updateTransition(transition.id, { toStatusId: event.value })
                }
              />
            </Field>
          </div>
        </PanelSection>
        <RuleSection
          kind="condition"
          transition={transition}
          registry={registry}
          actions={actions}
        />
        <RuleSection
          kind="validator"
          transition={transition}
          registry={registry}
          actions={actions}
        />
        <RuleSection
          kind="post_action"
          transition={transition}
          registry={registry}
          actions={actions}
        />
        <AddLink tone="danger" onClick={() => actions.requestDelete(target)}>
          Delete transition
        </AddLink>
      </PanelBody>
    </PanelFrame>
  );
}
