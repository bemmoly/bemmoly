import { useT } from '@bemmoly/core-web';
import {
  Button,
  Checkbox,
  Field,
  FormGrid,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { leaveDays, overlaps } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { useBalances } from '../shared/balances.tsx';
import { todayIso } from '../shared/format.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useDirectory, usePeopleById, useSession } from '../shared/queries.ts';
import { useAbsences } from './queries.ts';

type Issues = Map<string, string>;

const issuesOf = (error: unknown): Issues =>
  new Map(
    (
      (error as { details?: { issues?: { path: string; message: string }[] } } | null)?.details
        ?.issues ?? []
    ).map((issue) => [issue.path, issue.message]),
  );

/**
 * Asking for time off: the type, the days, an optional note. The day count and the balance
 * after it are worked out as the server will, and the teammates already away show beside it.
 */
export function RequestDialog({ onClose }: { onClose: () => void }) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const balances = useBalances();
  const { userId } = useSession();
  const people = usePeopleById();
  const me = userId ? people.byId.get(userId) : undefined;
  const team = useDirectory(me?.teamId ? { teamId: me.teamId } : {});
  const [policyId, setPolicyId] = useState('');
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [halfDay, setHalfDay] = useState(false);
  const [note, setNote] = useState('');
  const absences = useAbsences(start, end < start ? start : end, me?.teamId ?? undefined);
  const balance = balances.data?.find((item) => item.policyId === policyId);
  const days = leaveDays(start, end, halfDay);
  const teammates = new Set((team.data ?? []).map((person) => person.userId));
  const alsoAway = new Set(
    (absences.data ?? [])
      .filter((a) => a.userId !== userId && teammates.has(a.userId))
      .filter((a) => overlaps({ start, end }, { start: a.startDate, end: a.endDate }))
      .map((a) => a.userId),
  ).size;
  const send = useMutation({
    mutationFn: () =>
      api.people.leave.request({
        policyId,
        startDate: start,
        endDate: end,
        halfDay,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: async (request) => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({
        tone: 'ok',
        title: t(request.status === 'approved' ? 'people.request.booked' : 'people.request.sent'),
      });
      onClose();
    },
  });
  const issues = issuesOf(send.error);
  const manager = people.name(me?.managerId);
  return (
    <Modal
      open
      onClose={onClose}
      title={t('people.request.title')}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('people.edit.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!policyId || days === 0}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            {t('people.request.send')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (policyId && days > 0) send.mutate();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send.mutate();
        }}
      >
        {send.error && issues.size === 0 ? (
          <p className="m-0 text-13 text-red-tx">{send.error.message}</p>
        ) : null}
        <Field label={t('people.request.type')} error={issues.get('policyId')}>
          <Select
            value={policyId}
            placeholder={t('people.request.pickType')}
            onChange={(event) => setPolicyId(event.value)}
            options={(balances.data ?? []).map((item) => ({
              value: item.policyId,
              label: item.name,
              description:
                item.left === null
                  ? t('people.timeOff.noLimit')
                  : t('people.timeOff.left', { left: item.left }),
            }))}
          />
        </Field>
        <FormGrid columns={2}>
          <Field label={t('people.request.from')} error={issues.get('startDate')}>
            <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
          <Field label={t('people.request.to')} error={issues.get('endDate')}>
            <Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </Field>
        </FormGrid>
        <Checkbox
          label={t('people.request.halfDay')}
          checked={halfDay}
          onChange={(event) => setHalfDay(event.target.checked)}
        />
        <Field label={t('people.request.note')} hint={t('people.request.noteHint')}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        </Field>
        <div className="flex flex-col gap-1 rounded-control bg-sunken px-3 py-2.5 text-13">
          <span className="font-semibold text-tx tabular-nums">
            {t('people.request.summary', { count: days })}
            {balance && balance.left !== null
              ? ` · ${t('people.request.leftAfter', { left: balance.left - days })}`
              : ''}
          </span>
          {alsoAway > 0 ? (
            <span className="text-tx-2">{t('people.request.alsoAway', { count: alsoAway })}</span>
          ) : null}
          {manager ? (
            <span className="text-tx-3">{t('people.request.goesTo', { name: manager })}</span>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
