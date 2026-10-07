import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { CheckList } from '../../components/system/check-list.tsx';
import { PageBlock } from '../../components/system/page-block.tsx';
import { QueueStats } from '../../components/system/queue-stats.tsx';
import { healthTone, useSystem } from '../../hooks/use-system.ts';

export function SystemPage() {
  const { status, lastBackup, isPending, error } = useSystem();
  return (
    <SettingsPage
      title="System status"
      description="What the server checks about itself, the background job queue, and the last backup. Refreshes every 30 seconds."
      loading={isPending}
      error={error}
    >
      {status ? (
        <>
          <PageBlock id="system-health" title="Health">
            <CheckList
              label="Health checks"
              rows={status.health.map((check) => ({
                id: check.id,
                name: check.name,
                value: check.detail,
                tone: healthTone(check.status),
                ...(check.fix ? { link: check.fix } : {}),
              }))}
            />
          </PageBlock>
          <PageBlock id="system-queue" title="Background jobs">
            <QueueStats queue={status.queue} />
          </PageBlock>
          <PageBlock id="system-operations" title="Operations">
            <CheckList
              label="Operations"
              rows={[
                {
                  id: 'backup',
                  name: 'Last backup',
                  value: lastBackup?.text ?? '',
                  ...(lastBackup ? { tone: lastBackup.tone } : {}),
                  link: { label: 'Backups', href: '/settings/backups' },
                },
                {
                  id: 'version',
                  name: 'Version',
                  value: status.version,
                  link: { label: 'Updates', href: '/settings/updates' },
                },
                {
                  id: 'ai-spend',
                  name: 'AI spend',
                  value: 'Available with the AI runtime',
                  prose: true,
                },
              ]}
            />
          </PageBlock>
        </>
      ) : null}
    </SettingsPage>
  );
}
