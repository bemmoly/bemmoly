import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { CheckList } from '../../components/system/check-list.tsx';
import { MaintenanceNotice } from '../../components/system/maintenance-notice.tsx';
import { PageBlock } from '../../components/system/page-block.tsx';
import { checkTone, formatUptime, ROLE_WORDS, useSystem } from '../../hooks/use-system.ts';

export function SystemPage() {
  const { status, lastBackup, maintenance, isPending, error } = useSystem();
  return (
    <SettingsPage
      title="System status"
      description="What the server checks about itself, what it is running, and the last backup. Refreshes every 30 seconds."
      loading={isPending}
      error={error}
    >
      {status ? (
        <>
          <MaintenanceNotice active={maintenance.active} message={maintenance.message} />
          <PageBlock id="system-health" title="Health">
            <CheckList
              label="Health checks"
              rows={status.checks.map((check) => ({
                id: check.id,
                name: check.name,
                value: check.value,
                tone: checkTone(check.status),
                ...(check.fix?.href
                  ? { link: { label: check.fix.label, href: check.fix.href } }
                  : check.fix
                    ? { hint: check.fix.hint }
                    : {}),
              }))}
            />
          </PageBlock>
          <PageBlock id="system-server" title="Server">
            <CheckList
              label="Server"
              rows={[
                {
                  id: 'version',
                  name: 'Version',
                  value: status.version,
                  link: { label: 'Updates', href: '/settings/updates' },
                },
                { id: 'role', name: 'Role', value: ROLE_WORDS[status.role], prose: true },
                {
                  id: 'uptime',
                  name: 'Uptime',
                  value: formatUptime(status.uptimeSeconds),
                  prose: true,
                },
                {
                  id: 'maintenance',
                  name: 'Maintenance',
                  value: status.maintenance.active ? (status.maintenance.reason ?? 'On') : 'Off',
                  tone: status.maintenance.active ? 'caution' : 'ok',
                  prose: true,
                },
                {
                  id: 'backup',
                  name: 'Last backup',
                  value: lastBackup?.text ?? 'Checking…',
                  ...(lastBackup ? { tone: lastBackup.tone } : {}),
                  link: { label: 'Backups', href: '/settings/backups' },
                },
                {
                  id: 'ai-spend',
                  name: 'AI spend',
                  value: 'Available with the AI runtime',
                  prose: true,
                },
              ]}
            />
            <p className="m-0 text-13 text-tx-3">
              Job queue figures arrive with the jobs dashboard.
            </p>
          </PageBlock>
        </>
      ) : null}
    </SettingsPage>
  );
}
