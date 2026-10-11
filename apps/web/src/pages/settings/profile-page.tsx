import { useT } from '@bemmoly/core-web';
import { Avatar, Card, Select, SettingsRow, Switch } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useAiOptOut } from '../../hooks/use-ai-opt-out.ts';
import { useLanguage } from '../../hooks/use-language.ts';
import { useMe } from '../../hooks/use-session.ts';
import { settings } from '../../i18n/settings.ts';

/** The person's language, saved on their account; Automatic follows the browser. */
function LanguageRow() {
  const t = useT(settings);
  const language = useLanguage();
  return (
    <SettingsRow
      title={t('settings.profile.language')}
      description={t('settings.profile.languageHint')}
      control={
        <Select
          size="md"
          aria-label={t('settings.profile.language')}
          options={language.options}
          value={language.value}
          disabled={language.pending}
          onChange={(event) => language.set(event.value)}
        />
      }
    />
  );
}

/**
 * Account › Profile, where the user menu's Profile leads: who you are signed in as, and where
 * your own preferences live. Editing the name and password arrives with the account settings.
 * The worked example of an extracted settings page (docs/i18n.md).
 */
export function ProfilePage() {
  const t = useT(settings);
  const me = useMe();
  const ai = useAiOptOut();
  return (
    <SettingsPage
      title={t('settings.profile.title')}
      description={t('settings.profile.description')}
    >
      <Card className="flex items-center gap-4 px-5 py-4">
        <Avatar name={me.user.name} hue="accent" size={48} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-16 font-semibold text-tx">{me.user.name}</span>
          <span className="truncate text-13 text-tx-3">{me.user.email}</span>
        </div>
      </Card>
      <Card className="px-5 py-1">
        <LanguageRow />
        <SettingsRow
          title={t('settings.profile.notifications')}
          description={t('settings.profile.notificationsHint')}
          control={<Link to="/settings/notifications">{t('settings.profile.open')}</Link>}
        />
        <SettingsRow
          title={t('settings.profile.tokens')}
          description={t('settings.profile.tokensHint')}
          control={<Link to="/settings/access-tokens">{t('settings.profile.manage')}</Link>}
        />
        <SettingsRow
          title={t('settings.profile.theme')}
          description={t('settings.profile.themeHint')}
        />
        {ai.shown ? (
          <SettingsRow
            title={t('settings.profile.ai')}
            description={t('settings.profile.aiHint')}
            control={
              <Switch
                aria-label={t('settings.profile.ai')}
                checked={ai.useAi}
                disabled={ai.pending}
                onCheckedChange={ai.set}
              />
            }
          />
        ) : null}
      </Card>
    </SettingsPage>
  );
}
