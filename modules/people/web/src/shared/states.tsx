import { useT } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { peopleText } from '../i18n/catalog.ts';

/** A read that failed: what happened, that nothing changed, and Try again. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useT(peopleText);
  return (
    <EmptyState
      icon={<Icon name="warning" />}
      title={t('people.error.title')}
      description={t('people.error.body')}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('people.error.retry')}
        </Button>
      }
    />
  );
}
