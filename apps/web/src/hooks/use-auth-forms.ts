import { acceptForm, loginForm, resetForm, resetRequestForm } from './auth-form-schemas.ts';
import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';
import { safeRedirect } from '../router/guards.ts';

/** Form state shared by the sign-in pages: values, field errors, submit. */
function useForm<V extends Record<string, string>>(initial: V) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (field: keyof V) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  return { values, errors, setErrors, set };
}

async function startSession(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.setupStatus() });
  await queryClient.fetchQuery({ queryKey: queryKeys.me(), queryFn: () => api.auth.me() });
}

export function useLoginForm(redirectTo: string | undefined) {
  const form = useForm({ email: '', password: '' });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (body: { email: string; password: string }) => api.auth.login(body),
    onSuccess: async () => {
      await startSession(queryClient);
      await navigate({ to: safeRedirect(redirectTo) });
    },
    onError: (error) => form.setErrors(serverFieldErrors(error)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(loginForm, form.values);
    if (result.errors) return form.setErrors(result.errors);
    mutation.mutate(result.data);
  };
  return { ...form, submit, mutation };
}

export function useRequestResetForm() {
  const form = useForm({ email: '' });
  const mutation = useMutation({
    mutationFn: (email: string) => api.auth.requestPasswordReset({ email }),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(resetRequestForm, form.values);
    if (result.errors) return form.setErrors(result.errors);
    mutation.mutate(result.data.email);
  };
  return { ...form, submit, mutation };
}

function matching(values: { password: string; confirm: string }): FieldErrors | null {
  return values.password === values.confirm ? null : { confirm: 'The two passwords do not match' };
}

export function useResetPasswordForm(token: string | undefined) {
  const form = useForm({ password: '', confirm: '' });
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (password: string) =>
      api.auth.completePasswordReset({ token: token ?? '', password }),
    onSuccess: () => navigate({ to: '/login', search: { redirect: undefined } }),
    onError: (error) => form.setErrors(serverFieldErrors(error)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(resetForm, {
      token,
      password: form.values.password,
    });
    const mismatch = matching(form.values);
    if (result.errors || mismatch) return form.setErrors({ ...result.errors, ...mismatch });
    mutation.mutate(result.data.password);
  };
  return { ...form, submit, mutation };
}

export function useAcceptInvitation(token: string | undefined) {
  const form = useForm({ name: '', password: '', confirm: '' });
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
    onSuccess: async () => {
      await startSession(queryClient);
      await navigate({ to: '/' });
    },
    onError: (error) => form.setErrors(serverFieldErrors(error)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(acceptForm, form.values);
    const mismatch = matching(form.values);
    if (result.errors || mismatch) return form.setErrors({ ...result.errors, ...mismatch });
    mutation.mutate(result.data);
  };
  return { ...form, submit, mutation, invitation };
}
