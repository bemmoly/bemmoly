import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { AuthHeading, AuthShell, useAuthWorkspace } from '../../components/auth/auth-layout.tsx';
import {
  AuthAlt,
  AuthNote,
  OrRule,
  PersonRow,
  TextButton,
} from '../../components/auth/auth-parts.tsx';
import { DeactivatedNote, PasswordSignIn } from '../../components/auth/password-sign-in.tsx';
import { SignedInPane } from '../../components/auth/signed-in-pane.tsx';
import { SsoButtons } from '../../components/sso/sso-buttons.tsx';
import { useLoginForm } from '../../hooks/use-auth-forms.ts';
import { useLastSignIn } from '../../hooks/use-last-sign-in.ts';
import {
  SSO_FAILURE_COPY,
  ssoFailureReason,
  ssoFailureTitle,
  useSsoSignIn,
} from '../../hooks/use-sso-sign-in.ts';

function ReasonNote({ reason, workspace }: { reason: string | undefined; workspace: string }) {
  if (reason === 'signed-out') {
    return (
      <AuthNote tone="info" icon="log-out" title="You’re signed out">
        You signed out of {workspace} on this browser.
      </AuthNote>
    );
  }
  if (reason === 'expired') {
    return (
      <AuthNote tone="caution" icon="clock" title="Your session ended">
        For security, sessions end after a while or when an admin signs you out. Sign in to go back
        to where you were; everything you saved is still there.
      </AuthNote>
    );
  }
  return null;
}

/**
 * Sign in to the workspace. Single sign-on comes first when it is set up, with the method this
 * device used last focused and badged. When single sign-on is required the password form is
 * gone, and admins kept as a fallback reach it at ?method=password. A sign-on that did not
 * finish comes back here with its reason; an ended session or a sign-out says so.
 */
export function LoginPage() {
  const search = useSearch({ from: '/login' });
  const { redirect, reason, method } = search;
  const navigate = useNavigate();
  const sso = useSsoSignIn();
  const { last, forget } = useLastSignIn();
  const { name } = useAuthWorkspace();
  const workspace = name ?? 'this workspace';
  const remembered = reason && last?.email ? last : null;
  const form = useLoginForm(redirect, remembered?.email ?? '');
  const hasSso = sso.options.length > 0;
  const ssoOnly = hasSso && sso.requireSso;
  const adminFallback = ssoOnly && method === 'password';
  const failure = ssoFailureReason(search.sso_error);
  const tried = sso.options.find((option) => option.id === last?.providerId) ?? null;
  const setMethod = (next: 'password' | undefined) =>
    void navigate({ to: '/login', search: { ...search, method: next, sso_error: undefined } });
  const title = name ? `Sign in to ${name}` : 'Sign in';

  if (form.signedIn) {
    return (
      <AuthShell title="Signed in">
        <SignedInPane name={form.signedIn.name} workspace={workspace} />
      </AuthShell>
    );
  }

  // Which ways in exist decides what takes the focus, so the form waits for the answer.
  if (sso.query.isPending) {
    return (
      <AuthShell title={title}>
        <AuthHeading title={title} />
      </AuthShell>
    );
  }

  const start = (id: string) => sso.start(id, redirect);
  const ssoNote = failure ? (
    <AuthNote
      tone="danger"
      icon="warning"
      title={ssoFailureTitle(failure, tried?.displayName ?? null)}
      actions={
        tried ? (
          <TextButton onClick={() => start(tried.id)}>Try {tried.displayName} again</TextButton>
        ) : null
      }
    >
      {SSO_FAILURE_COPY[failure]}
    </AuthNote>
  ) : null;

  if (form.failure?.kind === 'deactivated') {
    return (
      <AuthShell title={title}>
        <AuthHeading title={title} />
        <DeactivatedNote workspace={workspace} onStartOver={form.startOver} />
      </AuthShell>
    );
  }

  if (adminFallback) {
    return (
      <AuthShell title="Admin sign-in">
        <AuthHeading
          title="Admin sign-in"
          lede={`Single sign-on is required for ${workspace}. Only admins kept as a fallback can use a password.`}
        />
        <PasswordSignIn
          form={form}
          workspace={workspace}
          showForgot={false}
          submitLabel="Sign in with password"
          autoFocus
        />
        <AuthAlt>
          <TextButton onClick={() => setMethod(undefined)}>Back to single sign-on</TextButton>
        </AuthAlt>
      </AuthShell>
    );
  }

  const person = remembered ? (
    <PersonRow name={remembered.name} email={remembered.email ?? ''} onForget={forget} />
  ) : null;
  const rememberedSso = remembered?.method === 'sso' && Boolean(tried);
  const providers = rememberedSso && tried ? [tried] : sso.options;

  return (
    <AuthShell title={title}>
      <ReasonNote reason={reason} workspace={workspace} />
      <AuthHeading
        title={reason ? 'Sign in again' : title}
        lede={
          reason
            ? undefined
            : ssoOnly
              ? `${workspace} signs everyone in through ${sso.options.length === 1 ? sso.options[0]?.displayName : 'single sign-on'}.`
              : hasSso
                ? `Use your ${workspace} work account.`
                : 'Welcome back.'
        }
      />
      {ssoNote}
      {person}
      {hasSso ? (
        <SsoButtons
          options={providers}
          only={ssoOnly}
          lastUsedId={last?.method === 'sso' ? last.providerId : null}
          autoFocus
          onStart={start}
        />
      ) : null}
      {ssoOnly ? (
        <>
          <AuthAlt>
            Admin without single sign-on?{' '}
            <TextButton onClick={() => setMethod('password')}>Use a password</TextButton>
          </AuthAlt>
        </>
      ) : rememberedSso ? null : (
        <>
          {hasSso ? <OrRule>or with email</OrRule> : null}
          <PasswordSignIn
            form={form}
            workspace={workspace}
            hideEmail={Boolean(remembered)}
            submitLabel={reason === 'expired' ? 'Sign in and go back' : 'Sign in'}
            secondarySubmit={hasSso}
            autoFocus={!hasSso}
          />
        </>
      )}
      {rememberedSso ? (
        <AuthAlt>
          <Link to="/login" search={{ redirect }}>
            Sign in another way
          </Link>
        </AuthAlt>
      ) : null}
    </AuthShell>
  );
}
