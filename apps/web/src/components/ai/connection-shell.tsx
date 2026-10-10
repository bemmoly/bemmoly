import { Card, CardBody, CardHeader, Field, Input } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { CONNECTION_NOTE } from '../../hooks/use-ai-catalog.ts';
import { Notice } from '../form.tsx';
import type { Picker } from './provider-picker.tsx';

/**
 * The connection form for the chosen provider, built from its catalog entry.
 * Every input stays disabled: nothing can test or store a credential yet.
 */
export function ConnectionShell({ picker }: { picker: Picker }) {
  const { selected, connection, isLocal } = picker;
  if (!selected) return null;
  const doc = connection?.doc ? (
    <a
      href={connection.doc}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-acc"
    >
      Provider documentation
      <Icon name="external" size={14} />
    </a>
  ) : null;
  return (
    <Card aria-label={`Connect ${selected.name}`}>
      <CardHeader title={`Connect ${selected.name}`} actions={doc} />
      <CardBody className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3.5">
          {connection?.fields.map((field) => (
            <Field key={field.name} label={<span className="font-mono text-12">{field.name}</span>}>
              <Input size="lg" type={field.type} autoComplete="off" disabled />
            </Field>
          ))}
          <Field
            label="Base URL"
            className={(connection?.fields.length ?? 0) % 2 === 0 ? 'col-span-2' : undefined}
          >
            <Input
              size="lg"
              mono
              disabled
              value={connection?.baseUrl ?? ''}
              placeholder={isLocal ? 'The address of your model server' : 'The provider default'}
            />
          </Field>
        </div>
        <Notice>{connection?.note ?? CONNECTION_NOTE}</Notice>
      </CardBody>
    </Card>
  );
}
