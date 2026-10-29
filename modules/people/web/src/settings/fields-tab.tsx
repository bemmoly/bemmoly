import { useT } from '@bemmoly/core-web';
import type { CustomFieldDefinition } from '@bemmoly/shared/custom-fields';
import { Field, FormGrid, Input, Select, Textarea, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useSession } from '../shared/queries.ts';
import { EditDialog, SettingsList } from './settings-list.tsx';

const KINDS = ['text', 'long_text', 'number', 'date', 'select', 'boolean'] as const;
type Kind = (typeof KINDS)[number];

/** Company fields on every profile: the kernel's custom fields for People's person entity. */
export function FieldsTab() {
  const t = useT(peopleText);
  const { can } = useSession();
  const query = useQuery({
    queryKey: peopleKeys.fieldDefinitions(),
    queryFn: async () => (await api.people.fieldDefinitions()).items,
  });
  const [adding, setAdding] = useState(false);
  return (
    <>
      <p className="m-0 text-13 text-tx-3">{t('people.settings.fieldsNote')}</p>
      <SettingsList<CustomFieldDefinition>
        label={t('people.settings.fields')}
        query={query}
        rowKey={(row) => row.id}
        empty={t('people.settings.emptyFields')}
        {...(can('workspace.settings.manage') ? { onAdd: () => setAdding(true) } : {})}
        columns={[
          {
            key: 'label',
            header: t('people.settings.label'),
            width: 'minmax(160px,2fr)',
            render: (row) => <span className="text-13 font-semibold">{row.label}</span>,
          },
          {
            key: 'key',
            header: t('people.settings.key'),
            width: '160px',
            render: (row) => <span className="font-mono text-12 text-tx-2">{row.key}</span>,
          },
          {
            key: 'kind',
            header: t('people.settings.fieldKind'),
            width: '120px',
            render: (row) => (
              <span className="text-13 text-tx-2">
                {(KINDS as readonly string[]).includes(row.kind)
                  ? t(`people.settings.kind.${row.kind as Kind}`)
                  : row.kind}
              </span>
            ),
          },
        ]}
      />
      {adding ? <FieldDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function FieldDialog({ onClose }: { onClose: () => void }) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [kind, setKind] = useState<Kind>('text');
  const [options, setOptions] = useState('');
  const derivedKey =
    key ||
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  const save = useMutation({
    mutationFn: () =>
      api.people.createField({
        key: derivedKey,
        label,
        kind,
        options:
          kind === 'select'
            ? options
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => ({
                  value: line.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                  label: line,
                }))
            : [],
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({ tone: 'ok', title: t('people.settings.saved') });
      onClose();
    },
  });
  return (
    <EditDialog
      title={t('people.settings.newField')}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      error={save.error}
    >
      <FormGrid columns={2}>
        <Field label={t('people.settings.label')}>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Field label={t('people.settings.key')}>
          <Input mono value={derivedKey} onChange={(event) => setKey(event.target.value)} />
        </Field>
      </FormGrid>
      <Field label={t('people.settings.fieldKind')}>
        <Select
          value={kind}
          onChange={(event) => setKind(event.value as Kind)}
          options={KINDS.map((value) => ({ value, label: t(`people.settings.kind.${value}`) }))}
        />
      </Field>
      {kind === 'select' ? (
        <Field label={t('people.settings.options')} hint={t('people.settings.optionsHint')}>
          <Textarea rows={4} value={options} onChange={(event) => setOptions(event.target.value)} />
        </Field>
      ) : null}
    </EditDialog>
  );
}
