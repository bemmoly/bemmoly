import type { OAuthAuthorizationPreview, User } from '@bemmoly/shared';
import { Button, Skeleton, SkeletonText } from '@bemmoly/ui';
import { Link, useLocation } from '@tanstack/react-router';
import { AuthHeading, AuthShell, useAuthWorkspace } from '../../components/auth/auth-layout.tsx';
import { AuthAlt, AuthNote, AuthSmall, PersonRow } from '../../components/auth/auth-parts.tsx';
import { FormError } from '../../components/form.tsx';
import { AccessChoice, ClientCard, ModulesChoice } from '../../components/oauth/consent-parts.tsx';
import {
  authorizeRequestOf,
  navigation,
  useConsentChoice,
  useOAuthConsent,
  useSwitchPerson,
  type ConsentBlock,
} from '../../hooks/use-oauth-consent.ts';
import { useMe } from '../../hooks/use-session.ts';
import { describeError } from '../../lib/errors.ts';

type Ready = Extract<OAuthAuthorizationPreview, { status: 'ready' }>;
type Consent = ReturnType<typeof useOAuthConsent>;

const BLOCKED: Record<ConsentBlock, { title: string; tone: 'caution' | 'danger' }> = {
  mcp_off: { title: 'Apps can’t connect right now', tone: 'caution' },
  untrusted: { title: 'This connection can’t continue', tone: 'danger' },
};

function Blocked({ block, message }: { block: ConsentBlock; message: string }) {
  const look = BLOCKED[block];
  return (
    <>
      <AuthNote tone={look.tone} icon="warning" title={look.title}>
        {block === 'mcp_off'
          ? 'An org admin has turned the MCP server off. Ask them to turn it on in Settings › MCP, then connect again from your app.'
          : `${message.replace(/\.$/, '')}. Close this tab and start connecting again from your app.`}
      </AuthNote>
      <AuthAlt>
        <Link to="/" className="font-medium text-acc hover:text-acc-600">
          Open the workspace
        </Link>
      </AuthAlt>
    </>
  );
}

/** The request is malformed, but the app and its return address are known: go back there. */
function Invalid({
  preview,
}: {
  preview: Extract<OAuthAuthorizationPreview, { status: 'invalid' }>;
}) {
  return (
    <>
      <AuthNote
        tone="danger"
        icon="warning"
        title={`${preview.client.name} sent a request Bemmoly can’t use`}
      >
        {preview.description}. Go back and try connecting again; if it keeps happening, the app
        needs an update.
      </AuthNote>
      <Button size="touch" onClick={() => navigation.assign(preview.redirectUrl)}>
        Back to {preview.client.name}
      </Button>
    </>
  );
}

function Choose({ preview, consent, person }: { preview: Ready; consent: Consent; person: User }) {
  const choice = useConsentChoice(preview);
  const signOut = useSwitchPerson();
  const { client } = preview;
  const busy = consent.decide.isPending || consent.decide.isSuccess;
  const approving = busy && consent.decide.variables?.approve === true;
  const denying = busy && consent.decide.variables?.approve === false;
  const approve = () => {
    if (choice.error) return;
    consent.decide.mutate({ approve: true, access: choice.access, modules: choice.chosenModules });
  };
  return (
    <>
      <ClientCard client={client} />
      {client.loopback ? (
        <AuthNote tone="caution" icon="monitor" title="This app runs on your computer">
          It sends you back to {client.redirectHost}, which no website vouches for. Connect only if
          you started this from an app on this computer just now.
        </AuthNote>
      ) : null}
      <PersonRow name={person.name} email={person.email} onForget={() => signOut.mutate()} />
      <AccessChoice offered={preview.access} value={choice.access} onChange={choice.setAccess} />
      <ModulesChoice
        options={preview.moduleOptions}
        chosen={choice.modules}
        onToggle={choice.toggle}
        error={choice.error}
      />
      {consent.decide.error ? <FormError error={consent.decide.error} /> : null}
      <div className="flex flex-col gap-2.5">
        <Button
          variant="primary"
          size="touch"
          loading={approving}
          disabled={busy || choice.error !== null}
          onClick={approve}
        >
          Connect {client.name}
        </Button>
        <Button
          size="touch"
          loading={denying}
          disabled={busy}
          onClick={() => consent.decide.mutate({ approve: false })}
        >
          Deny
        </Button>
      </div>
      <AuthSmall center>
        It can never do more than you can. Disconnect it at any time in Settings › Access tokens.
      </AuthSmall>
    </>
  );
}

/**
 * Where an MCP client sends the browser: the person sees which app is asking, where it will
 * send them back, and chooses what it may do and where, then connects or denies. Every state
 * before that (loading, MCP off, an app or return address that can't be trusted, a malformed
 * request) says so and what to do next.
 */
export function OAuthConsentPage() {
  const searchStr = useLocation({ select: (location) => location.searchStr });
  const { user } = useMe();
  const consent = useOAuthConsent(authorizeRequestOf(searchStr));
  const { name } = useAuthWorkspace();
  const workspace = name ?? 'this workspace';
  const data = consent.preview.data;
  const title = data ? `Connect ${data.client.name}` : 'Connect an app';
  return (
    <AuthShell title={title}>
      <AuthHeading
        title={title}
        lede={
          data?.status === 'ready'
            ? `${data.client.name} wants to use ${workspace} as you, through the MCP server.`
            : undefined
        }
      />
      {consent.preview.isPending ? (
        <div
          aria-busy="true"
          aria-label="Loading the app’s request"
          className="flex flex-col gap-4"
        >
          <Skeleton height={96} />
          <SkeletonText lines={4} />
        </div>
      ) : consent.block ? (
        <Blocked block={consent.block} message={describeError(consent.preview.error).message} />
      ) : consent.preview.error ? (
        <FormError error={consent.preview.error} />
      ) : data?.status === 'invalid' ? (
        <Invalid preview={data} />
      ) : data ? (
        <Choose preview={data} consent={consent} person={user} />
      ) : null}
    </AuthShell>
  );
}
