import { useT } from '@bemmoly/core-web';
import { buttonClassName, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { forYouText } from '../../i18n/catalog.ts';

/**
 * The seam where stream S2's setup checklist mounts on a fresh install: For you shows it while
 * the checklist is not complete. Until it lands, the first step is offered on its own.
 */
export function SetupChecklistSlot() {
  const t = useT(forYouText);
  return (
    <div className="rounded-card border border-line bg-card shadow-e1">
      <EmptyState
        icon={<Icon name="checklist" size={18} />}
        title={t('pipelinesForYou.setup.title')}
        description={t('pipelinesForYou.setup.description')}
        headingLevel={2}
        action={
          <Link to="/setup/cloud" className={buttonClassName({ variant: 'primary' })}>
            {t('pipelinesForYou.setup.connect')}
          </Link>
        }
      />
    </div>
  );
}
