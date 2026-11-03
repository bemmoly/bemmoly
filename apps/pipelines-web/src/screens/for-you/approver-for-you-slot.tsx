import { useT } from '@bemmoly/core-web';
import { buttonClassName, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { forYouText } from '../../i18n/catalog.ts';

/**
 * The seam where stream S3's approver cards mount ("Waiting for you", "Decided recently",
 * "Live in" the last environment). Until they land, an approver is sent to Changes.
 */
export function ApproverForYouSlot() {
  const t = useT(forYouText);
  return (
    <div className="rounded-card border border-line bg-card shadow-e1">
      <EmptyState
        icon={<Icon name="checklist" size={18} />}
        title={t('pipelinesForYou.approver.title')}
        description={t('pipelinesForYou.approver.description')}
        headingLevel={2}
        action={
          <Link to="/changes" className={buttonClassName({ variant: 'primary' })}>
            {t('pipelinesForYou.approver.open')}
          </Link>
        }
      />
    </div>
  );
}
