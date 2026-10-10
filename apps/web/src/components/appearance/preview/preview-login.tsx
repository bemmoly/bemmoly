import { Button, Card, Field, Input, Logo } from '@bemmoly/ui';

/**
 * A representative sign-in page: the logo, the tagline and the sign-in card.
 * The password is drawn as text so browsers never offer to fill or save it.
 */
export function PreviewLogin({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-sunken">
      <div className="flex flex-col items-center gap-3">
        <Logo variant="lockup" size={32} label="Bemmoly" />
        <span className="text-16 text-tx-3">Your work. Your platform.</span>
      </div>
      <Card className="flex w-100 flex-col gap-4 p-6">
        <span className="text-16 font-semibold text-tx">Sign in to {workspaceName}</span>
        <Field label="Email">
          <Input size="lg" autoComplete="off" defaultValue="rohan@acmelabs.dev" />
        </Field>
        <Field label="Password">
          <Input size="lg" type="password" autoComplete="off" defaultValue="preview-only" />
        </Field>
        <Button variant="primary" size="lg" block>
          Sign in
        </Button>
        <span className="text-center text-13 text-acc">Forgot your password?</span>
      </Card>
    </div>
  );
}
