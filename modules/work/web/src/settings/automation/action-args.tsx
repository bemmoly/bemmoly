import {
  AUTOMATION_ACTIONS,
  ISSUE_PRIORITIES,
  NOTIFY_RECIPIENTS,
} from '@bemmoly/module-work/shared';
import { Checkbox, Field, Input, PRIORITIES, Select, Tag, Textarea } from '@bemmoly/ui';
import { personOption } from '../../hooks/issue-people.ts';
import {
  ASSIGN_LABELS,
  ASSIGN_MODE_LABELS,
  RECIPIENT_LABELS,
  SETTABLE_FIELD_LABELS,
} from './describe.ts';
import type { Problems, Step } from './model.ts';
import { withCurrent, type RuleOptions } from './use-rule-options.ts';

interface ActionArgsProps {
  step: Step;
  /** Where its problems live: "actions.2". */
  at: string;
  options: RuleOptions;
  problems: Problems;
  onArgs: (args: Record<string, unknown>) => void;
}

const asOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const PRIORITY_OPTIONS = ISSUE_PRIORITIES.map((value) => ({
  value,
  label: PRIORITIES[value].name,
}));

function SetFieldValue({
  field,
  value,
  onValue,
}: {
  field: string;
  value: unknown;
  onValue: (value: unknown) => void;
}) {
  if (field === 'priority') {
    return (
      <Select
        options={PRIORITY_OPTIONS}
        value={String(value ?? 'medium')}
        onChange={(event) => onValue(event.value)}
      />
    );
  }
  if (field === 'estimate') {
    return (
      <Input
        type="number"
        min={0}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(event) => onValue(event.target.value === '' ? null : Number(event.target.value))}
      />
    );
  }
  return (
    <Input
      type={field === 'dueAt' ? 'date' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => onValue(event.target.value)}
    />
  );
}

/** One action's arguments: the right picker for each, fed by the project's own names. */
export function ActionArgs({ step, at, options, problems, onArgs }: ActionArgsProps) {
  const args = step.args;
  const problem = (key: string) => problems[`${at}.args.${key}`];
  switch (step.name) {
    case AUTOMATION_ACTIONS.setField:
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Field" error={problem('field')}>
            <Select
              options={asOptions(SETTABLE_FIELD_LABELS)}
              value={String(args['field'] ?? '')}
              onChange={(event) =>
                onArgs({ field: event.value, value: event.value === 'priority' ? 'medium' : '' })
              }
            />
          </Field>
          <Field label="Value" error={problem('value')}>
            <SetFieldValue
              field={String(args['field'] ?? '')}
              value={args['value']}
              onValue={(value) => onArgs({ value })}
            />
          </Field>
        </div>
      );
    case AUTOMATION_ACTIONS.transition:
      return (
        <Field
          label="Status"
          hint="Status names, so a global rule works in every project."
          error={problem('status')}
        >
          <Select
            options={withCurrent(options.statuses, args['status'])}
            placeholder="Pick a status"
            value={String(args['status'] ?? '')}
            onChange={(event) => onArgs({ status: event.value })}
          />
        </Field>
      );
    case AUTOMATION_ACTIONS.assign:
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assign to">
            <Select
              options={asOptions(ASSIGN_LABELS)}
              value={String(args['to'] ?? 'reporter')}
              onChange={(event) =>
                onArgs({
                  to: event.value,
                  userId: undefined,
                  ...(event.value === 'unassigned' ? { mode: 'replace' } : {}),
                })
              }
            />
          </Field>
          {args['to'] !== 'unassigned' ? (
            <Field label="Others on the issue">
              <Select
                options={asOptions(ASSIGN_MODE_LABELS)}
                value={String(args['mode'] ?? 'replace')}
                onChange={(event) => onArgs({ mode: event.value })}
              />
            </Field>
          ) : null}
          {args['to'] === 'user' ? (
            <Field label="Person" error={problem('userId')}>
              <Select
                options={options.people.people.map(personOption)}
                loadOptions={options.people.loadOptions}
                placeholder="Pick a person"
                value={String(args['userId'] ?? '')}
                onChange={(event) => onArgs({ userId: event.value })}
              />
            </Field>
          ) : null}
        </div>
      );
    case AUTOMATION_ACTIONS.addComment:
      return (
        <Field label="Comment" error={problem('body')}>
          <Textarea
            rows={3}
            value={String(args['body'] ?? '')}
            onChange={(event) => onArgs({ body: event.target.value })}
          />
        </Field>
      );
    case AUTOMATION_ACTIONS.addLabel:
      return (
        <Field label="Label" error={problem('label')}>
          <Select
            options={withCurrent(options.labels, args['label'])}
            placeholder="Pick a label"
            searchable
            value={String(args['label'] ?? '')}
            onChange={(event) => onArgs({ label: event.value })}
          />
        </Field>
      );
    case AUTOMATION_ACTIONS.sendWebhook:
      return (
        <Field
          label="Webhook"
          hint={
            options.webhooks.length === 0 && !options.webhooksPending
              ? 'No webhooks yet. A workspace admin adds them in Settings › Webhooks.'
              : undefined
          }
          error={problem('webhookId')}
        >
          <Select
            options={options.webhooks}
            placeholder={options.webhooksPending ? 'Loading…' : 'Pick a webhook'}
            value={String(args['webhookId'] ?? '')}
            onChange={(event) => onArgs({ webhookId: event.value })}
          />
        </Field>
      );
    case AUTOMATION_ACTIONS.notify:
      return <NotifyArgs args={args} options={options} problem={problem} onArgs={onArgs} />;
    default:
      return null;
  }
}

interface NotifyProps {
  args: Record<string, unknown>;
  options: RuleOptions;
  problem: (key: string) => string | undefined;
  onArgs: (args: Record<string, unknown>) => void;
}

function NotifyArgs({ args, options, problem, onArgs }: NotifyProps) {
  const recipients = (args['recipients'] as string[] | undefined) ?? [];
  const userIds = (args['userIds'] as string[] | undefined) ?? [];
  const toggle = (value: string) =>
    onArgs({
      recipients: recipients.includes(value)
        ? recipients.filter((item) => item !== value)
        : [...recipients, value],
    });
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-13 font-medium text-tx">Who</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {NOTIFY_RECIPIENTS.map((value) => (
            <Checkbox
              key={value}
              label={RECIPIENT_LABELS[value]}
              checked={recipients.includes(value)}
              onChange={() => toggle(value)}
            />
          ))}
        </div>
        {userIds.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {userIds.map((id) => (
              <Tag
                key={id}
                onRemove={() => onArgs({ userIds: userIds.filter((item) => item !== id) })}
                removeLabel={`Remove ${options.people.person(id).name}`}
              >
                {options.people.person(id).name}
              </Tag>
            ))}
          </div>
        ) : null}
        <Select
          aria-label="Add a person to notify"
          options={options.people.people
            .filter((user) => !userIds.includes(user.id))
            .map(personOption)}
          loadOptions={options.people.loadOptions}
          placeholder="Add a person…"
          value=""
          onChange={(event) => onArgs({ userIds: [...userIds, event.value] })}
        />
        {problem('recipients') ? (
          <span role="alert" className="text-12 text-red-tx">
            {problem('recipients')}
          </span>
        ) : null}
      </fieldset>
      <Field label="Message" error={problem('message')}>
        <Textarea
          rows={2}
          value={String(args['message'] ?? '')}
          onChange={(event) => onArgs({ message: event.target.value })}
        />
      </Field>
    </div>
  );
}
