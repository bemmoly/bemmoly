import {
  AUTOMATION_TRIGGERS,
  AUTOMATION_WATCHED_FIELDS,
  TIME_IN_STATUS_UNITS,
  type AutomationCatalogEntry,
} from '@bemmoly/module-work/shared';
import { Checkbox, Field, Input, Select, type SelectOption } from '@bemmoly/ui';
import { WATCHED_FIELD_LABELS } from './describe.ts';
import type { Problems, Step } from './model.ts';
import { withCurrent } from './use-rule-options.ts';

/** The Select needs a value for "Any status"; it is sent as no argument at all. */
const ANY = 'any-status';
const status = (value: string) => (value === ANY ? undefined : value);

const UNIT_OPTIONS: SelectOption[] = TIME_IN_STATUS_UNITS.map((unit) => ({
  value: unit,
  label: unit === 'days' ? 'Days' : 'Hours',
}));

interface TriggerEditorProps {
  trigger: Step;
  catalog: readonly AutomationCatalogEntry[];
  statuses: readonly SelectOption[];
  problems: Problems;
  onPick: (name: string) => void;
  onArgs: (args: Record<string, unknown>) => void;
}

/** "When": the trigger from the registry's catalog, then the arguments it takes. */
export function TriggerEditor({
  trigger,
  catalog,
  statuses,
  problems,
  onPick,
  onArgs,
}: TriggerEditorProps) {
  const options = catalog.map((entry) => ({
    value: entry.name,
    label: entry.label,
    description: entry.description,
    disabled: !entry.available,
  }));
  const args = trigger.args;
  const anyStatus = (current: unknown): SelectOption[] => [
    { value: ANY, label: 'Any status' },
    ...withCurrent(statuses, current),
  ];
  const fields = (args['fields'] as string[] | undefined) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Field label="Trigger" error={problems['trigger.name']}>
        <Select
          aria-label="Trigger"
          options={options}
          value={trigger.name}
          onChange={(event) => onPick(event.value)}
        />
      </Field>
      {trigger.name === AUTOMATION_TRIGGERS.fieldChanged ? (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1.5 p-0 text-13 font-medium text-tx">Fields to watch</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AUTOMATION_WATCHED_FIELDS.map((field) => (
              <Checkbox
                key={field}
                label={WATCHED_FIELD_LABELS[field] ?? field}
                checked={fields.includes(field)}
                onChange={() =>
                  onArgs({
                    fields: fields.includes(field)
                      ? fields.filter((item) => item !== field)
                      : [...fields, field],
                  })
                }
              />
            ))}
          </div>
          {problems['trigger.args.fields'] ? (
            <span role="alert" className="text-12 text-red-tx">
              {problems['trigger.args.fields']}
            </span>
          ) : null}
        </fieldset>
      ) : null}
      {trigger.name === AUTOMATION_TRIGGERS.issueTransitioned ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="From">
            <Select
              options={anyStatus(args['fromStatus'])}
              value={String(args['fromStatus'] ?? ANY)}
              onChange={(event) => onArgs({ fromStatus: status(event.value) })}
            />
          </Field>
          <Field label="To">
            <Select
              options={anyStatus(args['toStatus'])}
              value={String(args['toStatus'] ?? ANY)}
              onChange={(event) => onArgs({ toStatus: status(event.value) })}
            />
          </Field>
        </div>
      ) : null}
      {trigger.name === AUTOMATION_TRIGGERS.scheduled ? (
        <Field
          label="Schedule"
          hint="Five cron fields in UTC: minute, hour, day of month, month, day of week. 0 9 * * 1-5 is 09:00 on weekdays."
          error={problems['trigger.args.cron']}
        >
          <Input
            className="font-mono"
            value={String(args['cron'] ?? '')}
            onChange={(event) => onArgs({ cron: event.target.value })}
          />
        </Field>
      ) : null}
      {trigger.name === AUTOMATION_TRIGGERS.timeInStatus ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Status" error={problems['trigger.args.status']}>
            <Select
              options={withCurrent(statuses, args['status'])}
              placeholder="Pick a status"
              value={String(args['status'] ?? '')}
              onChange={(event) => onArgs({ status: event.value })}
            />
          </Field>
          <Field label="For more than" error={problems['trigger.args.amount']}>
            <Input
              type="number"
              min={1}
              value={String(args['amount'] ?? '')}
              onChange={(event) => onArgs({ amount: Number(event.target.value) })}
            />
          </Field>
          <Field label="Unit" error={problems['trigger.args.unit']}>
            <Select
              options={UNIT_OPTIONS}
              value={String(args['unit'] ?? 'days')}
              onChange={(event) => onArgs({ unit: event.value })}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
