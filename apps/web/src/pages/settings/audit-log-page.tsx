import { buttonClassName } from '@bemmoly/ui';
import { AuditFiltersBar } from '../../components/audit/audit-filters.tsx';
import { AuditTable } from '../../components/audit/audit-table.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useAuditLog } from '../../hooks/use-audit.ts';

export function AuditLogPage() {
  const audit = useAuditLog();
  return (
    <SettingsPage
      title="Audit log"
      description="Every change to people, access, settings and the server: who did it, from where, and the request it came in on."
      loading={audit.isPending}
      error={audit.error}
      actions={
        <a className={buttonClassName({ variant: 'secondary' })} href={audit.exportUrl} download>
          Export CSV
        </a>
      }
    >
      <div className="flex flex-col gap-3">
        <AuditFiltersBar
          filters={audit.filters}
          people={audit.people}
          targetKinds={audit.targetKinds}
          filtered={audit.filtered}
          onChange={audit.setFilter}
          onClear={audit.clear}
        />
        <AuditTable
          entries={audit.entries}
          actorOf={audit.actorOf}
          filtered={audit.filtered}
          hasMore={audit.hasNextPage}
          loadingMore={audit.isFetchingNextPage}
          onLoadMore={() => void audit.fetchNextPage()}
        />
      </div>
    </SettingsPage>
  );
}
