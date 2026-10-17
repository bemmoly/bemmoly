import { useT } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../i18n/catalog.ts';
import { refusalOf } from '../lib/refusal.ts';

/**
 * A block that did not load, in its card: what happened and Try again, or, when access was
 * refused, the rule in words and who can grant it (a retry would not help, so none is offered).
 */
export function LoadError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useT(pipelinesText);
  const refusal = refusalOf(error);
  return (
    <div className="rounded-card border border-line bg-card py-12 shadow-e1">
      {refusal ? (
        <EmptyState
          icon={<Icon name="lock" size={18} />}
          title={t('pipelines.common.noAccessTitle')}
          description={refusal.askWho ? `${refusal.sentence} ${refusal.askWho}` : refusal.sentence}
          headingLevel={2}
        />
      ) : (
        <EmptyState
          icon={<Icon name="warning" size={18} />}
          title={title}
          description={t('pipelines.common.loadFailed')}
          headingLevel={2}
          action={<Button onClick={onRetry}>{t('pipelines.common.tryAgain')}</Button>}
        />
      )}
    </div>
  );
}
