import { queryKeys } from '@bemmoly/api-client';
import { emailTestRequestSchema } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { validateForm, type FieldErrors } from '../lib/errors.ts';
import {
  EMAIL_KEYS,
  emailFormFrom,
  emailFormSchema,
  emailWrites,
  type EmailForm,
} from './use-email-form.ts';
import { outboxCounts, outboxStatus, testResultView } from './use-email-results.ts';
import { useMe } from './use-session.ts';
import { useDraft, useSettings } from './use-setting.ts';
import type { ChangeConfirm } from '../components/settings/use-confirm-change.ts';

export const NO_EMAIL_PERMISSION = 'Only people who can manage email delivery can change these.';

export const OUTBOX_LIMIT = 20;

export const outboxQuery = queryOptions({
  queryKey: queryKeys.email.outbox(),
  queryFn: () => api.email.outbox(OUTBOX_LIMIT),
  staleTime: 30_000,
});

/** The outbox summary and its recent failures; the realtime email.* events keep it fresh. */
export function useEmailOutbox(enabled: boolean) {
  const query = useQuery({ ...outboxQuery, enabled });
  return {
    ...query,
    status: query.data ? outboxStatus(query.data) : null,
    failing: (query.data?.failures?.count ?? 0) > 0,
    counts: query.data ? outboxCounts(query.data) : [],
    failures: query.data?.recentFailures ?? [],
  };
}

/** The test send: always a 200; the result says whether it went and, if not, why. */
export function useEmailTest() {
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: (recipient?: string) => api.email.test(recipient),
    // With the log provider the test lands in the dev mailbox the top bar counts.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.email.devMailbox() }),
  });
  const submit = () => {
    const recipient = to.trim();
    const check = validateForm(emailTestRequestSchema, recipient ? { to: recipient } : {});
    if (check.errors) return setError(check.errors['to']);
    setError(undefined);
    send.mutate(recipient || undefined);
  };
  return {
    to,
    setTo,
    error,
    submit,
    send,
    result: send.data ? testResultView(send.data) : null,
  };
}

/** The two editable sections of the page, each saved on its own. */
export type EmailSection = 'delivery' | 'sender';

const DELIVERY = ['provider', 'host', 'port', 'security', 'username', 'password'] as const;
const SENDER = ['from', 'replyTo', 'digestMinutes'] as const;
type DeliveryForm = Pick<EmailForm, (typeof DELIVERY)[number]>;
type SenderForm = Pick<EmailForm, (typeof SENDER)[number]>;

const pick = <K extends keyof EmailForm>(form: EmailForm, keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, form[key]])) as Pick<EmailForm, K>;

/** Switching from a relay to the dev mailbox stops real delivery, so it asks first. */
export function deliveryRisk(stored: EmailForm, next: EmailForm): ChangeConfirm | null {
  if (!(stored.provider === 'smtp' && next.provider === 'log')) return null;
  return {
    title: 'Stop sending real email?',
    consequences: [
      'Invitations, password resets and notifications stop reaching inboxes.',
      'Every message is kept in the dev mailbox on this server instead, where only admins see it.',
      'The relay settings stay stored, so switching back is one change.',
    ],
    confirmLabel: 'Use the dev mailbox',
    tone: 'caution',
  };
}

/** Settings › Email and notifications: the relay, the sender, digests, the test send, the outbox. */
export function useEmailSettings() {
  const me = useMe();
  const canManage = me.can('workspace.email.manage');
  const settings = useSettings(EMAIL_KEYS, 'Email settings saved');
  const stored = settings.reads && emailFormFrom(settings.reads);
  const delivery = useDraft<DeliveryForm>(stored && pick(stored, DELIVERY));
  const sender = useDraft<SenderForm>(stored && pick(stored, SENDER));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [replacing, setReplacing] = useState(false);
  const [saving, setSaving] = useState<EmailSection | null>(null);
  const passwordSet = settings.reads?.['email.smtp.password'].isSet ?? false;
  const value: EmailForm | undefined = delivery.value &&
    sender.value && { ...delivery.value, ...sender.value };

  const keysOf = (section: EmailSection): readonly string[] =>
    section === 'delivery' ? DELIVERY : SENDER;
  const discard = (section: EmailSection) => {
    if (section === 'delivery') {
      delivery.discard();
      setReplacing(false);
    } else sender.discard();
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !keysOf(section).includes(key))),
    );
  };

  /** The stored form with one section's edits; validated, or its field messages shown. */
  const prepare = (section: EmailSection) => {
    if (!canManage || !stored || !value) return null;
    const form = { ...stored, ...pick(value, keysOf(section) as Array<keyof EmailForm>) };
    const result = validateForm(emailFormSchema, form);
    if (result.errors) {
      setErrors(result.errors);
      return null;
    }
    setErrors({});
    return { form, writes: emailWrites(result.data) };
  };

  const save = (
    section: EmailSection,
    writes: ReturnType<typeof emailWrites>,
    onSaved = () => {},
  ) => {
    setSaving(section);
    settings.save.mutate(writes, {
      onSuccess: () => {
        discard(section);
        onSaved();
      },
      onSettled: () => setSaving(null),
    });
  };

  return {
    settings,
    canManage,
    stored,
    value,
    update: (patch: Partial<EmailForm>) => {
      const ofDelivery = Object.keys(patch).some((key) =>
        (DELIVERY as readonly string[]).includes(key),
      );
      if (ofDelivery && delivery.value) delivery.update(patch as Partial<DeliveryForm>);
      else if (sender.value) sender.update(patch as Partial<SenderForm>);
    },
    dirty: { delivery: delivery.dirty, sender: sender.dirty } satisfies Record<
      EmailSection,
      boolean
    >,
    errors,
    saving,
    password: {
      isSet: passwordSet,
      // With nothing stored there is nothing to keep, so the field shows straight away.
      editing: replacing || !passwordSet,
      replace: () => setReplacing(true),
    },
    /** The dev mailbox note follows what is saved, since that is where mail goes today. */
    usesDevMailbox: (stored?.provider ?? 'log') === 'log',
    discard,
    prepare,
    save,
  };
}
