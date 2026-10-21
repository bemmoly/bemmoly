import { Card, CardBody, CardHeader, Skeleton } from '@bemmoly/ui';
import type { ReactNode } from 'react';

/** One report: a titled card with an optional line under the title and the chart in the body. */
export function ReportCard({
  title,
  hint,
  children,
  className,
  actions,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  /** Controls on the header's right, such as a dashboard widget's menu. */
  actions?: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader
        title={<h3 className="m-0 text-14 font-semibold">{title}</h3>}
        hint={hint}
        actions={actions}
      />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/** What a report says in place of its chart when there is nothing to draw yet. */
export function ReportNote({ children }: { children: ReactNode }) {
  return <p className="m-0 py-6 text-center text-13 text-tx-2">{children}</p>;
}

/** A group of reports under one heading, with the controls that change them beside it. */
export function ReportSection({
  title,
  controls,
  children,
}: {
  title: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const id = `reports-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={id} className="m-0 mr-auto text-16 font-semibold text-tx">
          {title}
        </h2>
        {controls}
      </div>
      {children}
    </section>
  );
}

/** A card's body while its own read is in flight or failed; the rest of the page stays. */
export function ReportPending({ error }: { error: Error | null }) {
  if (!error) return <Skeleton height={200} className="rounded-control" />;
  return <ReportNote>This report did not load: {error.message.replace(/\.$/, '')}.</ReportNote>;
}
