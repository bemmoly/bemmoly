import { useT } from '@bemmoly/core-web';
import type { SetupStep } from '@bemmoly/module-pipelines/shared';
import { Badge, buttonClassName, Card, CardHeader, ProgressBar } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { setupText } from '../../../i18n/catalog.ts';
import { cx } from '../../../lib/cx.ts';
import { NEEDS_WORDS, nextStep, STEP_PLACE, STEP_WORDS } from './steps.ts';

/**
 * Set up Pipelines: six steps in any order. A done step says Done; one that needs another says
 * which; the first that can be done now has the primary button.
 */
export function ChecklistCard({ steps }: { steps: readonly SetupStep[] }) {
  const t = useT(setupText);
  const done = steps.filter((step) => step.done).length;
  const next = nextStep(steps);
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.home.checklist')}</h2>}
        actions={
          <span className="text-12 font-normal text-tx-3">
            {t('pipelinesSetup.home.progress', { done, total: steps.length })}
          </span>
        }
      />
      <ProgressBar
        value={(done / steps.length) * 100}
        label={t('pipelinesSetup.home.progress', { done, total: steps.length })}
      />
      <ol aria-label={t('pipelinesSetup.home.checklist')} className="flex flex-col">
        {steps.map((step, index) => {
          const [title, text, action] = STEP_WORDS[step.key];
          return (
            <li
              key={step.key}
              data-done={step.done || undefined}
              className="flex items-start gap-3 border-b border-line-2 px-4 py-4 last:border-b-0"
            >
              <span
                aria-hidden
                className={cx(
                  'mt-px grid size-6 shrink-0 place-items-center rounded-full text-12 font-semibold',
                  step.done ? 'bg-green-50 text-green-tx' : 'bg-line-2 text-tx-2',
                )}
              >
                {step.done ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-tx">
                  {t(title)}
                  {step.optional && <Badge>{t('pipelinesSetup.home.optional')}</Badge>}
                </span>
                <span className="text-12 leading-body text-tx-3">
                  {step.blockedBy ? t(NEEDS_WORDS[step.blockedBy]) : t(text)}
                </span>
              </div>
              {step.done ? (
                <Badge tone="ok">{t('pipelinesSetup.home.done')}</Badge>
              ) : step.blockedBy ? (
                <button type="button" disabled className={buttonClassName({ size: 'sm' })}>
                  {t(action)}
                </button>
              ) : (
                <Link
                  to={STEP_PLACE[step.key] as '/'}
                  aria-label={`${t(action)}: ${t(title)}`}
                  className={buttonClassName({
                    size: 'sm',
                    variant: step.key === next ? 'primary' : 'secondary',
                  })}
                >
                  {t(action)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
