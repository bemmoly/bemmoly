import type { UpdatesOverview } from '@bemmoly/shared';
import { Button, Card, ConfirmChange } from '@bemmoly/ui';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { MaintenanceNotice } from '../../components/system/maintenance-notice.tsx';
import { CommandBlock, ReleaseCard } from '../../components/updates/release-card.tsx';
import { RollbackCard } from '../../components/updates/rollback-card.tsx';
import { RollbackModal, UpdateModal } from '../../components/updates/update-dialogs.tsx';
import { UpdateProgressModal } from '../../components/updates/update-progress.tsx';
import { VersionCard } from '../../components/updates/version-card.tsx';
import { channelRisk, useUpdateSettings } from '../../hooks/use-updates-settings.ts';
import { useUpdates } from '../../hooks/use-updates.ts';
import { useConfirmChange } from '../../components/settings/use-confirm-change.ts';
import { useSectionEdits } from '../../components/settings/use-section-edits.ts';

/** What the page can honestly say when no newer release is on offer. */
function availabilityLine(overview: UpdatesOverview): string {
  const { checks, current } = overview;
  if (checks.error) return `The last check failed: ${checks.error}`;
  if (!checks.lastCheckedAt)
    return 'The release list has not been fetched yet. Check for updates to see whether a newer release exists.';
  return `You are on the latest ${current.channel} release.`;
}

export function UpdatesPage() {
  const updates = useUpdates();
  const { overview, dialog, maintenance } = updates;
  const updater = overview?.updater;
  const busy = updates.running || maintenance.active;
  const policy = useUpdateSettings(overview);
  const confirm = useConfirmChange();
  const edits = useSectionEdits({
    policy: { title: 'This server', dirty: policy.dirty, discard: policy.discard },
  });
  return (
    <SettingsPage
      title="Updates"
      description="Every module ships in the image, so one update moves the whole workspace forward. A backup is taken first, and rollback stays available for seven days."
      loading={updates.isPending}
      // A failed refetch while the app restarts keeps the page (and the Update dialog) up.
      error={overview ? null : updates.error}
    >
      {overview && updater ? (
        <>
          <MaintenanceNotice active={maintenance.active} message={maintenance.message} />
          {updater.state === 'running' && !dialog.kind ? (
            <div role="status" className="flex flex-col items-start gap-2">
              <Notice>
                {updates.progress?.outcome === 'running'
                  ? `Bemmoly is updating to ${updates.progress.target ?? 'a new version'}. Updates and rollbacks wait until it finishes.`
                  : 'The updater is working. This page checks every few seconds.'}
              </Notice>
              {updates.progress?.outcome === 'running' ? (
                <Button onClick={dialog.watch}>Show progress</Button>
              ) : null}
            </div>
          ) : null}
          {updater.state === 'failed' ? (
            <Notice tone="caution">
              The last update or rollback failed{updater.step ? ` at the ${updater.step} step` : ''}
              . The server kept or restored the previous version; check the audit log for details.
            </Notice>
          ) : null}
          {updater.state === 'unreachable' ? (
            <div className="flex flex-col gap-2">
              <Notice tone="caution">
                The updater is not answering, so updates cannot start from here. Run this on the
                server instead:
              </Notice>
              <CommandBlock command={updater.command} />
            </div>
          ) : null}
          {overview.checks.error ? (
            <Notice tone="caution">The last release check failed: {overview.checks.error}</Notice>
          ) : null}
          {policy.value && policy.stored ? (
            <VersionCard
              overview={overview}
              section={{
                ...edits.section('policy'),
                saving: policy.saving,
                onSave: () => {
                  const { stored, value } = policy;
                  if (!stored || !value) return;
                  confirm.ask(channelRisk(stored, value), () =>
                    policy.save(() => edits.close('policy')),
                  );
                },
              }}
              policy={policy.value}
              refreshing={updates.check.isPending}
              uploading={updates.upload.isPending}
              onPolicy={policy.update}
              onRefresh={() => updates.check.mutate()}
              onUpload={(file) => updates.upload.mutate(file)}
            />
          ) : null}
          {overview.available ? (
            <ReleaseCard
              overview={overview}
              release={overview.available}
              busy={busy}
              onUpdate={() => dialog.open('update')}
            />
          ) : (
            <Card className="px-4 py-3 text-13 text-tx-2">{availabilityLine(overview)}</Card>
          )}
          {overview.rollback ? (
            <RollbackCard
              overview={overview}
              plan={overview.rollback}
              busy={busy}
              onRollback={() => dialog.open('rollback')}
            />
          ) : null}
          {dialog.kind === 'update' && dialog.watching ? (
            <UpdateProgressModal
              target={
                updates.progress?.target ??
                updates.apply.variables ??
                overview.available?.version ??
                overview.current.version
              }
              from={updates.progress?.from ?? overview.current.version}
              progress={updates.progress}
              restarting={updates.restarting}
              onClose={dialog.close}
            />
          ) : null}
          {dialog.kind === 'update' && !dialog.watching ? (
            <UpdateModal
              overview={overview}
              busy={updates.apply.isPending}
              error={updates.applyError}
              cliCommand={updates.cliCommand}
              onClose={dialog.close}
              onConfirm={() =>
                overview.available && updates.apply.mutate(overview.available.version)
              }
            />
          ) : null}
          {dialog.kind === 'rollback' && overview.rollback ? (
            <RollbackModal
              plan={overview.rollback}
              busy={updates.rollback.isPending}
              error={updates.rollback.error}
              planChanged={updates.planChanged}
              exportUrl={updates.auditExportUrl}
              onClose={dialog.close}
              onConfirm={() => overview.rollback && updates.rollback.mutate(overview.rollback.mode)}
            />
          ) : null}
          <ConfirmChange {...confirm.dialog} />
        </>
      ) : null}
    </SettingsPage>
  );
}
