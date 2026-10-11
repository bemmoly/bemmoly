import { isApiError } from '@bemmoly/api-client';
import type { AutomationCatalog, AutomationRule } from '@bemmoly/module-work/shared';
import { Button, Checkbox, Field, Input, Modal } from '@bemmoly/ui';
import type { KeyboardEvent, ReactNode } from 'react';
import { useViewer } from '../../hooks/issue-people.ts';
import { ActionList } from './action-list.tsx';
import { ConditionsEditor } from './conditions-editor.tsx';
import { TriggerEditor } from './trigger-editor.tsx';
import { useRuleBuilder } from './use-rule-builder.ts';
import type { RuleOptions } from './use-rule-options.ts';

interface RuleBuilderProps {
  /** The rule being edited, or null for a new one. */
  rule: AutomationRule | null;
  projectId: string | null;
  catalog: AutomationCatalog | undefined;
  options: RuleOptions;
  /** Why this person may only read the rule; null when they may change it. */
  readOnly: string | null;
  onClose: () => void;
}

const FORM_ID = 'automation-rule-form';

function Part({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 border-b border-line-2 pb-1.5">
        <h3 className="m-0 text-14 font-semibold text-tx">{title}</h3>
        <span className="text-12 text-tx-3">{hint}</span>
      </div>
      {children}
    </section>
  );
}

/** The rule builder: a rule read as a sentence, when this happens, if these match, then do these. */
export function RuleBuilder({
  rule,
  projectId,
  catalog,
  options,
  readOnly,
  onClose,
}: RuleBuilderProps) {
  const viewer = useViewer();
  const builder = useRuleBuilder({
    rule,
    projectId,
    checkQuery: options.checkQuery,
    onSaved: onClose,
  });
  const { draft, problems } = builder;
  const runsAs = rule?.ownerName ?? viewer?.name ?? 'you';
  const failure = builder.save.error && isApiError(builder.save.error) ? builder.save.error : null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !readOnly) {
      event.preventDefault();
      builder.submit();
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      width="xl"
      title={rule ? (readOnly ? rule.name : `Edit ${rule.name}`) : 'New rule'}
      description={
        rule?.projectId === null || (!rule && projectId === null)
          ? 'A global rule: it runs in every project.'
          : 'A rule for this project.'
      }
      footer={
        readOnly ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form={FORM_ID} loading={builder.save.isPending}>
              Save rule
            </Button>
          </>
        )
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onKeyDown={onKeyDown}
        onSubmit={(event) => {
          event.preventDefault();
          builder.submit();
        }}
      >
        <fieldset
          disabled={Boolean(readOnly)}
          className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0"
        >
          {readOnly ? (
            <p className="m-0 rounded-control bg-sunken px-3 py-2 text-13 text-tx-2">{readOnly}</p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Field label="Name" error={problems['name']}>
              <Input
                autoFocus={!readOnly}
                placeholder="Send new bugs to triage"
                value={draft.name}
                onChange={(event) => builder.set({ name: event.target.value })}
              />
            </Field>
            <p className="m-0 text-12 text-tx-3">
              {rule
                ? `Runs as ${runsAs}, whose permissions its actions use. Saving makes it run as you.`
                : 'Runs as you: its actions use your permissions, whoever triggers it.'}
            </p>
          </div>
          <Part title="When" hint="What starts the rule">
            <TriggerEditor
              trigger={draft.trigger}
              catalog={catalog?.triggers ?? []}
              statuses={options.statuses}
              problems={problems}
              onPick={builder.setTrigger}
              onArgs={builder.setTriggerArgs}
            />
          </Part>
          <Part title="If" hint="Every condition must match">
            <ConditionsEditor
              conditions={draft.conditions}
              catalog={options.catalog}
              values={options.values}
              problems={problems}
              onAdd={builder.addCondition}
              onChange={builder.setCondition}
              onRemove={builder.removeCondition}
            />
          </Part>
          <Part title="Then" hint="In this order">
            <ActionList
              actions={draft.actions}
              catalog={catalog?.actions ?? []}
              options={options}
              problems={problems}
              builder={builder}
            />
          </Part>
          <Checkbox
            label="Turn on when saved"
            description="Off keeps the rule saved without running it."
            checked={draft.enabled}
            onChange={(event) => builder.set({ enabled: event.target.checked })}
          />
          {failure && Object.keys(problems).length === 0 ? (
            <p role="alert" className="m-0 text-13 text-red-tx">
              {failure.message}
              {failure.requestId ? (
                <span className="block font-mono text-11 text-tx-3">
                  Request id {failure.requestId}
                </span>
              ) : null}
            </p>
          ) : null}
        </fieldset>
      </form>
    </Modal>
  );
}
