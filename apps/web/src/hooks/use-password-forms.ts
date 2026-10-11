import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { serverFieldErrors, validateForm } from '../lib/errors.ts';
import { acceptForm, resetForm, resetRequestForm } from './auth-form-schemas.ts';
import { startSession, useForm } from './use-auth-forms.ts';
import { useCountdown } from './use-countdown.ts';
import { rememberSignIn } from './use-last-sign-in.ts';

/** How long before "Resend link" works again. */
export const RESEND_AFTER_SECONDS = 60;

/** Forgot password: the email carried over from sign-in, and a resend after a short wait. */
export function useRequestResetForm(initialEmail = '') {
  const form = useForm({ email: initialEmail });
  const cooldown = useCountdown();
  const [sent, setSent] = useState(false);
  const mutation = useMutation({
    mutationFn: (email: string) => api.auth.requestPasswordReset({ email }),
    onSuccess: () => {
      setSent(true);
      cooldown.start(RESEND_AFTER_SECONDS);
    },
  });
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const result = validateForm(resetRequestForm, form.values);
    if (result.errors) return form.setErrors(result.errors);
    mutation.mutate(result.data.email);
  };
  return {
    ...form,
    submit,
    mutation,
    sent,
    resendIn: cooldown.left,
    resend: () => submit(),
  };
}

/**
 * Reset password: whose account the link is for, one new password, and saving it signs in on
 * this browser (the server opens the session), so the app opens straight after.
 */
export function useResetPasswordForm(token: string | undefined) {
  const form = useForm({ password: '' });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const account = useQuery({
    queryKey: ['password-reset', token],
    queryFn: () => api.auth.previewPasswordReset(token ?? ''),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
  const mutation = useMutation({
    mutationFn: (password: string) =>
      api.auth.completePasswordReset({ token: token ?? '', password }),
    onSuccess: async ({ user }) => {
      rememberSignIn({ method: 'password', providerId: null, email: user.email, name: user.name });
      await startSession(queryClient);
      await navigate({ to: '/' });
    },
    onError: (error) => form.setErrors(serverFieldErrors(error)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(resetForm, { token, password: form.values.password });
    if (result.errors) return form.setErrors(result.errors);
    mutation.mutate(result.data.password);
  };
  return { ...form, submit, mutation, account };
}

/** Accept an invitation with a name and a password (when single sign-on is not the way in). */
export function useAcceptInvitation(token: string | undefined) {
  const form = useForm({ name: '', password: '' });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.auth.invitation(token ?? ''),
    enabled: Boolean(token),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (body: { name: string; password: string }) =>
      api.auth.acceptInvitation(token ?? '', body),
    onSuccess: async ({ user }) => {
      rememberSignIn({ method: 'password', providerId: null, email: user.email, name: user.name });
      await startSession(queryClient);
      await navigate({ to: '/' });
    },
    onError: (error) => form.setErrors(serverFieldErrors(error)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(acceptForm, form.values);
    if (result.errors) return form.setErrors(result.errors);
    mutation.mutate(result.data);
  };
  return { ...form, submit, mutation, invitation };
}
