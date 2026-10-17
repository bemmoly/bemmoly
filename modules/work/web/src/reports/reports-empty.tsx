import { Button, EmptyState, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

/* What the Reports screen shows while it loads or when a read fails. */

export function ReportsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<Icon name="warning" />}
      title="The reports did not load"
      description={`${message} Nothing was changed.`}
      action={<Button onClick={onRetry}>Try again</Button>}
    />
  );
}

export function NoSprints() {
  return (
    <EmptyState
      size="sm"
      icon={<Icon name="reports" />}
      title="No sprint has started"
      description="Burndown, burnup, the sprint report and velocity appear once a sprint starts. Flow reports below cover every issue."
    />
  );
}

/** The toolbar's height, then two chart cards of the final size. */
export function ReportsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the reports"
      aria-busy
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-canvas px-6 py-4 max-md:px-4"
    >
      <Skeleton width={320} height={28} className="rounded-control" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton height={260} className="rounded-card" />
        <Skeleton height={260} className="rounded-card" />
      </div>
      <Skeleton height={260} className="rounded-card" />
    </div>
  );
}
