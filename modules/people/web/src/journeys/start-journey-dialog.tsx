import { navigateInApp, useT } from '@bemmoly/core-web';
import { Button, Field, Input, Modal, Select, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { todayIso } from '../shared/format.ts';
import { peopleKeys } from '../shared/keys.ts';
import { peoplePaths } from '../shared/paths.ts';
import { useDirectory } from '../shared/queries.ts';

/** Starts a journey by hand: for a rehire, a mover, or anyone the events did not catch. */
export function StartJourneyDialog({ onClose }: { onClose: () => void }) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const everyone = useDirectory();
  const templates = useQuery({
    queryKey: peopleKeys.templates(),
    queryFn: async () => (await api.people.journeys.templates()).items,
  });
  const [userId, setUserId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const start = useMutation({
    mutationFn: () => api.people.journeys.start({ userId, templateId, anchorDate }),
    onSuccess: async (journey) => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({ tone: 'ok', title: t('people.journeys.started') });
      onClose();
      navigateInApp(peoplePaths.journey(journey.id));
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('people.journeys.startTitle')}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('people.edit.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!userId || !templateId || !anchorDate}
            loading={start.isPending}
            onClick={() => start.mutate()}
          >
            {t('people.journeys.startSave')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {start.error ? <p className="m-0 text-13 text-red-tx">{start.error.message}</p> : null}
        <Field label={t('people.journeys.person')}>
          <Select
            searchable
            value={userId}
            placeholder={t('people.edit.pick')}
            onChange={(event) => setUserId(event.value)}
            options={(everyone.data ?? []).map((person) => ({
              value: person.userId,
              label: person.name,
            }))}
          />
        </Field>
        <Field label={t('people.journeys.template')}>
          <Select
            value={templateId}
            placeholder={t('people.edit.pick')}
            onChange={(event) => setTemplateId(event.value)}
            options={(templates.data ?? [])
              .filter((template) => !template.archived)
              .map((template) => ({
                value: template.id,
                label: template.name,
                description: t(`people.journeys.${template.kind}`),
              }))}
          />
        </Field>
        <Field label={t('people.journeys.anchor')}>
          <Input
            type="date"
            value={anchorDate}
            onChange={(event) => setAnchorDate(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
