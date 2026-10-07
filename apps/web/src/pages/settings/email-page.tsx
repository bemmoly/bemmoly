import { Button } from '@bemmoly/ui';
import { DeliverySection } from '../../components/email/delivery-section.tsx';
import { OutboxSection } from '../../components/email/outbox-section.tsx';
import { SenderSection } from '../../components/email/sender-section.tsx';
import { TestSendSection } from '../../components/email/test-send-section.tsx';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import {
  NO_EMAIL_PERMISSION,
  useEmailOutbox,
  useEmailSettings,
  useEmailTest,
} from '../../hooks/use-email-settings.ts';

/** Settings › Email and notifications: no mock; built from the settings pages' parts. */
export function EmailPage() {
  const email = useEmailSettings();
  const test = useEmailTest();
  const outbox = useEmailOutbox(email.canManage);
  const { draft, canManage } = email;
  const value = draft.value;
  const locked = !canManage;
  return (
    <SettingsPage
      title="Email and notifications"
      description="How Bemmoly sends notification and invitation email: the relay it hands mail to, the address it comes from and how often digests go out."
      loading={email.settings.isPending}
      error={email.settings.error}
      actions={
        <>
          <Button variant="secondary" disabled={!draft.dirty} onClick={email.discard}>
            Discard
          </Button>
          <Button
            variant="primary"
            disabled={locked || !draft.dirty}
            loading={email.settings.save.isPending}
            onClick={email.submit}
          >
            Save
          </Button>
        </>
      }
    >
      {value ? (
        <>
          {locked ? <Notice tone="caution">{NO_EMAIL_PERMISSION}</Notice> : null}
          <DeliverySection
            value={value}
            errors={email.errors}
            disabled={locked}
            usesDevMailbox={email.usesDevMailbox}
            password={email.password}
            onChange={draft.update}
          />
          <SenderSection
            value={value}
            errors={email.errors}
            disabled={locked}
            onChange={draft.update}
          />
          <TestSendSection
            to={test.to}
            error={test.error}
            result={test.result}
            requestError={test.send.error}
            sending={test.send.isPending}
            unsaved={draft.dirty}
            disabled={locked}
            onTo={test.setTo}
            onSend={test.submit}
          />
          {canManage ? (
            <OutboxSection
              loading={outbox.isPending}
              error={outbox.error}
              status={outbox.status}
              failing={outbox.failing}
              counts={outbox.counts}
              failures={outbox.failures}
            />
          ) : null}
        </>
      ) : null}
    </SettingsPage>
  );
}
