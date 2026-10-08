import { ConfirmChange, SettingsSection, UnsavedChangesBar } from '@bemmoly/ui';
import {
  DeliveryFields,
  DeliveryValues,
  DevMailboxNotice,
} from '../../components/email/delivery-section.tsx';
import { OutboxSection } from '../../components/email/outbox-section.tsx';
import { SenderFields, SenderValues } from '../../components/email/sender-section.tsx';
import { TestSendSection } from '../../components/email/test-send-section.tsx';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useConfirmChange } from '../../components/settings/use-confirm-change.ts';
import { useSectionEdits } from '../../components/settings/use-section-edits.ts';
import {
  deliveryRisk,
  NO_EMAIL_PERMISSION,
  useEmailOutbox,
  useEmailSettings,
  useEmailTest,
  type EmailSection,
} from '../../hooks/use-email-settings.ts';

const TITLES: Record<EmailSection, string> = {
  delivery: 'Delivery',
  sender: 'Sender and digests',
};

/** Settings › Email and notifications: no mock; built from the settings pages' parts. */
export function EmailPage() {
  const email = useEmailSettings();
  const test = useEmailTest();
  const outbox = useEmailOutbox(email.canManage);
  const confirm = useConfirmChange();
  const spec = (id: EmailSection) => ({
    title: TITLES[id],
    dirty: email.dirty[id],
    discard: () => email.discard(id),
  });
  const edits = useSectionEdits({ delivery: spec('delivery'), sender: spec('sender') });
  const { value, stored, canManage } = email;

  const save = (id: EmailSection) => {
    const prepared = email.prepare(id);
    if (!prepared || !stored) return;
    const risk = id === 'delivery' ? deliveryRisk(stored, prepared.form) : null;
    confirm.ask(risk, () => email.save(id, prepared.writes, () => edits.close(id)));
  };
  const section = (id: EmailSection) => ({
    ...edits.section(id),
    onSave: () => save(id),
    saving: email.saving === id,
    ...(canManage ? {} : { locked: NO_EMAIL_PERMISSION }),
  });
  const reading = (id: EmailSection) => edits.mode(id) === 'read';

  return (
    <SettingsPage
      title="Email and notifications"
      description="How Bemmoly sends notification and invitation email: the relay it hands mail to, the address it comes from and how often digests go out."
      loading={email.settings.isPending}
      error={email.settings.error}
    >
      {value && stored ? (
        <>
          {canManage ? null : <Notice tone="caution">{NO_EMAIL_PERMISSION}</Notice>}
          <SettingsSection {...section('delivery')} layout={reading('delivery') ? 'rows' : 'block'}>
            {reading('delivery') ? (
              <>
                <DeliveryValues value={stored} passwordSet={email.password.isSet} />
                {email.usesDevMailbox ? (
                  <div className="pb-2.5">
                    <DevMailboxNotice />
                  </div>
                ) : null}
              </>
            ) : (
              <DeliveryFields
                value={value}
                errors={email.errors}
                password={email.password}
                onChange={email.update}
              />
            )}
          </SettingsSection>
          <SettingsSection {...section('sender')} layout={reading('sender') ? 'rows' : 'block'}>
            {reading('sender') ? (
              <SenderValues value={stored} />
            ) : (
              <SenderFields value={value} errors={email.errors} onChange={email.update} />
            )}
          </SettingsSection>
          <TestSendSection
            to={test.to}
            error={test.error}
            result={test.result}
            requestError={test.send.error}
            sending={test.send.isPending}
            unsaved={email.dirty.delivery || email.dirty.sender}
            disabled={!canManage}
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
          <ConfirmChange {...confirm.dialog} />
          <UnsavedChangesBar {...edits.bar} />
        </>
      ) : null}
    </SettingsPage>
  );
}
