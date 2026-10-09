import { Badge, Field, Input, RuleRow, Select, StatusDot, TransitionRow } from '@bemmoly/ui';
import { useState } from 'react';
import type { WorkflowProblem, WorkflowRuleDefinition } from '../../../shared/index.ts';
import type { WorkflowEditorModel } from '../hooks/workflow-editor.ts';
import type { DraftStatus, EditorDraft } from './draft-model.ts';
import type { SLOT_OF_KIND } from './draft-transitions.ts';
import { RULE_SLOTS, transitionsFrom, transitionsInto } from './draft-transitions.ts';
import {
  AddLink,
  PanelBody,
  PanelFrame,
  PanelHeader,
  PanelNote,
  PanelProblems,
  PanelSection,
} from './panel-parts.tsx';
import { chipKind, ruleSentence } from './rule-params.ts';
import { CATEGORY_OPTIONS, STATUS_COLORS, canvasCategory, colorClassOf } from './status-colors.ts';

const KIND_OF_SLOT = {
  conditions: 'condition',
  validators: 'validator',
  postActions: 'post_action',
} as const satisfies Record<(typeof RULE_SLOTS)[number], keyof typeof SLOT_OF_KIND>;

const CATEGORY_DEFAULT = 'category';

export interface StatusPanelProps {
  draft: EditorDraft;
  status: DraftStatus;
  registry: readonly WorkflowRuleDefinition[];
  problems: readonly WorkflowProblem[];
  actions: WorkflowEditorModel['actions'];
}

/**
 * A selected status, as the mock's panel: the transitions out of it, the
 * rules that run when an issue enters it (those of the transitions into it),
 * and its name, category and colour.
 */
export function StatusPanel({ draft, status, registry, problems, actions }: StatusPanelProps) {
  const [adding, setAdding] = useState(false);
  const name = (id: string) => draft.statuses.find((candidate) => candidate.id === id)?.name ?? '?';
  const outs = transitionsFrom(draft, status.id);
  const into = transitionsInto(draft, status.id);
  const entering = into.flatMap((transition) =>
    RULE_SLOTS.flatMap((slot) =>
      transition.rules[slot].map((rule, index) => ({ transition, slot, rule, index })),
    ),
  );
  const category = CATEGORY_OPTIONS.find((option) => option.value === status.category);
  const targets = draft.statuses.filter((candidate) => candidate.id !== status.id);
  return (
    <PanelFrame label="Status">
      <PanelHeader
        mark={
          <StatusDot
            category={canvasCategory(status.category)}
            colorClassName={colorClassOf(status.color)}
            size={10}
          />
        }
        title={status.name}
        chip={<Badge>{category?.label.toUpperCase()}</Badge>}
      />
      <PanelBody>
        <PanelProblems problems={problems} />
        <PanelSection title="Transitions out">
          {outs.map((transition) => (
            <TransitionRow
              key={transition.id}
              onMore={() => actions.select({ kind: 'transition', id: transition.id })}
              moreLabel={`Edit ${transition.name}`}
            >
              {name(transition.toStatusId)} ({transition.name})
            </TransitionRow>
          ))}
          {adding ? (
            <Select
              aria-label="Add transition to"
              placeholder="Choose where it goes"
              options={targets.map((target) => ({ value: target.id, label: target.name }))}
              onChange={(event) => {
                setAdding(false);
                actions.connect(status.id, event.value);
              }}
            />
          ) : (
            <AddLink onClick={() => setAdding(true)} disabled={targets.length === 0}>
              + Add transition
            </AddLink>
          )}
        </PanelSection>
        <PanelSection title="Rules when entering">
          {entering.length === 0 && (
            <PanelNote>No transition into {status.name} carries rules.</PanelNote>
          )}
          {entering.map(({ transition, slot, rule, index }) => (
            <RuleRow key={`${transition.id}-${slot}-${index}`} kind={chipKind(KIND_OF_SLOT[slot])}>
              {ruleSentence(
                registry.find((entry) => entry.name === rule.name),
                rule.name,
                rule.args,
              )}
            </RuleRow>
          ))}
          <AddLink
            disabled={into.length === 0}
            onClick={() => {
              const first = into[0];
              if (first) actions.select({ kind: 'transition', id: first.id });
            }}
          >
            + Add condition, validator or post-action
          </AddLink>
          {into.length === 0 && <PanelNote>Add a transition into this status first.</PanelNote>}
        </PanelSection>
        <PanelSection title="Status">
          <Field
            label="Name"
            error={status.name.trim() ? undefined : 'Name the status so the draft can save.'}
          >
            <Input
              value={status.name}
              maxLength={60}
              onChange={(event) => actions.updateStatus(status.id, { name: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category">
              <Select
                value={status.category}
                options={CATEGORY_OPTIONS}
                onChange={(event) =>
                  actions.updateStatus(status.id, {
                    category: event.value as DraftStatus['category'],
                  })
                }
              />
            </Field>
            <Field label="Colour">
              <Select
                value={status.color ?? CATEGORY_DEFAULT}
                options={[
                  { value: CATEGORY_DEFAULT, label: 'Category colour' },
                  ...STATUS_COLORS.map((swatch) => ({
                    value: swatch.value,
                    label: swatch.label,
                    icon: <StatusDot category="todo" colorClassName={swatch.className} size={8} />,
                  })),
                ]}
                onChange={(event) =>
                  actions.updateStatus(status.id, {
                    color: event.value === CATEGORY_DEFAULT ? undefined : event.value,
                  })
                }
              />
            </Field>
          </div>
        </PanelSection>
        <AddLink
          tone="danger"
          onClick={() => actions.requestDelete({ kind: 'status', id: status.id })}
        >
          Delete status
        </AddLink>
      </PanelBody>
    </PanelFrame>
  );
}
