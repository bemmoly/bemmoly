import type {
  ChangeRequestDetail,
  ChangeRequestOptions,
  ChangeRisk,
  CreateChangeRequestBody,
} from '@bemmoly/module-pipelines/shared';
import { useMemo, useState } from 'react';
import { useSearchText } from '../../hooks/use-search-state.ts';
import { useChangeRequest, useChangeRequestOptions } from './use-change-requests.ts';

/*
 * The New change request form's state and rules. Opened from Deploy or promote it arrives
 * with ?environment=, ?application= and ?release=; opened from a request's Edit it arrives
 * with ?edit=CHG-1042 and starts from that request. Send stays off until every step that
 * applies at the chosen risk has as many people picked as it needs.
 */

export interface NewChangeForm {
  environment: string;
  title: string;
  why: string;
  risk: ChangeRisk;
  whenKind: 'asap' | 'at';
  at: string;
  rollback: string;
  /** Service key to release id. */
  items: Record<string, string>;
  /** Step position to the people picked. */
  picks: Record<number, string[]>;
}

const EMPTY: NewChangeForm = {
  environment: '',
  title: '',
  why: '',
  risk: 'low',
  whenKind: 'asap',
  at: '',
  rollback: '',
  items: {},
  picks: {},
};

function fromRequest(request: ChangeRequestDetail): NewChangeForm {
  return {
    environment: request.environment.key,
    title: request.title,
    why: request.why,
    risk: request.risk,
    whenKind: request.when.kind,
    at: request.when.kind === 'at' ? request.when.at.slice(0, 16) : '',
    rollback: request.rollback,
    items: Object.fromEntries(request.items.map((item) => [item.application.key, item.releaseId])),
    picks: Object.fromEntries(
      request.steps.map((step) => [step.position, step.picked.map((person) => person.id)]),
    ),
  };
}

export function useNewChange() {
  const [edit] = useSearchText('edit');
  const [environmentParam] = useSearchText('environment');
  const [application] = useSearchText('application');
  const [release] = useSearchText('release');
  const editing = useChangeRequest(edit);
  // Until the person changes something, the form is the request being edited or the link's.
  const [own, setOwn] = useState<NewChangeForm | null>(null);
  const base: NewChangeForm = editing.data
    ? fromRequest(editing.data)
    : {
        ...EMPTY,
        environment: environmentParam,
        items: application && release ? { [application]: release } : {},
      };
  const chosen = own ?? base;
  const update = (change: (f: NewChangeForm) => NewChangeForm) =>
    setOwn((current) => change(current ?? base));
  const options = useChangeRequestOptions(
    edit && !editing.data
      ? null
      : { ...(chosen.environment ? { environment: chosen.environment } : {}), risk: chosen.risk },
  );
  const data: ChangeRequestOptions | undefined = options.data;
  // The server picks the environment when the link named none; the form follows it.
  const form: NewChangeForm = {
    ...chosen,
    environment: chosen.environment || data?.environment.key || '',
  };

  const steps = useMemo(() => data?.steps.filter((step) => step.applies) ?? [], [data]);
  const picked = (position: number) => form.picks[position] ?? [];
  const missing = steps.reduce(
    (sum, step) => sum + Math.max(0, step.count - picked(step.position).length),
    0,
  );
  const itemCount = Object.keys(form.items).length;
  const ready =
    form.title.trim().length > 0 &&
    form.why.trim().length > 0 &&
    itemCount > 0 &&
    missing === 0 &&
    (form.whenKind === 'asap' || form.at.length > 0);

  const set = <K extends keyof NewChangeForm>(key: K, value: NewChangeForm[K]) =>
    update((f) => ({ ...f, [key]: value }));

  return {
    form,
    set,
    options: data,
    optionsQuery: options,
    editing: edit ? editing : null,
    editNumber: edit,
    steps,
    picked,
    missing,
    ready,
    /** A new environment keeps nothing it might not allow. */
    chooseEnvironment: (key: string) =>
      update((f) => ({ ...f, environment: key, items: {}, picks: {} })),
    toggleVersion: (service: string, releaseId: string | null) =>
      update((f) => {
        const items = { ...f.items };
        if (releaseId) items[service] = releaseId;
        else delete items[service];
        return { ...f, items };
      }),
    togglePick: (position: number, userId: string) =>
      update((f) => {
        const current = f.picks[position] ?? [];
        const next = current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId];
        return { ...f, picks: { ...f.picks, [position]: next } };
      }),
    body: (send: boolean): CreateChangeRequestBody => ({
      environment: form.environment,
      title: form.title.trim(),
      why: form.why.trim(),
      risk: form.risk,
      when:
        form.whenKind === 'at' && form.at
          ? { kind: 'at', at: new Date(form.at).toISOString() }
          : { kind: 'asap' },
      rollback: form.rollback.trim(),
      items: Object.entries(form.items).map(([service, releaseId]) => ({
        application: service,
        releaseId,
      })),
      picks: steps
        .map((step) => ({ step: step.position, users: picked(step.position) }))
        .filter((pick) => pick.users.length > 0),
      send,
    }),
  };
}

export type NewChangeState = ReturnType<typeof useNewChange>;
