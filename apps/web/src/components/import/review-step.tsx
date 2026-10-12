import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { Button, SettingsSection, SkeletonText } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useImportReview } from '../../hooks/use-import-review.ts';
import { FormError, Notice } from '../form.tsx';

interface ReviewStepProps {
  job: ImportJob;
  source: ImportSource | null;
  starting: boolean;
  error: unknown;
  onBack: () => void;
  onStart: () => void;
}

/**
 * Review: one definition list of everything Start will do, including what is not brought
 * and every exception, then Start import. Start is the confirm; Cancel and Resume are the
 * safety, so there is no second dialog.
 */
export function ReviewStep({ job, source, starting, error, onBack, onStart }: ReviewStepProps) {
  const review = useImportReview(job, source);
  return (
    <SettingsSection title="Review" hint="Nothing changes in Bemmoly until you start">
      {review.loading ? (
        <SkeletonText lines={5} />
      ) : (
        <dl className="m-0 grid grid-cols-[180px_minmax(0,1fr)] gap-x-4 gap-y-2 text-13 max-sm:grid-cols-1 max-sm:gap-y-0.5">
          {review.lines.map((line) => (
            <div key={line.term} className="contents">
              <dt className="text-tx-3">{line.term}</dt>
              <dd className="m-0 text-tx max-sm:mb-2">
                {line.mono ? <span className="font-mono">{line.mono}</span> : null}
                {line.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <Notice>
        Large sites take a while. The import keeps running if you leave this page, and Inbox tells
        you when it is done.
      </Notice>
      <FormError error={error} />
      <div className="-mx-4 -mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3">
        <span className="text-12 text-tx-3">
          You can cancel at any time; what was brought in stays and Resume picks up from there.
        </span>
        <span className="ms-auto flex flex-wrap gap-2">
          <Button variant="ghost" icon={<Icon name="back" />} onClick={onBack}>
            Back
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="import" />}
            loading={starting}
            onClick={onStart}
          >
            Start import
          </Button>
        </span>
      </div>
    </SettingsSection>
  );
}
