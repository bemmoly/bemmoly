import type { AiPrivacy } from '@bemmoly/shared';
import { SettingsSection } from '@bemmoly/ui';
import { ExclusionsSection } from '../../../components/ai/exclusions-section.tsx';
import { PrivacySwitch, type PrivacyKey } from '../../../components/ai/privacy-rows.tsx';
import { SettingsPage } from '../../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../../components/settings/settings-states.tsx';
import { useAiAdminSettings, type AiAdminSettings } from '../../../hooks/use-ai-admin.ts';
import { PRIVACY_ROWS } from '../../../hooks/use-ai-settings.ts';
import { AI_PAGE_DESCRIPTION, AI_PAGE_TITLE } from './ai-setup-page.tsx';

type Toggle = Extract<PrivacyKey, keyof AiPrivacy>;

/** The setting each row writes, where the row's name and the field differ. */
const FIELD: Record<PrivacyKey, keyof AiPrivacy> = {
  shareContent: 'shareContent',
  redactEmails: 'redactEmails',
  redactNames: 'redactNames',
  allowActions: 'allowActions',
  optOut: 'perUserOptOutAllowed',
};

function Toggles({ admin, rows }: { admin: AiAdminSettings; rows: readonly PrivacyKey[] }) {
  const privacy = admin.settings?.privacy;
  return rows.map((row) => {
    const field = FIELD[row];
    const value = Boolean(privacy?.[field]);
    return (
      <PrivacySwitch
        key={row}
        row={row}
        checked={value}
        onChange={(next) =>
          admin.change(
            { privacy: { [field]: next } },
            { title: `${PRIVACY_ROWS[row].label}: ${next ? 'on' : 'off'}` },
          )
        }
      />
    );
  });
}

/**
 * Settings › AI › Privacy: what is sent (content, names and addresses), what is never sent
 * (excluded spaces and projects), whether AI may change data, and whether people may turn AI
 * off for themselves. Every switch applies at once with Undo.
 */
export function AiPrivacyPage() {
  const admin = useAiAdminSettings();
  const sent: Toggle[] = ['shareContent', 'redactEmails', 'redactNames'];
  return (
    <SettingsPage
      title={AI_PAGE_TITLE}
      description={AI_PAGE_DESCRIPTION}
      loading={admin.query.isPending}
      skeleton={<SettingsSkeleton sections={3} rows={3} />}
      error={admin.query.error}
    >
      <SettingsSection title="What is sent" layout="rows">
        <Toggles admin={admin} rows={sent} />
      </SettingsSection>
      <ExclusionsSection admin={admin} />
      <SettingsSection title="What AI may do" layout="rows">
        <Toggles admin={admin} rows={['allowActions', 'optOut']} />
      </SettingsSection>
    </SettingsPage>
  );
}
