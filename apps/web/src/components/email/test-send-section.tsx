import { Button, Field, Input, SettingsSection } from '@bemmoly/ui';
import type { TestResultView } from '../../hooks/use-email-results.ts';
import { FormError } from '../form.tsx';
import { TestResult } from './test-result.tsx';

interface TestSendSectionProps {
  to: string;
  error: string | undefined;
  result: TestResultView | null;
  /** A request that never got an answer (offline, forbidden), as opposed to a failed send. */
  requestError: unknown;
  sending: boolean;
  /** Unsaved changes: the test would use the saved settings, not what is on screen. */
  unsaved: boolean;
  disabled: boolean;
  onTo: (to: string) => void;
  onSend: () => void;
}

export function TestSendSection(props: TestSendSectionProps) {
  const hint = props.unsaved
    ? 'Save your changes first: the test uses the saved settings.'
    : 'Leave blank to send it to yourself.';
  return (
    <SettingsSection title="Test email" hint="Required before you rely on email">
      <form
        noValidate
        className="flex items-start gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSend();
        }}
      >
        <Field label="Send to" hint={hint} error={props.error} className="flex-1">
          <Input
            size="lg"
            type="email"
            placeholder="you@acmelabs.dev"
            value={props.to}
            disabled={props.disabled}
            onChange={(event) => props.onTo(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="mt-5.75"
          loading={props.sending}
          disabled={props.disabled || props.unsaved}
        >
          Send test email
        </Button>
      </form>
      <FormError error={props.requestError} />
      {props.result ? <TestResult result={props.result} /> : null}
    </SettingsSection>
  );
}
