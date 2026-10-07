import { Card, CardBody, SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';
import { PRIVACY_ROWS } from '../../hooks/use-ai-settings.ts';
import { LINK_ACTION } from '../actions.ts';

interface PrivacyRowsProps {
  shareContent: boolean;
  onShareContent: (value: boolean) => void;
  allowActions: boolean;
  onAllowActions: (value: boolean) => void;
  disabled?: boolean;
  /** Settings pages title the card; the wizard shows the rows bare, as its mock does. */
  title?: string;
}

/** What AI may see and do: two switches that save, and the space exclusion that waits for Docs. */
export function PrivacyRows({
  shareContent,
  onShareContent,
  allowActions,
  onAllowActions,
  disabled,
  title,
}: PrivacyRowsProps) {
  const { shareContent: share, allowActions: act, excludeSpaces: exclude } = PRIVACY_ROWS;
  const rows = (
    <>
      <SettingsRow
        title={share.label}
        description={share.hint}
        control={
          <Switch
            aria-label={share.label}
            checked={shareContent}
            onCheckedChange={onShareContent}
            disabled={disabled}
          />
        }
      />
      <SettingsRow
        title={act.label}
        description={act.hint}
        control={
          <Switch
            aria-label={act.label}
            checked={allowActions}
            onCheckedChange={onAllowActions}
            disabled={disabled}
          />
        }
      />
      <SettingsRow
        title={exclude.label}
        description={`${exclude.hint} ${exclude.disabledReason}.`}
        control={
          <button type="button" className={LINK_ACTION} disabled title={exclude.disabledReason}>
            {exclude.action}
          </button>
        }
      />
    </>
  );
  if (title) {
    return (
      <SettingsSection title={title} layout="rows">
        {rows}
      </SettingsSection>
    );
  }
  return (
    <Card>
      <CardBody layout="list">{rows}</CardBody>
    </Card>
  );
}
