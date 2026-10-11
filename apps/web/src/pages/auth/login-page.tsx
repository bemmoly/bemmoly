import { useT } from '@bemmoly/core-web';
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
import { shellText } from '../../i18n/catalogs.ts';
import {
  SSO_FAILURE_COPY,
  ssoFailureReason,
  ssoFailureTitle,
  useSsoSignIn,
} from '../../hooks/use-sso-sign-in.ts';

function ReasonNote({ reason, workspace }: { reason: string | undefined; workspace: string }) {
  const t = useT(shellText);
  if (reason === 'signed-out') {
    return (
      <AuthNote tone="info" icon="log-out" title={t('shell.signIn.signedOutTitle')}>
        {t('shell.signIn.signedOutBody', { workspace })}
      </AuthNote>
    );
  }
  if (reason === 'expired') {
    return (
      <AuthNote tone="caution" icon="clock" title={t('shell.signIn.expiredTitle')}>
        {t('shell.signIn.expiredBody')}
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
  const t = useT(shellText);
  const search = useSearch({ from: '/login' });
  const { redirect, reason, method } = search;
  const navigate = useNavigate();
  const sso = useSsoSignIn();
  const { last, forget } = useLastSignIn();
  const { name } = useAuthWorkspace();
  const workspace = name ?? t('shell.signIn.thisWorkspace');
  const remembered = reason && last?.email ? last : null;
  const form = useLoginForm(redirect, remembered?.email ?? '');
  const hasSso = sso.options.length > 0;
  const ssoOnly = hasSso && sso.requireSso;
  const adminFallback = ssoOnly && method === 'password';
  const failure = ssoFailureReason(search.sso_error);
  const tried = sso.options.find((option) => option.id === last?.providerId) ?? null;
  const setMethod = (next: 'password' | undefined) =>
    void navigate({ to: '/login', search: { ...search, method: next, sso_error: undefined } });
  const title = name ? t('shell.signIn.titleTo', { workspace: name }) : t('shell.signIn.title');

  if (form.signedIn) {
    return (
      <AuthShell title={t('shell.signIn.signedIn')}>
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
          <TextButton onClick={() => start(tried.id)}>
            {t('shell.signIn.tryProviderAgain', { provider: tried.displayName })}
          </TextButton>
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
      <AuthShell title={t('shell.signIn.adminTitle')}>
        <AuthHeading
          title={t('shell.signIn.adminTitle')}
          lede={t('shell.signIn.adminLede', { workspace })}
        />
        <PasswordSignIn
          form={form}
          workspace={workspace}
          showForgot={false}
          submitLabel={t('shell.signIn.withPassword')}
          autoFocus
        />
        <AuthAlt>
          <TextButton onClick={() => setMethod(undefined)}>
            {t('shell.signIn.backToSso')}
          </TextButton>
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
        title={reason ? t('shell.signIn.again') : title}
        lede={
          reason
            ? undefined
            : ssoOnly
              ? t('shell.signIn.ssoOnlyLede', {
                  workspace,
                  provider:
                    (sso.options.length === 1 ? sso.options[0]?.displayName : undefined) ??
                    t('shell.signIn.singleSignOn'),
                })
              : hasSso
                ? t('shell.signIn.workAccount', { workspace })
                : t('shell.signIn.welcome')
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
            {t('shell.signIn.adminWithoutSso')}{' '}
            <TextButton onClick={() => setMethod('password')}>
              {t('shell.signIn.usePassword')}
            </TextButton>
          </AuthAlt>
        </>
      ) : rememberedSso ? null : (
        <>
          {hasSso ? <OrRule>{t('shell.signIn.orWithEmail')}</OrRule> : null}
          <PasswordSignIn
            form={form}
            workspace={workspace}
            hideEmail={Boolean(remembered)}
            submitLabel={
              reason === 'expired' ? t('shell.signIn.andGoBack') : t('shell.signIn.title')
            }
            secondarySubmit={hasSso}
            autoFocus={!hasSso}
          />
        </>
      )}
      {rememberedSso ? (
        <AuthAlt>
          <Link to="/login" search={{ redirect }}>
            {t('shell.signIn.anotherWay')}
          </Link>
        </AuthAlt>
      ) : null}
    </AuthShell>
  );
}
