import type { OAuthDeviceRequest } from '@bemmoly/shared';
import { Button, Field, Input, Skeleton } from '@bemmoly/ui';
import { useSearch } from '@tanstack/react-router';
import { AuthHeading, AuthShell } from '../../components/auth/auth-layout.tsx';
import { AuthNote, AuthSmall, PersonRow } from '../../components/auth/auth-parts.tsx';
import { FormError } from '../../components/form.tsx';
import { useDeviceSignIn } from '../../hooks/use-device-sign-in.ts';
import { useSwitchPerson } from '../../hooks/use-oauth-consent.ts';
import { useMe } from '../../hooks/use-session.ts';

type SignIn = ReturnType<typeof useDeviceSignIn>;

function CodeForm({ signIn }: { signIn: SignIn }) {
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        signIn.submit();
      }}
    >
      <Field
        label="Code"
        hint="The eight letters your terminal shows, like WDJB-MJHT."
        error={signIn.codeError ? <span role="alert">{signIn.codeError}</span> : undefined}
      >
        <Input
          size="touch"
          name="code"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          value={signIn.text}
          onChange={(event) => signIn.setText(event.target.value)}
        />
      </Field>
      <Button variant="primary" size="touch" type="submit">
        Continue
      </Button>
    </form>
  );
}

function Approve({ signIn, request }: { signIn: SignIn; request: OAuthDeviceRequest }) {
  const { user } = useMe();
  const signOut = useSwitchPerson();
  const busy = signIn.decide.isPending;
  const choice = signIn.decide.variables;
  return (
    <>
      <AuthNote tone="info" icon="monitor" title={request.deviceName}>
        {request.clientName} asks to act as you in {request.modules.join(', ')}, for 90 days.
        Approve only if your terminal shows {request.userCode} right now.
      </AuthNote>
      <PersonRow name={user.name} email={user.email} onForget={() => signOut.mutate()} />
      {signIn.decide.error ? <FormError error={signIn.decide.error} /> : null}
      <div className="flex flex-col gap-2.5">
        <Button
          variant="primary"
          size="touch"
          loading={busy && choice === true}
          disabled={busy}
          onClick={() => signIn.decide.mutate(true)}
        >
          Approve sign-in
        </Button>
        <Button
          size="touch"
          loading={busy && choice === false}
          disabled={busy}
          onClick={() => signIn.decide.mutate(false)}
        >
          Deny
        </Button>
      </div>
      <AuthSmall center>
        It can never do more than you can. Revoke it at any time in Settings › API tokens.
      </AuthSmall>
    </>
  );
}

function Done({ approved, name }: { approved: boolean; name: string }) {
  return approved ? (
    <AuthNote tone="info" icon="monitor" title={`${name} is signed in`}>
      Go back to your terminal; it carries on by itself. You can close this tab.
    </AuthNote>
  ) : (
    <AuthNote tone="neutral" icon="lock" title="Sign-in refused">
      {name} was not signed in. If you did not start this, nothing more is needed.
    </AuthNote>
  );
}

/**
 * Where a command line tool such as bp sends the person (device sign-in): type or confirm
 * the code the terminal shows, see which tool asks and for what, then approve or deny. The
 * tool collects its token by itself once approved.
 */
export function DeviceSignInPage() {
  const search = useSearch({ strict: false }) as { code?: string };
  const signIn = useDeviceSignIn(search.code);
  const data = signIn.request.data;
  const decided = signIn.decide.data;
  return (
    <AuthShell title="Sign in on a device">
      <AuthHeading
        title="Sign in on a device"
        lede="A command line tool asked to sign in as you. Check the code it shows."
      />
      {decided && data ? (
        <Done approved={decided.status === 'approved'} name={data.deviceName} />
      ) : !signIn.submitted ? (
        <CodeForm signIn={signIn} />
      ) : signIn.request.isPending ? (
        <div aria-busy="true" aria-label="Looking up the code" className="flex flex-col gap-4">
          <Skeleton height={72} />
          <Skeleton height={44} />
        </div>
      ) : signIn.request.error ? (
        <>
          <FormError error={signIn.request.error} />
          <Button size="touch" onClick={signIn.reset}>
            Use another code
          </Button>
        </>
      ) : data ? (
        <Approve signIn={signIn} request={data} />
      ) : null}
    </AuthShell>
  );
}
