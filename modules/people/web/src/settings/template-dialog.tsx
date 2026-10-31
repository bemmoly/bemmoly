import { useT } from '@bemmoly/core-web';
import {
  Button,
  Checkbox,
  Field,
  FormGrid,
  IconButton,
  Input,
  Select,
  useToast,
} from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { JourneyKind, JourneyTemplate, TemplateTask } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useDirectory, useOrgLookups } from '../shared/queries.ts';
import { EditDialog } from './settings-list.tsx';

const ownerValue = (owner: TemplateTask['owner']) =>
  owner.type === 'user' ? owner.userId : owner.type;
const ownerOf = (value: string): TemplateTask['owner'] =>
  value === 'person' || value === 'manager' ? { type: value } : { type: 'user', userId: value };

/** A journey template: who it is for, and its tasks with an owner and a day offset each. */
export function TemplateDialog({
  template,
  onClose,
}: {
  template: JourneyTemplate | null;
  onClose: () => void;
}) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const org = useOrgLookups();
  const everyone = useDirectory();
  const [name, setName] = useState(template?.name ?? '');
  const [kind, setKind] = useState<JourneyKind>(template?.kind ?? 'onboarding');
  const [locationId, setLocationId] = useState(template?.locationId ?? '');
  const [jobTitle, setJobTitle] = useState(template?.jobTitle ?? '');
  const [archived, setArchived] = useState(template?.archived ?? false);
  const [tasks, setTasks] = useState<TemplateTask[]>(
    template?.tasks ?? [{ title: '', owner: { type: 'manager' }, offsetDays: 0 }],
  );
  const setTask = (index: number, patch: Partial<TemplateTask>) =>
    setTasks((current) => current.map((task, at) => (at === index ? { ...task, ...patch } : task)));
  const save = useMutation({
    mutationFn: () => {
      const clean = tasks.filter((task) => task.title.trim());
      return template
        ? api.people.journeys.updateTemplate(template.id, {
            name,
            locationId: locationId || null,
            jobTitle: jobTitle.trim() || null,
            tasks: clean,
            archived,
          })
        : api.people.journeys.createTemplate({
            name,
            kind,
            locationId: locationId || null,
            jobTitle: jobTitle.trim() || null,
            tasks: clean,
          });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: peopleKeys.templates() });
      toast.show({ tone: 'ok', title: t('people.settings.saved') });
      onClose();
    },
  });
  const owners = [
    { value: 'person', label: t('people.settings.owner.person') },
    { value: 'manager', label: t('people.settings.owner.manager') },
    ...(everyone.data ?? []).map((person) => ({ value: person.userId, label: person.name })),
  ];
  return (
    <EditDialog
      width="lg"
      title={
        template
          ? t('people.settings.editNamed', { name: template.name })
          : t('people.settings.newTemplate')
      }
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      error={save.error}
    >
      <FormGrid columns={2}>
        <Field label={t('people.settings.name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={t('people.settings.kind')}>
          <Select
            value={kind}
            disabled={Boolean(template)}
            onChange={(event) => setKind(event.value as JourneyKind)}
            options={[
              { value: 'onboarding', label: t('people.journeys.onboarding') },
              { value: 'offboarding', label: t('people.journeys.offboarding') },
            ]}
          />
        </Field>
        <Field label={t('people.settings.location')}>
          <Select
            value={locationId}
            onChange={(event) => setLocationId(event.value)}
            options={[
              { value: '', label: t('people.settings.everywhere') },
              ...org.locations.map((place) => ({ value: place.id, label: place.name })),
            ]}
          />
        </Field>
        <Field label={t('people.settings.jobTitle')}>
          <Input
            value={jobTitle}
            placeholder={t('people.settings.anyTitle')}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </Field>
      </FormGrid>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-13 font-semibold text-tx">{t('people.settings.tasks')}</legend>
        {tasks.map((task, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_88px_32px] items-end gap-2 max-sm:grid-cols-1"
          >
            <Field label={t('people.settings.taskTitle')}>
              <Input
                value={task.title}
                onChange={(event) => setTask(index, { title: event.target.value })}
              />
            </Field>
            <Field label={t('people.settings.taskOwner')}>
              <Select
                searchable
                value={ownerValue(task.owner)}
                onChange={(event) => setTask(index, { owner: ownerOf(event.value) })}
                options={owners}
              />
            </Field>
            <Field label={t('people.settings.taskOffset')}>
              <Input
                inputMode="numeric"
                value={String(task.offsetDays)}
                onChange={(event) =>
                  setTask(index, { offsetDays: Number(event.target.value) || 0 })
                }
              />
            </Field>
            <IconButton
              icon="close"
              label={t('people.settings.removeTask', { index: index + 1 })}
              onClick={() => setTasks((current) => current.filter((_, at) => at !== index))}
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() =>
            setTasks((current) => [
              ...current,
              { title: '', owner: { type: 'manager' }, offsetDays: 0 },
            ])
          }
        >
          {t('people.settings.addTask')}
        </Button>
      </fieldset>
      {template ? (
        <Checkbox
          label={t('people.settings.archive')}
          checked={archived}
          onChange={(event) => setArchived(event.target.checked)}
        />
      ) : null}
    </EditDialog>
  );
}
