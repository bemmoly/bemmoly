import { useT } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../i18n/catalog.ts';

/**
 * Signed in, but Pipelines is not granted to this person (or not turned on): say so, say who
 * can change it, and offer the way back to Bemmoly.
 */
export function NoAccessScreen() {
  const t = useT(pipelinesText);
  return (
    <div className="grid min-h-full place-items-center px-4 py-16">
      <EmptyState
        icon={<Icon name="lock" size={18} />}
        title={t('pipelines.noAccess.title')}
        description={t('pipelines.noAccess.description')}
        headingLevel={1}
        action={
          <Button variant="secondary" onClick={() => window.location.assign('/')}>
            {t('pipelines.shell.openBemmoly')}
          </Button>
        }
      />
    </div>
  );
}
