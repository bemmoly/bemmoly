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

/** Settings › Email and notifications: the relay, the sender, digests, the test send, the outbox. */
export function useEmailSettings() {
  const me = useMe();
  const canManage = me.can('workspace.email.manage') || me.can('workspace.settings.manage');
  const settings = useSettings(EMAIL_KEYS, 'Email settings saved');
  const draft = useDraft<EmailForm>(settings.reads && emailFormFrom(settings.reads));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [replacing, setReplacing] = useState(false);
  const passwordSet = settings.reads?.['email.smtp.password'].isSet ?? false;
  const storedProvider = settings.reads?.['email.provider'].value ?? 'log';

  const discard = () => {
    setErrors({});
    setReplacing(false);
    draft.discard();
  };
  const submit = () => {
    if (!canManage || !draft.value) return;
    const result = validateForm(emailFormSchema, draft.value);
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    settings.save.mutate(emailWrites(result.data), { onSuccess: discard });
  };

  return {
    settings,
    canManage,
    draft,
    errors,
    password: {
      isSet: passwordSet,
      // With nothing stored there is nothing to keep, so the field shows straight away.
      editing: replacing || !passwordSet,
      replace: () => setReplacing(true),
    },
    /** The dev mailbox note follows what is saved, since that is where mail goes today. */
    usesDevMailbox: storedProvider === 'log',
    submit,
    discard,
  };
}
