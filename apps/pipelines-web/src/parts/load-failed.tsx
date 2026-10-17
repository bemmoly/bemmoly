import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import { forbiddenDetailsSchema, type ForbiddenDetails } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../i18n/catalog.ts';
import { cx } from '../lib/cx.ts';

/** The sentence and who to ask behind a refusal from Pipelines, when the error carries them. */
export function refusalOf(error: unknown): ForbiddenDetails | null {
  if (!(error instanceof ApiError) || error.code !== 'forbidden') return null;
  const parsed = forbiddenDetailsSchema.safeParse(error.details);
  return parsed.success ? parsed.data : null;
}

/** Whether the endpoint is not there at all: a part of Pipelines that is not installed yet. */
export function isMissing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 501);
}

/**
 * A read that failed, inside the area it would have filled: what happened, that nothing was
 * lost, and Try again. A refusal says why and whom to ask instead, since trying again would
 * not help.
 */
export function LoadFailed({
  error,
  onRetry,
  size = 'md',
  bare = false,
  className,
}: {
  error: unknown;
  onRetry: () => void;
  size?: 'md' | 'sm';
  /** Inside a card already: no border of its own. */
  bare?: boolean;
  className?: string;
}) {
  const t = useT(pipelinesText);
  const refusal = refusalOf(error);
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div className={cx(!bare && 'rounded-card border border-line bg-card', className)}>
      {refusal ? (
        <EmptyState
          size={size}
          icon={<Icon name="lock" size={18} />}
          title={refusal.sentence}
          description={refusal.askWho?.label ?? t('pipelines.common.askAdmin')}
          headingLevel={2}
        />
      ) : (
        <EmptyState
          size={size}
          icon={<Icon name="warning" size={18} />}
          title={t('pipelines.common.loadFailedTitle')}
          description={
            requestId
              ? t('pipelines.common.loadFailedWithId', { requestId })
              : t('pipelines.common.loadFailed')
          }
          headingLevel={2}
          action={
            <Button variant="secondary" size={size === 'sm' ? 'sm' : 'md'} onClick={onRetry}>
              {t('pipelines.common.tryAgain')}
            </Button>
          }
        />
      )}
    </div>
  );
}
