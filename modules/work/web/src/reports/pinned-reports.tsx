import type { PinnedReportView } from '@bemmoly/module-work/shared';
import { Button, Card, CardBody, CardHeader } from '@bemmoly/ui';
import { useRef } from 'react';
import { ReportNote, ReportPending, ReportSection } from './report-card.tsx';
import { ExportMenu } from './report-actions.tsx';
import { ReportFigure } from './report-figure.tsx';
import { describeSpec } from './report-spec-text.ts';
import { usePinnedReports } from './use-ask-report.ts';

/*
 * The person's pinned reports, first on their Reports view. Each was asked once and is
 * rebuilt from live data on every visit, without AI, so it shows whether AI is on or not.
 * Nothing is drawn until someone has pinned a report.
 */

function PinnedCard({
  pin,
  removing,
  onUnpin,
}: {
  pin: PinnedReportView;
  removing: boolean;
  onUnpin: () => void;
}) {
  const figure = useRef<HTMLDivElement>(null);
  return (
    <Card>
      <CardHeader
        title={<h3 className="m-0 truncate text-14 font-semibold">{pin.spec.title}</h3>}
        actions={
          <>
            {pin.result && (
              <ExportMenu result={pin.result} question={pin.question} figure={figure} />
            )}
            <Button size="sm" variant="ghost" onClick={onUnpin} loading={removing}>
              Unpin
            </Button>
          </>
        }
      />
      <CardBody>
        <div className="flex flex-col gap-3">
          <p className="m-0 text-12 text-tx-2">
            <span className="text-tx">“{pin.question}”</span>
            {pin.result && <> · {describeSpec(pin.spec)}</>}
          </p>
          <div ref={figure}>
            {pin.result ? (
              <ReportFigure result={pin.result} />
            ) : (
              <ReportNote>{pin.error ?? 'This report did not load.'}</ReportNote>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function PinnedReports({ projectKey }: { projectKey: string }) {
  const { pins, unpin } = usePinnedReports(projectKey);
  if (pins.isPending) return null;
  if (pins.error) {
    return (
      <ReportSection title="Pinned">
        <ReportPending error={pins.error} />
      </ReportSection>
    );
  }
  if (pins.data.length === 0) return null;
  return (
    <ReportSection title="Pinned">
      <div className="grid gap-4 lg:grid-cols-2">
        {pins.data.map((pin) => (
          <PinnedCard
            key={pin.id}
            pin={pin}
            removing={unpin.isPending && unpin.variables === pin.id}
            onUnpin={() => unpin.mutate(pin.id)}
          />
        ))}
      </div>
    </ReportSection>
  );
}
