import { START_PATH } from '@bemmoly/core-web';
import { queryKeys } from '@bemmoly/api-client';
import type { User } from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { signInFailure, type SignInFailure } from '../lib/auth-errors.ts';
import { serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';
import { leaveFor } from '../router/guards.ts';
import { loginForm } from './auth-form-schemas.ts';
import { useCountdown } from './use-countdown.ts';
import { rememberSignIn } from './use-last-sign-in.ts';
import { useServerReady } from './use-server-ready.ts';

/** After this long the button says it is still trying; after the limit it gives up. */
export const SLOW_AFTER_MS = 4_000;
export const GIVE_UP_AFTER_MS = 15_000;
/** The short "Signed in" beat before the app opens. */
export const SIGNED_IN_BEAT_MS = 700;

export const WRONG_PASSWORD =
  'That email and password don’t match. Check for typos, or reset your password.';

/** Form state shared by the sign-in pages: values, field errors, submit. */
export function useForm<V extends Record<string, string>>(initial: V) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (field: keyof V) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  return { values, errors, setErrors, setValues, set };
}

/** Loads the new session into the cache, so the app opens without asking again. */
export async function startSession(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.setupStatus() });
  await queryClient.fetchQuery({ queryKey: queryKeys.me(), queryFn: () => api.auth.me() });
}

type Phase = 'idle' | 'pending' | 'signed-in';

/**
 * Sign in with a password. While the request runs the fields are read-only and the button
 * busy; after 4s it says it is still trying and after 15s it gives up and keeps what was typed.
 * A wrong password is a field error with the password selected; a rate limit counts down from
 * the server's wait; a server that is not answering is retried on its own every 20 seconds.
 */
export function useLoginForm(redirectTo: string | undefined, initialEmail = '') {
  const form = useForm({ email: initialEmail, password: '' });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('idle');
  const [slow, setSlow] = useState(false);
  const [failure, setFailure] = useState<SignInFailure | null>(null);
  const [user, setUser] = useState<User | null>(null);
  /** Bumped on a wrong password; the form selects the password field when it changes. */
  const [selectPassword, setSelectPassword] = useState(0);
  const wait = useCountdown();
  const sendRef = useRef<() => Promise<void>>(async () => undefined);
  const server = useServerReady(() => void sendRef.current());

  const fail = (next: SignInFailure, error: unknown) => {
    setFailure(next);
    if (next.kind === 'wrong-password') {
      form.setErrors({ password: WRONG_PASSWORD });
      setSelectPassword((count) => count + 1);
    } else if (next.kind === 'rate-limited') {
      form.setErrors({});
      wait.start(next.retryAfterSeconds);
    } else if (next.kind === 'server-down' || next.kind === 'timeout') {
      server.lost();
    } else {
      form.setErrors(serverFieldErrors(error));
    }
  };

  const send = async () => {
    const result = validateForm(loginForm, form.values);
    if (result.errors) {
      form.setErrors(result.errors);
      return;
    }
    setPhase('pending');
    setFailure(null);
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    try {
      const signal = AbortSignal.timeout(GIVE_UP_AFTER_MS);
      const { user: signedIn } = await api.auth.login(result.data, { signal });
      rememberSignIn({
        method: 'password',
        providerId: null,
        email: signedIn.email,
        name: signedIn.name,
      });
      setUser(signedIn);
      setPhase('signed-in');
      await startSession(queryClient);
      window.setTimeout(
        () => leaveFor(redirectTo ?? START_PATH, (to) => void navigate({ to })),
        SIGNED_IN_BEAT_MS,
      );
    } catch (error) {
      setPhase('idle');
      fail(signInFailure(error), error);
    } finally {
      window.clearTimeout(slowTimer);
      setSlow(false);
    }
  };
  useEffect(() => {
    sendRef.current = send;
  });

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (phase !== 'idle' || wait.running || server.down) return;
    void send();
  };

  return {
    ...form,
    submit,
    selectPassword,
    pending: phase === 'pending',
    signedIn: phase === 'signed-in' ? user : null,
    slow,
    failure: failure?.kind === 'rate-limited' && !wait.running ? null : failure,
    waitLeft: wait.left,
    server,
    /** "Use a different account": the note goes and the email is empty again. */
    startOver: () => {
      setFailure(null);
      form.setValues({ email: '', password: '' });
    },
  };
}
