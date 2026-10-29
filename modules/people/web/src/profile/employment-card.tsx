import { useT } from '@bemmoly/core-web';
import { Button, Card, CardHeader } from '@bemmoly/ui';
import { useState } from 'react';
import type { DirectoryRow } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { useDateText } from '../shared/format.ts';
import { KeyValue } from '../shared/key-value.tsx';
import { usePeopleById, useOrgLookups, useSession } from '../shared/queries.ts';
import { EditEmploymentDialog } from './edit-employment-dialog.tsx';

/** The kernel's employment facts; those who manage people records edit them in a dialog. */
export function EmploymentCard({ person }: { person: DirectoryRow }) {
  const t = useT(peopleText);
  const date = useDateText();
  const org = useOrgLookups();
  const people = usePeopleById();
  const { can } = useSession();
  const [editing, setEditing] = useState(false);
  const none = <span className="text-tx-3">{t('people.profile.none')}</span>;
  const costCentre = org.costCentre(person.costCentreId);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t('people.profile.employment')}
        actions={
          can('workspace.people.manage') ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {t('people.profile.edit')}
            </Button>
          ) : null
        }
      />
      <KeyValue label={t('people.profile.state')}>{t(`people.state.${person.state}`)}</KeyValue>
      <KeyValue label={t('people.profile.jobTitle')}>{person.jobTitle ?? none}</KeyValue>
      <KeyValue label={t('people.profile.level')}>{person.level ?? none}</KeyValue>
      <KeyValue label={t('people.profile.manager')}>
        {person.managerId ? (
          <a
            href={`/people/p/${person.managerId}`}
            className="text-tx no-underline hover:underline"
          >
            {people.name(person.managerId) ?? t('people.someone')}
          </a>
        ) : (
          none
        )}
      </KeyValue>
      <KeyValue label={t('people.profile.team')}>{org.team(person.teamId)?.name ?? none}</KeyValue>
      <KeyValue label={t('people.profile.location')}>
        {org.location(person.locationId)?.name ?? none}
      </KeyValue>
      <KeyValue label={t('people.profile.costCentre')}>
        {costCentre ? `${costCentre.code} · ${costCentre.name}` : none}
      </KeyValue>
      <KeyValue label={t('people.profile.startDate')}>
        {person.startDate ? date(person.startDate) : none}
      </KeyValue>
      {person.endDate ? (
        <KeyValue label={t('people.profile.endDate')}>{date(person.endDate)}</KeyValue>
      ) : null}
      <KeyValue label={t('people.profile.email')}>{person.email}</KeyValue>
      {editing ? <EditEmploymentDialog person={person} onClose={() => setEditing(false)} /> : null}
    </Card>
  );
}
