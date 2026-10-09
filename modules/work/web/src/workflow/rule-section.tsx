import { Select } from '@bemmoly/ui';
import { useState } from 'react';
import type { WorkflowRuleDefinition, WorkflowRuleKind } from '../../../shared/index.ts';
import type { WorkflowEditorModel } from '../hooks/workflow-editor.ts';
import type { DraftTransition } from './draft-model.ts';
import { SLOT_OF_KIND } from './draft-transitions.ts';
import { AddLink, PanelNote, PanelSection } from './panel-parts.tsx';
import { RuleEditor } from './rule-editor.tsx';
import { defaultArgs } from './rule-params.ts';

const COPY: Record<WorkflowRuleKind, { title: string; add: string; empty: string }> = {
  condition: {
    title: 'Conditions',
    add: '+ Add condition',
    empty: 'Anyone who can move the issue sees this transition.',
  },
  validator: {
    title: 'Validators',
    add: '+ Add validator',
    empty: 'The move needs nothing filled in.',
  },
  post_action: {
    title: 'Post-actions',
    add: '+ Add post-action',
    empty: 'Nothing else happens after the move.',
  },
};

export interface RuleSectionProps {
  kind: WorkflowRuleKind;
  transition: DraftTransition;
  registry: readonly WorkflowRuleDefinition[];
  actions: WorkflowEditorModel['actions'];
}

/** One rule list of a transition, with its rules' forms and the picker that adds one. */
export function RuleSection({ kind, transition, registry, actions }: RuleSectionProps) {
  const slot = SLOT_OF_KIND[kind];
  const rules = transition.rules[slot];
  const offered = registry.filter((rule) => rule.kind === kind);
  const [picking, setPicking] = useState(false);
  const copy = COPY[kind];
  return (
    <PanelSection title={copy.title}>
      {rules.length === 0 && <PanelNote>{copy.empty}</PanelNote>}
      {rules.map((rule, index) => (
        <RuleEditor
          key={`${rule.name}-${index}`}
          rule={rule}
          kind={kind}
          definition={registry.find((entry) => entry.name === rule.name)}
          onChange={(args) => actions.updateRule(transition.id, slot, index, args)}
          onRemove={() => actions.removeRule(transition.id, slot, index)}
        />
      ))}
      {picking ? (
        <Select
          aria-label={copy.add.slice(2)}
          placeholder={`Choose a ${copy.title.toLowerCase().replace(/s$/, '')}`}
          options={offered.map((rule) => ({
            value: rule.name,
            label: rule.label,
            description: rule.description,
            disabled: !rule.available,
          }))}
          onChange={(event) => {
            const definition = offered.find((rule) => rule.name === event.value);
            if (definition)
              actions.addRule(transition.id, slot, {
                name: definition.name,
                args: defaultArgs(definition),
              });
            setPicking(false);
          }}
        />
      ) : (
        <AddLink onClick={() => setPicking(true)} disabled={offered.length === 0}>
          {copy.add}
        </AddLink>
      )}
    </PanelSection>
  );
}
