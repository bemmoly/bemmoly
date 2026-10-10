import { Avatar, Card, SettingsRow, Switch } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useAiOptOut } from '../../hooks/use-ai-opt-out.ts';
import { useMe } from '../../hooks/use-session.ts';

/**
 * Account › Profile, where the user menu's Profile leads: who you are signed in as, and where
 * your own preferences live. Editing the name and password arrives with the account settings.
 */
export function ProfilePage() {
  const me = useMe();
  const ai = useAiOptOut();
  return (
    <SettingsPage title="Profile" description="Who you are signed in as in this workspace.">
      <Card className="flex items-center gap-4 px-5 py-4">
        <Avatar name={me.user.name} hue="accent" size={48} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-16 font-semibold text-tx">{me.user.name}</span>
          <span className="truncate text-13 text-tx-3">{me.user.email}</span>
        </div>
      </Card>
      <Card className="px-5 py-1">
        <SettingsRow
          title="Notifications"
          description="What reaches your inbox and your email, and when the daily summary arrives."
          control={<Link to="/settings/notifications">Open</Link>}
        />
        <SettingsRow
          title="Theme"
          description="Light, dark or the workspace default, from the menu under your name."
        />
        {ai.shown ? (
          <SettingsRow
            title="Use AI features"
            description="Summaries, suggestions and the palette’s AI. Off hides them for you, and keeps what you write out of summaries others ask for, except titles."
            control={
              <Switch
                aria-label="Use AI features"
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
