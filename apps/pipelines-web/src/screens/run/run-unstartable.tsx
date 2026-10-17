import { useT } from '@bemmoly/core-web';
import type { RunDetail } from '@bemmoly/module-pipelines/shared';
import { pipelinesText } from '../../i18n/catalog.ts';
import { StateGlyph } from '../../parts/bits.tsx';
import { ChangeCard } from './run-side.tsx';

/**
 * A run that failed before any job started has no stages or log to show; the reason is the
 * whole story ("Couldn't read .bemmoly/application.yaml: …"), so it takes the log's place.
 */
export function UnstartableRun({ run, reason }: { run: RunDetail; reason: string }) {
  const t = useT(pipelinesText);
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
      <section
        aria-labelledby="unstartable-heading"
        className="flex min-w-0 items-start gap-2.5 rounded-card border border-line bg-card px-4 py-3.5 shadow-e1"
      >
        <span className="mt-0.5 shrink-0">
          <StateGlyph state="failed" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="unstartable-heading" className="text-16 leading-title font-semibold text-tx">
            {t('pipelines.run.unstartableTitle')}
          </h2>
          <p className="text-13 break-words whitespace-pre-line text-tx-2">{reason}</p>
        </div>
      </section>
      <div className="flex flex-col gap-3">
        <ChangeCard run={run} />
      </div>
    </div>
  );
}
