import { Button, Card, EmptyState, SettingsRow, Switch } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { AiAdminSettings } from '../../hooks/use-ai-admin.ts';

interface AiSwitchSectionProps {
  admin: AiAdminSettings;
  /** How many providers are connected; none means the page is a first-time setup. */
  providerCount: number;
  /** A text role has a model, so turning AI on shows something. */
  hasLanguageRole: boolean;
  onAdd: () => void;
}

function describe(on: boolean, providers: number, hasRole: boolean): string {
  if (on && !hasRole) {
    return 'On, but no model fills a role yet, so nothing appears. Choose models below.';
  }
  if (on) {
    return 'Summaries, planning help and answers about your work appear for everyone who can see the work.';
  }
  return providers > 0
    ? 'Off. Every AI surface is hidden for everyone. Providers and roles are kept for when it is turned back on.'
    : 'Off. Every AI surface is hidden for everyone.';
}

/**
 * The page's first answer: is AI on. Off and never set up, it is the first-time guidance
 * (only admins reach this page, so only admins are told where AI is turned on).
 */
export function AiSwitchSection({
  admin,
  providerCount,
  hasLanguageRole,
  onAdd,
}: AiSwitchSectionProps) {
  const on = admin.settings?.privacy.enabled ?? false;
  if (!on && providerCount === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Icon name="spark" />}
          title="AI is off"
          description="Connect a provider to turn on summaries, planning help and answers about your docs. Bemmoly works fully without it, and nothing is sent anywhere until you connect one."
          action={
            <Button variant="primary" icon={<Icon name="plus" />} onClick={onAdd}>
              Add provider…
            </Button>
          }
          headingLevel={2}
        />
      </Card>
    );
  }
  return (
    <Card className="px-4 py-1.5">
      <SettingsRow
        title={<span className="text-14">AI for this workspace</span>}
        description={describe(on, providerCount, hasLanguageRole)}
        control={
          <Switch
            aria-label="AI for this workspace"
            checked={on}
            onCheckedChange={(value) =>
              admin.change(
                { privacy: { enabled: value } },
                { title: value ? 'AI turned on' : 'AI turned off for everyone' },
              )
            }
          />
        }
      />
    </Card>
  );
}
