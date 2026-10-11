import { Button, Field, Input, Kbd, PasswordInput } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { clock } from '../../lib/auth-errors.ts';
import type { useLoginForm } from '../../hooks/use-auth-forms.ts';
import { AuthNote, AuthSmall, TextButton } from './auth-parts.tsx';

type LoginForm = ReturnType<typeof useLoginForm>;

interface PasswordSignInProps {
  form: LoginForm;
  workspace: string;
  /** Hidden when single sign-on is required: the password lives with the provider. */
  showForgot?: boolean;
  /** The remembered person stands in for the email field. */
  hideEmail?: boolean;
  submitLabel?: string;
  /** Single sign-on leads on this page, so the password submit steps back to secondary. */
  secondarySubmit?: boolean;
  /** Focus the email field (or the password, when the email is known) on arrival. */
  autoFocus?: boolean;
}

/** What went wrong, where it belongs: notes above the button, never a field error for these. */
function FailureNote({ form, workspace }: { form: LoginForm; workspace: string }) {
  const { failure, server } = form;
  if (server.down) {
    return (
      <AuthNote
        tone="danger"
        icon="cloud-off"
        title={`Can’t reach the ${workspace} server`}
        actions={
          <>
            <Button
              size="sm"
              icon={<Icon name="refresh" size={14} />}
              loading={server.checking}
              onClick={server.retryNow}
            >
              Try again now
            </Button>
            <span className="text-12 text-tx-3">
              If it lasts, tell whoever runs Bemmoly at {workspace}.
            </span>
          </>
        }
      >
        {failure?.kind === 'timeout'
          ? 'The server took too long to answer. '
          : 'Your connection is fine; the server isn’t answering. '}
        Nothing you typed is lost. We’ll try again on our own in {server.secondsLeft || 20} seconds.
      </AuthNote>
    );
  }
  if (!failure) return null;
  if (failure.kind === 'rate-limited') {
    return (
      <AuthNote tone="caution" icon="clock" title="Too many attempts for this account">
        To keep it safe, sign-in is paused for {clock(form.waitLeft)}. Waiting does not lock you
        out.{' '}
        <Link to="/forgot-password" search={{ email: form.values.email || undefined }}>
          Reset your password
        </Link>{' '}
        if you’ve forgotten it.
      </AuthNote>
    );
  }
  if (failure.kind === 'sso-required') {
    return (
      <AuthNote tone="neutral" icon="key" title="Use single sign-on">
        {workspace} signs people in through its identity provider. Only admins kept as a fallback
        can use a password.
      </AuthNote>
    );
  }
  if (failure.kind === 'other') {
    return (
      <AuthNote tone="danger" icon="warning" title="That didn’t work">
        {failure.message}
        {failure.requestId ? ` Request id ${failure.requestId}.` : ''}
      </AuthNote>
    );
  }
  return null;
}

/** An account an admin turned off: no form, because nothing typed here will help. */
export function DeactivatedNote({
  workspace,
  onStartOver,
}: {
  workspace: string;
  onStartOver: () => void;
}) {
  return (
    <>
      <AuthNote tone="neutral" icon="user-x" title={`Your ${workspace} account is turned off`}>
        An admin turned it off, so signing in here won’t work. Ask a {workspace} admin to turn it
        back on in Settings › People.
      </AuthNote>
      <p className="m-0 text-center text-13 text-tx-2">
        <TextButton onClick={onStartOver}>Use a different account</TextButton>
      </p>
    </>
  );
}

/**
 * The email and password form of the sign-in page and the admin fallback. Pending, it is
 * read-only (what was typed stays, and Enter cannot send it twice).
 */
export function PasswordSignIn({
  form,
  workspace,
  showForgot = true,
  hideEmail = false,
  submitLabel = 'Sign in',
  secondarySubmit = false,
  autoFocus = false,
}: PasswordSignInProps) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const { selectPassword } = form;
  // Selected rather than cleared after a wrong password, so a near miss is one keystroke away.
  useEffect(() => {
    if (selectPassword > 0) passwordRef.current?.select();
  }, [selectPassword]);
  const locked = form.pending || form.waitLeft > 0;
  const down = form.server.down;
  const error = (message: string | undefined): ReactNode =>
    message ? <span role="alert">{message}</span> : undefined;
  const label = form.pending
    ? 'Signing in'
    : form.waitLeft > 0
      ? `Try again in ${clock(form.waitLeft)}`
      : submitLabel;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={form.submit}
      noValidate
      aria-busy={form.pending}
    >
      <FailureNote form={form} workspace={workspace} />
      <fieldset
        disabled={down}
        className={`m-0 flex flex-col gap-4 border-0 p-0 ${down ? 'opacity-55' : ''}`}
      >
        {hideEmail ? (
          // The remembered person's address, for password managers to fill against.
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={form.values.email}
            readOnly
            hidden
          />
        ) : (
          <Field label="Email" error={error(form.errors['email'])}>
            <Input
              size="touch"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              enterKeyHint="next"
              autoFocus={autoFocus && !form.values.email}
              readOnly={locked}
              value={form.values.email}
              onChange={(event) => form.set('email')(event.target.value)}
            />
          </Field>
        )}
        <div className="flex flex-col gap-1.5">
          <Field label="Password" error={error(form.errors['password'])}>
            <PasswordInput
              ref={passwordRef}
              autoComplete="current-password"
              enterKeyHint="go"
              autoFocus={autoFocus && Boolean(form.values.email)}
              readOnly={locked}
              value={form.values.password}
              onChange={(event) => form.set('password')(event.target.value)}
            />
          </Field>
          {showForgot ? (
            <Link
              to="/forgot-password"
              search={{ email: form.values.email || undefined }}
              className="self-end text-13 font-medium"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <Button
          type="submit"
          variant={secondarySubmit ? 'secondary' : 'primary'}
          size="touch"
          block
          loading={form.pending}
          disabled={form.waitLeft > 0}
          iconEnd={
            locked ? undefined : <Kbd keys="Enter" className="absolute right-3 max-sm:hidden" />
          }
          className="relative"
        >
          {label}
        </Button>
      </fieldset>
      {form.slow ? (
        <div role="status">
          <AuthSmall center>Taking longer than usual… still trying.</AuthSmall>
        </div>
      ) : null}
    </form>
  );
}
