import type { DomainEventKind, WebhookFormat, WebhookFormatPreset } from '@bemmoly/shared';
import { Checkbox, Radio } from '@bemmoly/ui';
import { formatPreview, type EventGroup } from '../../../hooks/use-webhook-form.ts';

interface EventsFieldProps {
  groups: readonly EventGroup[];
  chosen: readonly DomainEventKind[];
  error: string | undefined;
  onToggle: (kind: DomainEventKind) => void;
  onGroup: (group: EventGroup, on: boolean) => void;
}

/** One checkbox per event, under the name of the module that publishes it, with "All" per module. */
export function EventsField({ groups, chosen, error, onToggle, onGroup }: EventsFieldProps) {
  return (
    <fieldset
      className="m-0 flex flex-col gap-3 border-0 p-0"
      aria-describedby="webhook-events-error"
    >
      <legend className="mb-1.5 p-0 text-13 font-medium text-tx">Events</legend>
      {groups.length === 0 ? (
        <p className="m-0 text-12 text-tx-3">
          No module that publishes events is on. Turn on Work or Docs to choose events.
        </p>
      ) : null}
      {groups.map((group) => {
        const picked = group.events.filter((event) => chosen.includes(event.kind)).length;
        const all = picked === group.events.length;
        return (
          <div key={group.moduleId} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-line-2 pb-1.5">
              <span className="text-12 font-semibold text-tx-3">{group.label}</span>
              <span className="ml-auto">
                <Checkbox
                  label={`All ${group.label} events`}
                  checked={all}
                  ref={(input) => {
                    if (input) input.indeterminate = picked > 0 && !all;
                  }}
                  onChange={() => onGroup(group, !all)}
                />
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.events.map((event) => (
                <Checkbox
                  key={event.kind}
                  label={event.label}
                  description={<span className="font-mono">{event.kind}</span>}
                  checked={chosen.includes(event.kind)}
                  onChange={() => onToggle(event.kind)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {error ? (
        <span id="webhook-events-error" role="alert" className="text-12 text-red-tx">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

interface FormatFieldProps {
  formats: readonly WebhookFormatPreset[];
  value: WebhookFormat;
  onChange: (format: WebhookFormat) => void;
}

/** The body's shape: the event envelope or a chat preset, with what the chosen one sends. */
export function FormatField({ formats, value, onChange }: FormatFieldProps) {
  const chosen = formats.find((preset) => preset.id === value) ?? formats[0];
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-13 font-medium text-tx">Format</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {formats.map((preset) => (
          <Radio
            key={preset.id}
            name="webhook-format"
            label={preset.label}
            description={preset.description}
            checked={preset.id === value}
            onChange={() => onChange(preset.id)}
          />
        ))}
      </div>
      {chosen ? (
        <div className="flex flex-col gap-1">
          <span className="text-12 text-tx-3">
            {chosen.template
              ? 'What it sends. Bemmoly fills in the summary, link, event and its name.'
              : 'What it sends: the event envelope, version 1.'}
          </span>
          <pre
            aria-label={`${chosen.label} preview`}
            className="m-0 max-h-48 overflow-auto rounded-control border border-line bg-sunken px-3 py-2 font-mono text-12 leading-body text-tx-2"
          >
            {formatPreview(chosen)}
          </pre>
        </div>
      ) : null}
    </fieldset>
  );
}
