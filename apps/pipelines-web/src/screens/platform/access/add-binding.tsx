import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import {
  roleSchema,
  type EnvironmentClass,
  type Role,
  type ScopeRef,
} from '@bemmoly/module-pipelines/shared';
import { Button, Field, Modal, SegmentedControl, Select, Textarea, useToast } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { pipelinesKeys } from '../../../api/pipelines.ts';
import { useBindingWrites } from '../../../hooks/use-access.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { api } from '../../../lib/api.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';
import { searchPeople } from './checker-inputs.ts';

const HOURS = ['1', '4', '24', '168'] as const;
const CLASSES = ['', 'dev', 'staging', 'prod'] as const;

/**
 * A role for a team at the chosen scope, or, for break-glass only, for one person with an end
 * time and a reason. A refusal says why and whom to ask, in the dialog.
 */
export function AddBinding({
  open,
  onClose,
  scope,
  scopeName,
}: {
  open: boolean;
  onClose: () => void;
  scope: ScopeRef | null;
  scopeName: string;
}) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const { create } = useBindingWrites();
  const [kind, setKind] = useState<'team' | 'user'>('team');
  const [subject, setSubject] = useState('');
  const [role, setRole] = useState<Role>('developer');
  const [environment, setEnvironment] = useState<(typeof CLASSES)[number]>('');
  const [hours, setHours] = useState<(typeof HOURS)[number]>('4');
  const [reason, setReason] = useState('');
  const teams = useQuery({
    queryKey: pipelinesKeys.teams(false),
    queryFn: () => api.pipelines.teams(false),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const person = kind === 'user';
  const ready = Boolean(scope && subject && (!person || reason.trim()));
  const refusal = refusalOf(create.error);
  const invalid =
    create.error instanceof ApiError && create.error.code === 'validation_failed'
      ? create.error.message
      : null;
  const close = () => {
    create.reset();
    setSubject('');
    setReason('');
    onClose();
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || !scope) return;
    create.mutate(
      {
        subject: { kind, id: subject },
        role,
        scope,
        ...(environment ? { environmentClass: environment as EnvironmentClass } : {}),
        ...(person
          ? {
              expiresAt: new Date(Date.now() + Number(hours) * 3_600_000).toISOString(),
              reason: reason.trim(),
            }
          : {}),
      },
      {
        onSuccess: () => {
          toast.show({ tone: 'ok', title: t('pipelines.access.added', { scope: scopeName }) });
          close();
        },
      },
    );
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('pipelines.access.addTitle')}
      description={t('pipelines.access.addDescription', { scope: scopeName })}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!ready}
            loading={create.isPending}
            onClick={() => submit()}
          >
            {t('pipelines.access.addBinding')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
        }}
      >
        <SegmentedControl
          aria-label={t('pipelines.access.who')}
          options={[
            { value: 'team', label: t('pipelines.access.forTeam') },
            { value: 'user', label: t('pipelines.access.forPerson') },
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next);
            setSubject('');
          }}
        />
        {person ? (
          <Field label={t('pipelines.access.checkPerson')} hint={t('pipelines.access.personHint')}>
            <Select
              value={subject}
              placeholder={t('pipelines.access.searchPeople')}
              loadOptions={searchPeople}
              onChange={(event) => setSubject(event.value)}
            />
          </Field>
        ) : (
          <Field label={t('pipelines.access.team')}>
            <Select
              value={subject}
              searchable
              placeholder={t('pipelines.access.pickTeam')}
              options={
                teams.data?.items.map((team) => ({
                  value: team.id,
                  label: team.name,
                  description: t('pipelines.access.teamSize', { count: team.memberCount }),
                })) ?? []
              }
              onChange={(event) => setSubject(event.value)}
            />
          </Field>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('pipelines.access.role')}>
            <Select
              value={role}
              options={roleSchema.options.map((value) => ({
                value,
                label: t(`pipelines.role.${value}`),
              }))}
              onChange={(event) => setRole(event.value as Role)}
            />
          </Field>
          <Field label={t('pipelines.access.environments')}>
            <Select
              value={environment}
              options={CLASSES.map((value) => ({
                value,
                label: value
                  ? t('pipelines.access.onlyIn', { env: t(`pipelines.envClass.${value}`) })
                  : t('pipelines.access.everyEnvironment'),
              }))}
              onChange={(event) => setEnvironment(event.value as (typeof CLASSES)[number])}
            />
          </Field>
        </div>
        {person && (
          <>
            <Field label={t('pipelines.access.forHowLong')}>
              <Select
                value={hours}
                options={HOURS.map((value) => ({
                  value,
                  label: t('pipelines.access.hours', { count: Number(value) }),
                }))}
                onChange={(event) => setHours(event.value as (typeof HOURS)[number])}
              />
            </Field>
            <Field label={t('pipelines.access.reason')} hint={t('pipelines.access.reasonHint')}>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </>
        )}
        {(refusal || invalid) && (
          <p role="alert" className="rounded-control bg-red-50 px-3 py-2 text-12 text-red-tx">
            {refusal ? `${refusal.sentence} ${refusal.askWho?.label ?? ''}` : invalid}
          </p>
        )}
      </form>
    </Modal>
  );
}
