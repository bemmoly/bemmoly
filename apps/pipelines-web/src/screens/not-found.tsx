import { useT } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { pipelinesText } from '../i18n/catalog.ts';

export function NotFoundScreen() {
  const t = useT(pipelinesText);
  const navigate = useNavigate();
  return (
    <div className="grid min-h-full place-items-center px-4 py-16">
      <EmptyState
        icon={<Icon name="warning" size={18} />}
        title={t('pipelines.notFound.title')}
        description={t('pipelines.notFound.description')}
        headingLevel={1}
        action={
          <Button onClick={() => void navigate({ to: '/' })}>{t('pipelines.notFound.home')}</Button>
        }
      />
    </div>
  );
}
